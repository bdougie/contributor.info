//! Minimal reads for workspaces: identity from Supabase REST, aggregated
//! metrics from the site's public `api-workspace-metrics` endpoint.
//!
//! Anonymous requests use the public anon key — RLS lets them read `public`
//! workspaces. When a user session exists, the user JWT rides in the
//! Authorization header instead and RLS widens to the workspaces they own or
//! belong to, including private ones.

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
    /// User JWT when signed in; falls back to the anon key otherwise.
    pub bearer: Option<String>,
    client: reqwest::Client,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub slug: String,
}

/// The glanceable subset returned by the `api-workspace-metrics` endpoint.
/// Every field is `#[serde(default)]` so the endpoint can add fields without
/// breaking older clients.
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
    #[serde(default)]
    pub recent_open_prs: Vec<RecentItem>,
    #[serde(default)]
    pub recent_open_issues: Vec<RecentItem>,
}

/// A clickable recent-item row (open PR or issue) in the tray dropdown,
/// deep-linking to GitHub.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentItem {
    #[serde(default)]
    pub number: i64,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub created_at: String,
}

impl Supabase {
    pub fn new(url: String, anon_key: String, bearer: Option<String>) -> Self {
        Self {
            url,
            anon_key,
            bearer,
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
        let token = self.bearer.as_deref().unwrap_or(&self.anon_key);
        self.client
            .get(format!("{}/rest/v1/{}", self.url, path_and_query))
            .header("apikey", &self.anon_key)
            .header("Authorization", format!("Bearer {token}"))
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

    /// Aggregated workspace metrics from the site's public
    /// `api-workspace-metrics` endpoint, which computes them on demand from the
    /// source tables (the old `workspace_metrics_cache` table was dropped).
    ///
    /// Returns `None` on any non-success response — including the `403` the
    /// endpoint returns for private workspaces — so the caller falls back to the
    /// `no_metrics` state. Passing the user JWT for private workspaces is a
    /// follow-up.
    pub async fn metrics(&self, workspace_id: &str, time_range: &str) -> Option<WorkspaceMetrics> {
        let url = format!(
            "{}/.netlify/functions/api-workspace-metrics?workspace_id={workspace_id}&time_range={time_range}",
            crate::SITE
        );
        let resp = self.client.get(&url).send().await.ok()?;
        if !resp.status().is_success() {
            return None;
        }
        resp.json::<WorkspaceMetrics>().await.ok()
    }
}

#[cfg(test)]
mod tests {
    use super::WorkspaceMetrics;

    /// Contract check against a real `api-workspace-metrics` response: the tray
    /// struct must tolerate fields it doesn't model (`total_issues`,
    /// `closed_issues`) and `null` trend values, and read the flat shape.
    #[test]
    fn deserializes_endpoint_response() {
        let body = r#"{
            "time_range":"90d","total_prs":91,"merged_prs":72,"open_prs":5,
            "draft_prs":0,"avg_pr_merge_time_hours":39.78,"pr_velocity":0.8,
            "total_issues":3,"closed_issues":2,"open_issues":1,
            "issue_closure_rate":66.67,"total_contributors":7,
            "active_contributors":7,"new_contributors":3,"total_stars":581,
            "stars_trend":null,"prs_trend":null,"contributors_trend":null,
            "calculated_at":"2026-07-13T03:01:50.264Z","is_stale":false
        }"#;
        let m: WorkspaceMetrics = serde_json::from_str(body).expect("valid metrics JSON");
        assert_eq!(m.time_range, "90d");
        assert_eq!(m.open_prs, 5);
        assert_eq!(m.merged_prs, 72);
        assert_eq!(m.total_stars, 581);
        assert_eq!(m.new_contributors, 3);
        assert_eq!(m.pr_velocity, Some(0.8));
        assert_eq!(m.stars_trend, None);
        assert!(!m.is_stale);
        // Older endpoint deploys omit the recent-item arrays entirely.
        assert!(m.recent_open_prs.is_empty());
        assert!(m.recent_open_issues.is_empty());
    }

    #[test]
    fn deserializes_recent_items() {
        let body = r#"{
            "time_range":"7d",
            "recent_open_prs":[{
                "number":1824,"title":"Import an org's repos",
                "url":"https://github.com/bdougie/contributor.info/pull/1824",
                "author":"bdougie","repo":"bdougie/contributor.info",
                "created_at":"2026-07-13T10:00:00Z"
            }],
            "recent_open_issues":[{
                "number":900,"title":"Tray shows stale metrics",
                "url":"https://github.com/bdougie/contributor.info/issues/900",
                "author":null,"repo":null,"created_at":""
            }]
        }"#;
        let m: WorkspaceMetrics = serde_json::from_str(body).expect("valid metrics JSON");
        assert_eq!(m.recent_open_prs.len(), 1);
        let pr = &m.recent_open_prs[0];
        assert_eq!(pr.number, 1824);
        assert_eq!(pr.title, "Import an org's repos");
        assert_eq!(pr.url, "https://github.com/bdougie/contributor.info/pull/1824");
        assert_eq!(pr.author.as_deref(), Some("bdougie"));
        let issue = &m.recent_open_issues[0];
        assert_eq!(issue.number, 900);
        assert_eq!(issue.author, None);
    }
}
