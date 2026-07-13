//! App settings, persisted as JSON in the app config dir.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;

use crate::supabase;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// Workspace slugs to surface in the tray (contributor.info/i/{slug}).
    pub workspaces: Vec<String>,
    /// `7d | 30d | 90d | 1y | all` — which metrics-cache row to read.
    pub time_range: String,
    pub supabase_url: String,
    /// Public anon key. Empty means "use the key baked in at build time".
    pub supabase_anon_key: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            workspaces: Vec::new(),
            time_range: "7d".into(),
            supabase_url: supabase::DEFAULT_URL.into(),
            supabase_anon_key: String::new(),
        }
    }
}

impl Settings {
    pub fn anon_key(&self) -> String {
        if !self.supabase_anon_key.is_empty() {
            return self.supabase_anon_key.clone();
        }
        supabase::BAKED_ANON_KEY.unwrap_or_default().to_string()
    }
}

fn path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("settings.json"))
}

pub fn load(app: &tauri::AppHandle) -> Settings {
    let Some(path) = path(app) else {
        return Settings::default();
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(app: &tauri::AppHandle, settings: &Settings) {
    let Some(path) = path(app) else { return };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    if let Ok(json) = serde_json::to_string_pretty(settings) {
        let _ = fs::write(path, json);
    }
}
