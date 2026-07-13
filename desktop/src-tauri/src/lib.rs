//! contributor.info in the system tray, workspaces-first: each configured
//! workspace resolves to its public identity and its aggregated metrics
//! (open/merged PRs, velocity, contributors, stars).
//!
//! Data flow: a 60s poll loop reads Supabase REST (the anon key for public
//! workspaces, or the user JWT once signed in) for workspace identity and the
//! site's public `api-workspace-metrics` endpoint for the numbers, stores a
//! `Snapshot` in managed state, rebuilds the tray menu from it, and emits a
//! `snapshot` event the dashboard webview listens for. Every fetch failure
//! degrades to a status string — the tray never errors out.

mod auth;
mod settings;
mod supabase;

use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_opener::OpenerExt;

use auth::Session;
use settings::Settings;
use supabase::{Supabase, WorkspaceMetrics};

/// Site base for `/i/{slug}` links and the `api-workspace-metrics` endpoint.
/// Overridable at build time to aim the app at a local `netlify dev`, a deploy
/// preview, or staging — set `VITE_CONTRIBUTOR_SITE` when building.
pub const SITE: &str = match option_env!("VITE_CONTRIBUTOR_SITE") {
    Some(s) => s,
    None => "https://contributor.info",
};

const TRAY_ID: &str = "ci-tray";
const POLL_INTERVAL: Duration = Duration::from_secs(60);

#[derive(Debug, Clone, Serialize)]
pub struct WorkspaceStatus {
    slug: String,
    name: String,
    /// `ready | not_found | no_metrics | unconfigured | unreachable`
    state: String,
    metrics: Option<WorkspaceMetrics>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Snapshot {
    workspaces: Vec<WorkspaceStatus>,
    signed_in_as: Option<String>,
    refreshed_at: u64,
}

#[derive(Default)]
struct AppState {
    snapshot: Mutex<Snapshot>,
    settings: Mutex<Settings>,
    session: Mutex<Option<Session>>,
}

fn fmt_trend(v: Option<f64>) -> String {
    match v {
        Some(t) if t.abs() >= 0.5 => format!(" ({t:+.0}%)"),
        _ => String::new(),
    }
}

fn workspace_title(ws: &WorkspaceStatus) -> String {
    match (&ws.metrics, ws.state.as_str()) {
        (Some(m), _) => format!("\u{1F331} {}  ·  {} open PRs", ws.name, m.open_prs),
        (None, "not_found") => format!("\u{26A0}\u{FE0F} {}  ·  not found (private?)", ws.slug),
        (None, "no_metrics") => format!("\u{23F3} {}  ·  metrics unavailable", ws.name),
        (None, "unreachable") => format!("\u{26A0}\u{FE0F} {}  ·  offline", ws.slug),
        (None, _) => format!("\u{26A0}\u{FE0F} {}  ·  {}", ws.slug, ws.state),
    }
}

fn metric_lines(m: &WorkspaceMetrics) -> Vec<String> {
    let mut lines = vec![
        format!(
            "PRs · {} open, {} merged{}",
            m.open_prs,
            m.merged_prs,
            fmt_trend(m.prs_trend)
        ),
        format!(
            "Velocity · {:.1} PRs/day, {:.0}h to merge",
            m.pr_velocity.unwrap_or(0.0),
            m.avg_pr_merge_time_hours.unwrap_or(0.0)
        ),
        format!(
            "Contributors · {} active, {} new{}",
            m.active_contributors,
            m.new_contributors,
            fmt_trend(m.contributors_trend)
        ),
        format!("Issues · {} open", m.open_issues),
        format!("\u{2B50} {}{}", m.total_stars, fmt_trend(m.stars_trend)),
    ];
    if m.is_stale {
        lines.push("(metrics cache is stale)".into());
    }
    lines
}

fn build_menu(app: &AppHandle, snapshot: &Snapshot) -> tauri::Result<Menu<tauri::Wry>> {
    let menu = Menu::new(app)?;

    menu.append(&MenuItem::with_id(
        app,
        "open-site",
        "contributor.info \u{2197}",
        true,
        None::<&str>,
    )?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;

    if snapshot.workspaces.is_empty() {
        menu.append(&MenuItem::with_id(
            app,
            "dashboard",
            "Add a workspace\u{2026}",
            true,
            None::<&str>,
        )?)?;
    }
    for ws in &snapshot.workspaces {
        let sub = Submenu::with_id(
            app,
            format!("ws-menu:{}", ws.slug),
            workspace_title(ws),
            true,
        )?;
        sub.append(&MenuItem::with_id(
            app,
            format!("ws:{}", ws.slug),
            "Open in contributor.info \u{2197}",
            true,
            None::<&str>,
        )?)?;
        if let Some(m) = &ws.metrics {
            sub.append(&PredefinedMenuItem::separator(app)?)?;
            for (i, line) in metric_lines(m).into_iter().enumerate() {
                sub.append(&MenuItem::with_id(
                    app,
                    format!("ws-metric:{}:{}", ws.slug, i),
                    line,
                    false,
                    None::<&str>,
                )?)?;
            }
        }
        menu.append(&sub)?;
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    match &snapshot.signed_in_as {
        Some(name) => {
            menu.append(&MenuItem::with_id(
                app,
                "account",
                format!("Signed in as {name}"),
                false,
                None::<&str>,
            )?)?;
            menu.append(&MenuItem::with_id(app, "logout", "Sign out", true, None::<&str>)?)?;
        }
        None => {
            menu.append(&MenuItem::with_id(
                app,
                "login",
                "Sign in with GitHub\u{2026}",
                true,
                None::<&str>,
            )?)?;
        }
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "dashboard", "Dashboard\u{2026}", true, None::<&str>)?)?;
    menu.append(&MenuItem::with_id(app, "refresh", "Refresh now", true, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?)?;

    Ok(menu)
}

async fn fetch_workspace(db: &Supabase, slug: &str, time_range: &str) -> WorkspaceStatus {
    if !db.configured() {
        return WorkspaceStatus {
            slug: slug.into(),
            name: slug.into(),
            state: "unconfigured".into(),
            metrics: None,
        };
    }
    match db.workspace_by_slug(slug).await {
        None => WorkspaceStatus {
            slug: slug.into(),
            name: slug.into(),
            state: "unreachable".into(),
            metrics: None,
        },
        Some(None) => WorkspaceStatus {
            slug: slug.into(),
            name: slug.into(),
            state: "not_found".into(),
            metrics: None,
        },
        Some(Some(ws)) => {
            let metrics = db.metrics(&ws.id, time_range).await;
            WorkspaceStatus {
                slug: ws.slug,
                name: ws.name,
                state: if metrics.is_some() { "ready" } else { "no_metrics" }.into(),
                metrics,
            }
        }
    }
}

/// Return a live user session, transparently refreshing (GoTrue rotates the
/// refresh token) or dropping to anonymous when the refresh is rejected.
async fn live_session(app: &AppHandle, cfg: &Settings) -> Option<Session> {
    let current = app.state::<AppState>().session.lock().unwrap().clone()?;
    if !current.expires_within(Duration::from_secs(300)) {
        return Some(current);
    }
    match auth::refresh(&cfg.supabase_url, &cfg.anon_key(), &current).await {
        Some(fresh) => {
            auth::save(app, &fresh);
            *app.state::<AppState>().session.lock().unwrap() = Some(fresh.clone());
            Some(fresh)
        }
        None => {
            auth::clear(app);
            *app.state::<AppState>().session.lock().unwrap() = None;
            None
        }
    }
}

async fn refresh(app: AppHandle) {
    let cfg = app.state::<AppState>().settings.lock().unwrap().clone();
    let session = live_session(&app, &cfg).await;
    let db = Supabase::new(
        cfg.supabase_url.clone(),
        cfg.anon_key(),
        session.as_ref().map(|s| s.access_token.clone()),
    );

    let mut workspaces = Vec::with_capacity(cfg.workspaces.len());
    for slug in &cfg.workspaces {
        workspaces.push(fetch_workspace(&db, slug, &cfg.time_range).await);
    }

    let snapshot = Snapshot {
        workspaces,
        signed_in_as: session.map(|s| s.user_name),
        refreshed_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0),
    };

    if let Ok(menu) = build_menu(&app, &snapshot) {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            let _ = tray.set_menu(Some(menu));
            let open_prs: i64 = snapshot
                .workspaces
                .iter()
                .filter_map(|w| w.metrics.as_ref())
                .map(|m| m.open_prs)
                .sum();
            let _ = tray.set_tooltip(Some(format!(
                "contributor.info — {} workspaces · {open_prs} open PRs",
                snapshot.workspaces.len()
            )));
        }
    }

    *app.state::<AppState>().snapshot.lock().unwrap() = snapshot.clone();
    let _ = app.emit("snapshot", &snapshot);
}

fn show_dashboard(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[tauri::command]
fn get_snapshot(state: tauri::State<'_, AppState>) -> Snapshot {
    state.snapshot.lock().unwrap().clone()
}

#[tauri::command]
fn get_workspaces(state: tauri::State<'_, AppState>) -> Vec<String> {
    state.settings.lock().unwrap().workspaces.clone()
}

#[tauri::command]
fn set_workspaces(app: AppHandle, state: tauri::State<'_, AppState>, workspaces: Vec<String>) {
    {
        let mut cfg = state.settings.lock().unwrap();
        cfg.workspaces = settings::normalize_slugs(&workspaces);
        settings::save(&app, &cfg);
    }
    tauri::async_runtime::spawn(refresh(app.clone()));
}

#[tauri::command]
fn refresh_now(app: AppHandle) {
    tauri::async_runtime::spawn(refresh(app.clone()));
}

async fn do_login(app: AppHandle) -> Result<String, String> {
    let cfg = app.state::<AppState>().settings.lock().unwrap().clone();
    let anon_key = cfg.anon_key();
    if anon_key.is_empty() {
        return Err("Supabase anon key missing — see desktop/README.md".into());
    }
    let opener_app = app.clone();
    let session = auth::login(&cfg.supabase_url, &anon_key, move |url| {
        let _ = opener_app.opener().open_url(url, None::<&str>);
    })
    .await?;

    auth::save(&app, &session);
    let name = session.user_name.clone();
    *app.state::<AppState>().session.lock().unwrap() = Some(session);
    refresh(app).await;
    Ok(name)
}

#[tauri::command]
async fn login(app: AppHandle) -> Result<String, String> {
    do_login(app).await
}

#[tauri::command]
fn logout(app: AppHandle, state: tauri::State<'_, AppState>) {
    auth::clear(&app);
    *state.session.lock().unwrap() = None;
    tauri::async_runtime::spawn(refresh(app.clone()));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            get_workspaces,
            set_workspaces,
            refresh_now,
            login,
            logout
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            *app.state::<AppState>().settings.lock().unwrap() = settings::load(&handle);
            *app.state::<AppState>().session.lock().unwrap() = auth::load(&handle);

            let menu = build_menu(&handle, &Snapshot::default())?;
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(app.default_window_icon().expect("bundled icon").clone())
                .tooltip("contributor.info")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    let id = event.id().as_ref();
                    match id {
                        "open-site" => {
                            let _ = app.opener().open_url(SITE, None::<&str>);
                        }
                        "dashboard" => show_dashboard(app),
                        "refresh" => {
                            tauri::async_runtime::spawn(refresh(app.clone()));
                        }
                        "login" => {
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                if let Err(e) = do_login(app.clone()).await {
                                    eprintln!("sign-in failed: {e}");
                                    let _ = app.emit("login-error", e);
                                }
                            });
                        }
                        "logout" => {
                            auth::clear(app);
                            *app.state::<AppState>().session.lock().unwrap() = None;
                            tauri::async_runtime::spawn(refresh(app.clone()));
                        }
                        "quit" => app.exit(0),
                        other => {
                            if let Some(slug) = other.strip_prefix("ws:") {
                                let _ = app.opener().open_url(format!("{SITE}/i/{slug}"), None::<&str>);
                            }
                        }
                    }
                })
                .build(app)?;

            // Poll loop: refresh immediately, then every POLL_INTERVAL.
            tauri::async_runtime::spawn(async move {
                loop {
                    refresh(handle.clone()).await;
                    tokio::time::sleep(POLL_INTERVAL).await;
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // The dashboard hides instead of closing so the tray app lives on.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
