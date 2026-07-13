//! Read-only client for contributor.info's public JSON API.

use serde::{Deserialize, Serialize};

pub const SITE: &str = "https://contributor.info";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendingRepo {
    pub owner: String,
    pub name: String,
    #[serde(default)]
    pub star_change: f64,
    #[serde(default)]
    pub pr_change: f64,
    #[serde(default)]
    pub contributor_change: f64,
}

#[derive(Deserialize)]
struct TrendingPayload {
    #[serde(default)]
    repositories: Vec<TrendingRepo>,
}

pub async fn trending(client: &reqwest::Client, limit: u8) -> Vec<TrendingRepo> {
    // The pretty /api/trending-repositories path isn't wired up in
    // netlify.toml — the function is only reachable at its raw path.
    let url =
        format!("{SITE}/.netlify/functions/api-trending-repositories?period=24h&limit={limit}");
    match client.get(&url).send().await {
        Ok(resp) => resp
            .json::<TrendingPayload>()
            .await
            .map(|p| p.repositories)
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}
