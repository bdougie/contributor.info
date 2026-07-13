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

/// Reduce a user-entered workspace reference to the bare slug used by the
/// Supabase lookup and by `contributor.info/i/{slug}` links. Accepts a full
/// `/i/{slug}` URL or path and trims surrounding slashes, so `/open-source-repos`,
/// `https://contributor.info/i/open-source-repos`, and `open-source-repos/` all
/// collapse to `open-source-repos`.
pub fn normalize_slug(input: &str) -> String {
    let trimmed = input.trim();
    let after_prefix = match trimmed.rfind("/i/") {
        Some(idx) => &trimmed[idx + "/i/".len()..],
        None => trimmed,
    };
    after_prefix.trim_matches('/').to_string()
}

/// Normalize a list of slugs, dropping any that reduce to empty.
pub fn normalize_slugs(slugs: &[String]) -> Vec<String> {
    slugs
        .iter()
        .map(|s| normalize_slug(s))
        .filter(|s| !s.is_empty())
        .collect()
}

pub fn load(app: &tauri::AppHandle) -> Settings {
    let Some(path) = path(app) else {
        return Settings::default();
    };
    let mut settings: Settings = fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    // Heal any slugs persisted before normalization landed, or hand-edited into
    // settings.json with a stray slash or a pasted `/i/` URL.
    settings.workspaces = normalize_slugs(&settings.workspaces);
    settings
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

#[cfg(test)]
mod tests {
    use super::{normalize_slug, normalize_slugs};

    #[test]
    fn strips_leading_and_trailing_slashes() {
        assert_eq!(normalize_slug("/open-source-repos"), "open-source-repos");
        assert_eq!(normalize_slug("open-source-repos/"), "open-source-repos");
        assert_eq!(normalize_slug("  /open-source-repos/  "), "open-source-repos");
    }

    #[test]
    fn extracts_slug_from_i_url_or_path() {
        assert_eq!(
            normalize_slug("https://contributor.info/i/open-source-repos"),
            "open-source-repos"
        );
        assert_eq!(normalize_slug("contributor.info/i/foo/"), "foo");
        assert_eq!(normalize_slug("/i/foo"), "foo");
    }

    #[test]
    fn passes_through_a_bare_slug() {
        assert_eq!(normalize_slug("open-source-repos"), "open-source-repos");
    }

    #[test]
    fn drops_entries_that_reduce_to_empty() {
        let input = vec!["/".to_string(), "  ".to_string(), "foo".to_string()];
        assert_eq!(normalize_slugs(&input), vec!["foo".to_string()]);
    }
}
