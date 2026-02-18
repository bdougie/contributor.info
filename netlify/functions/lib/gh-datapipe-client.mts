/**
 * gh-datapipe Analytics API Client
 *
 * Calls the /api/v1/ analytics endpoints on gh-datapipe.
 * Uses the same GH_DATPIPE_API_URL + GH_DATPIPE_KEY env vars as the backfill client.
 * Returns null (not throws) when the API is unavailable so tools degrade gracefully.
 */

// ---------------------------------------------------------------------------
// Response types — mirrors gh-datapipe Pydantic models
// ---------------------------------------------------------------------------

export interface ContributorActivity {
  prs_opened: number;
  prs_merged: number;
  reviews_given: number;
  issues_opened: number;
}

export interface ContributorAnalytics {
  login: string;
  confidence_score: number | null;
  contribution_quality: number | null;
  activity: ContributorActivity;
}

export interface ContributorsResponse {
  repository: string;
  contributors: ContributorAnalytics[];
  total: number;
}

export interface ContributorRanking {
  login: string;
  weighted_score: number;
  rank: number;
}

export interface LotteryFactor {
  top_contributors: ContributorRanking[];
}

export interface ContributorOfMonth {
  login: string;
  score: number;
  month: string;
}

export interface HealthMetrics {
  trending_score: number;
  freshness_status: 'active' | 'stale' | 'dormant';
  is_significant_change: boolean;
}

export interface InsightsResponse {
  repository: string;
  calculated_at: string | null;
  health: HealthMetrics | null;
  lottery_factor: LotteryFactor | null;
  contributor_of_month: ContributorOfMonth | null;
}

export interface DailyActivity {
  date: string;
  prs_opened: number;
  prs_merged: number;
  reviews: number;
  issues_opened: number;
  issues_closed: number;
}

export interface ActivityResponse {
  repository: string;
  activity: DailyActivity[];
  days: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getConfig(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.GH_DATPIPE_API_URL;
  const apiKey = process.env.GH_DATPIPE_KEY;
  if (!apiUrl || !apiKey) return null;
  return { apiUrl, apiKey };
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const config = getConfig();
  if (!config) return null;

  try {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      console.error('[gh-datapipe] %s returned %d', path, response.status);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error('[gh-datapipe] fetch error for %s: %s', path, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isConfigured(): boolean {
  return getConfig() !== null;
}

export async function getContributors(
  owner: string,
  repo: string,
  limit = 20
): Promise<ContributorsResponse | null> {
  return fetchJson<ContributorsResponse>(
    `/api/v1/repositories/${owner}/${repo}/contributors?limit=${limit}`
  );
}

export async function getInsights(owner: string, repo: string): Promise<InsightsResponse | null> {
  return fetchJson<InsightsResponse>(`/api/v1/repositories/${owner}/${repo}/insights`);
}

export async function getActivity(
  owner: string,
  repo: string,
  days = 30
): Promise<ActivityResponse | null> {
  return fetchJson<ActivityResponse>(`/api/v1/repositories/${owner}/${repo}/activity?days=${days}`);
}
