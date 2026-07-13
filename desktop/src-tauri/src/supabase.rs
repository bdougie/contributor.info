//! Minimal Supabase REST reads for workspaces.
//!
//! Uses the public anon key — RLS lets anonymous clients read `public`
//! workspaces and their `workspace_metrics_cache` rows (one row per
//! workspace + time_range, refreshed by the site's aggregation cron).
//! Private workspaces need a user JWT; until login lands they resolve to
//! `not_found`.

use serde::{Deserialize, Serialize};

/// Compile-time defaults, overridable in config.json. The URL's project ref
/// is public (it ships in netlify.toml and the site bundle); the anon key is
/// public-by-design but still kept out of the repo — set
/// `VITE_SUPABASE_ANON_KEY` when building, as the web app does.
pub const DEFAULT_URL: &str = match option_env!("VITE_SUPABASE_URL") {
    Some(url) => url,
    None => "https://egcxzonpmmcirmgqdrla.supabase.co",
};
pub const BAKED_ANON_KEY: Option<&str> = option_env!("VITE_SUPABASE_ANON_KEY");

#[derive(Debug, Clone)]
pub struct Supabase {
    pub url: String,
    pub anon_key: String,
    client: reqwest::Client,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub slug: String,
}

/// The glanceable subset of `workspace_metrics_cache`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceMetrics {
    #[serde(default)]
    pub time_range: String,
    #[serde(default)]
    pub total_prs: i64,
    #[serde(default)]
    pub merged_prs: i64,
    #[serde(default)]
    pub open_prs: i64,
    #[serde(default)]
    pub draft_prs: i64,
    #[serde(default)]
    pub avg_pr_merge_time_hours: Option<f64>,
    #[serde(default)]
    pub pr_velocity: Option<f64>,
    #[serde(default)]
    pub open_issues: i64,
    #[serde(default)]
    pub issue_closure_rate: Option<f64>,
    #[serde(default)]
    pub total_contributors: i64,
    #[serde(default)]
    pub active_contributors: i64,
    #[serde(default)]
    pub new_contributors: i64,
    #[serde(default)]
    pub total_stars: i64,
    #[serde(default)]
    pub stars_trend: Option<f64>,
    #[serde(default)]
    pub prs_trend: Option<f64>,
    #[serde(default)]
    pub contributors_trend: Option<f64>,
    #[serde(default)]
    pub calculated_at: Option<String>,
    #[serde(default)]
    pub is_stale: bool,
}

impl Supabase {
    pub fn new(url: String, anon_key: String) -> Self {
        Self {
            url,
            anon_key,
            client: reqwest::Client::builder()
                .user_agent("contributor.info-desktop/0.1")
                .timeout(std::time::Duration::from_secs(15))
                .build()
                .expect("reqwest client"),
        }
    }

    pub fn configured(&self) -> bool {
        !self.anon_key.is_empty()
    }

    async fn rest<T: for<'de> Deserialize<'de>>(&self, path_and_query: &str) -> Option<Vec<T>> {
        self.client
            .get(format!("{}/rest/v1/{}", self.url, path_and_query))
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {}", self.anon_key))
            .send()
            .await
            .ok()?
            .json()
            .await
            .ok()
    }

    pub async fn workspace_by_slug(&self, slug: &str) -> Option<Option<Workspace>> {
        let rows: Vec<Workspace> = self
            .rest(&format!(
                "workspaces?slug=eq.{slug}&is_active=eq.true&select=id,name,slug&limit=1"
            ))
            .await?;
        Some(rows.into_iter().next())
    }

    pub async fn metrics(&self, workspace_id: &str, time_range: &str) -> Option<WorkspaceMetrics> {
        let rows: Vec<WorkspaceMetrics> = self
            .rest(&format!(
                "workspace_metrics_cache?workspace_id=eq.{workspace_id}&time_range=eq.{time_range}&limit=1"
            ))
            .await?;
        rows.into_iter().next()
    }
}
