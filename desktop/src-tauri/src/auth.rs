//! Supabase GitHub OAuth for private workspaces, using the PKCE flow with a
//! one-shot loopback callback listener (the same pattern RepoBar uses).
//!
//! Flow: bind 127.0.0.1:1421 → open the browser at GoTrue's /authorize with a
//! code challenge → GitHub → Supabase redirects to /callback?code=… → exchange
//! code + verifier for a session. The redirect URL must be allow-listed in the
//! Supabase dashboard (Authentication → URL Configuration → Redirect URLs):
//! `http://localhost:1421/callback`.
//!
//! Sessions persist to `session.json` (0600) in the app config dir; refresh
//! tokens rotate on every refresh, so the file is rewritten each time.

use std::fs;
use std::io::{Read, Write as IoWrite};
use std::net::TcpListener;
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::Manager;

pub const CALLBACK_PORT: u16 = 1421;
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub access_token: String,
    pub refresh_token: String,
    /// Unix seconds when `access_token` expires.
    pub expires_at: u64,
    #[serde(default)]
    pub user_name: String,
}

impl Session {
    pub fn expires_within(&self, margin: Duration) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        self.expires_at <= now + margin.as_secs()
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    expires_in: u64,
    #[serde(default)]
    user: Option<UserPayload>,
}

#[derive(Deserialize, Default)]
struct UserPayload {
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    user_metadata: serde_json::Value,
}

fn session_from_response(resp: TokenResponse, fallback_name: Option<String>) -> Session {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let user = resp.user.unwrap_or_default();
    let user_name = user
        .user_metadata
        .get("user_name")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(user.email)
        .or(fallback_name)
        .unwrap_or_default();
    Session {
        access_token: resp.access_token,
        refresh_token: resp.refresh_token,
        expires_at: now + resp.expires_in,
        user_name,
    }
}

/// Wait for the OAuth redirect on the loopback listener and pull `code` out
/// of the request line. Serves a tiny "return to the app" page in response.
fn wait_for_code(listener: TcpListener) -> Result<String, String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("listener setup failed: {e}"))?;
    let deadline = Instant::now() + CALLBACK_TIMEOUT;

    loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buf = [0u8; 4096];
                let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]);
                let request_line = request.lines().next().unwrap_or_default();

                // Browsers also ask for /favicon.ico — only treat /callback
                // requests as the redirect.
                if !request_line.contains("/callback") {
                    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n");
                    continue;
                }

                let code = request_line
                    .split_whitespace()
                    .nth(1)
                    .and_then(|path| path.split('?').nth(1))
                    .and_then(|query| {
                        query
                            .split('&')
                            .find_map(|kv| kv.strip_prefix("code="))
                            .map(String::from)
                    });

                let (status, body) = match &code {
                    Some(_) => (
                        "200 OK",
                        "<html><body style=\"font-family:sans-serif;text-align:center;padding-top:20vh\">\
                         <h2>\u{1F331} Signed in</h2><p>You can close this tab and return to the app.</p></body></html>",
                    ),
                    None => (
                        "400 Bad Request",
                        "<html><body style=\"font-family:sans-serif;text-align:center;padding-top:20vh\">\
                         <h2>Sign-in failed</h2><p>No authorization code was returned. Close this tab and try again.</p></body></html>",
                    ),
                };
                let _ = stream.write_all(
                    format!(
                        "HTTP/1.1 {status}\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                        body.len()
                    )
                    .as_bytes(),
                );

                match code {
                    Some(c) => return Ok(c),
                    None => return Err("authorization was denied or returned no code".into()),
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if Instant::now() >= deadline {
                    return Err("timed out waiting for the browser sign-in".into());
                }
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(e) => return Err(format!("callback listener failed: {e}")),
        }
    }
}

/// Run the full interactive login. Returns the new session; the caller opens
/// the browser via the URL handed to `open_browser` (kept as a callback so
/// this module stays free of tauri UI concerns).
pub async fn login(
    supabase_url: &str,
    anon_key: &str,
    open_browser: impl FnOnce(String),
) -> Result<Session, String> {
    // One listener per login; a failed bind means another login is pending
    // (or another app owns the port).
    let listener = TcpListener::bind(("127.0.0.1", CALLBACK_PORT))
        .map_err(|_| format!("port {CALLBACK_PORT} is busy — is a sign-in already running?"))?;

    let mut verifier_bytes = [0u8; 32];
    getrandom::getrandom(&mut verifier_bytes).map_err(|e| format!("rng failure: {e}"))?;
    let verifier = URL_SAFE_NO_PAD.encode(verifier_bytes);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));

    let authorize_url = format!(
        "{supabase_url}/auth/v1/authorize?provider=github\
         &redirect_to=http%3A%2F%2Flocalhost%3A{CALLBACK_PORT}%2Fcallback\
         &code_challenge={challenge}&code_challenge_method=s256"
    );
    open_browser(authorize_url);

    let code = tauri::async_runtime::spawn_blocking(move || wait_for_code(listener))
        .await
        .map_err(|e| format!("callback task failed: {e}"))??;

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{supabase_url}/auth/v1/token?grant_type=pkce"))
        .header("apikey", anon_key)
        .json(&serde_json::json!({ "auth_code": code, "code_verifier": verifier }))
        .send()
        .await
        .map_err(|e| format!("token exchange failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("token exchange rejected ({status}): {body}"));
    }
    let token: TokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("unexpected token response: {e}"))?;
    Ok(session_from_response(token, None))
}

/// Exchange the rotating refresh token for a fresh session. `None` means the
/// session is no longer valid and the caller should drop to anonymous.
pub async fn refresh(supabase_url: &str, anon_key: &str, session: &Session) -> Option<Session> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{supabase_url}/auth/v1/token?grant_type=refresh_token"))
        .header("apikey", anon_key)
        .json(&serde_json::json!({ "refresh_token": session.refresh_token }))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let token: TokenResponse = resp.json().await.ok()?;
    Some(session_from_response(
        token,
        Some(session.user_name.clone()),
    ))
}

fn path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("session.json"))
}

pub fn load(app: &tauri::AppHandle) -> Option<Session> {
    let path = path(app)?;
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save(app: &tauri::AppHandle, session: &Session) {
    let Some(path) = path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(session) {
        let _ = fs::write(&path, json);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
        }
    }
}

pub fn clear(app: &tauri::AppHandle) {
    if let Some(path) = path(app) {
        let _ = fs::remove_file(path);
    }
}
