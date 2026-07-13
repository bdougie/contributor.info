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
use std::net::{SocketAddr, TcpListener};
use std::path::PathBuf;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use socket2::{Domain, Protocol, Socket, Type};
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

/// Bind the loopback callback listener with `SO_REUSEADDR` so a socket left in
/// TIME_WAIT by a previous sign-in attempt (the served `/callback` connection
/// closes server-side) doesn't block a retry with a spurious "address in use".
fn bind_callback_listener() -> Result<TcpListener, String> {
    let addr: SocketAddr = ([127, 0, 0, 1], CALLBACK_PORT).into();
    let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))
        .map_err(|e| format!("callback socket setup failed: {e}"))?;
    socket
        .set_reuse_address(true)
        .map_err(|e| format!("callback socket setup failed: {e}"))?;
    socket
        .bind(&addr.into())
        .map_err(|_| format!("port {CALLBACK_PORT} is busy — is a sign-in already running?"))?;
    socket
        .listen(1)
        .map_err(|e| format!("callback listener failed: {e}"))?;
    Ok(socket.into())
}

/// Branded browser page shown after the OAuth redirect. Placeholders (`%…%`)
/// are filled per outcome by `callback_html`; served as UTF-8 so the emoji and
/// typographic punctuation render.
const CALLBACK_TEMPLATE: &str = r#"<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>contributor.info</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--muted:#6b7280;--border:#e5e7eb}
@media(prefers-color-scheme:dark){:root{--bg:#111113;--fg:#ededed;--muted:#9ca3af;--border:#27272a}}
*{box-sizing:border-box;margin:0}html,body{height:100%}
body{background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
.card{max-width:420px;width:100%;text-align:center;border:1px solid var(--border);border-radius:16px;padding:40px 32px}
.mark{width:64px;height:64px;margin:0 auto 20px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:30px;background:rgba(%ACCENT%,0.14);border:1px solid rgba(%ACCENT%,0.4)}
h1{font-size:20px;font-weight:640;margin-bottom:8px;letter-spacing:-0.01em}
p{font-size:14px;color:var(--muted);line-height:1.5}
.brand{margin-top:26px;font-size:12px;color:var(--muted)}
.brand b{color:var(--fg);font-weight:600}
</style></head>
<body><main class="card">
<div class="mark">%EMOJI%</div>
<h1>%HEADING%</h1>
<p>%SUB%</p>
<div class="brand">🌱 <b>contributor.info</b></div>
</main></body></html>"#;

/// Render the callback page for a success or failure outcome, matching the
/// app's palette (accent `#10b981`, seedling motif).
fn callback_html(signed_in: bool) -> String {
    let (accent, emoji, heading, sub) = if signed_in {
        (
            "16,185,129",
            "\u{1F331}",
            "You\u{2019}re signed in",
            "Head back to the contributor.info app \u{2014} you can close this tab.",
        )
    } else {
        (
            "239,68,68",
            "\u{26A0}\u{FE0F}",
            "Sign-in didn\u{2019}t complete",
            "No authorization code came back. Close this tab and try again from the app.",
        )
    };
    CALLBACK_TEMPLATE
        .replace("%ACCENT%", accent)
        .replace("%EMOJI%", emoji)
        .replace("%HEADING%", heading)
        .replace("%SUB%", sub)
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
                    Some(_) => ("200 OK", callback_html(true)),
                    None => ("400 Bad Request", callback_html(false)),
                };
                let _ = stream.write_all(
                    format!(
                        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
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
    let listener = bind_callback_listener()?;

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
