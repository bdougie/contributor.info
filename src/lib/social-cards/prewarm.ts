/**
 * Pre-warms the social-card caches. /social-cards/* caches durably at
 * Netlify's edge keyed on the card params, so a background fetch here means
 * a share link unfurls from cache (~25ms) instead of paying a render in
 * front of a crawler with a 2-5s timeout budget.
 *
 * Chart pages work the same way one level up: a human view of
 * /{owner}/{repo}/{chart} fetches the Fly chart URL, which renders the PNG
 * into the public `chart-screenshots` bucket. The social-meta edge function
 * then points crawlers at that object, so the share never waits on the
 * scale-to-zero Fly app. Keep CHARTS_BASE in sync with
 * netlify/edge-functions/social-meta.ts.
 *
 * Technique ported from console.papercompute.com#157.
 */

const CHARTS_BASE = 'https://contributor-info-social-cards.fly.dev';

const CHART_PATH_PATTERN =
  /^\/([^/]+)\/([^/]+)\/(lottery-factor|self-selection|health|distribution)\/?$/;

// URLs warmed this page load; a failed warm (network error or non-2xx such
// as Fly's 429 rate limit) is dropped so a later view retries.
const warmed = new Set<string>();

function warm(url: string): void {
  // Under `vite dev` the endpoints don't exist and would 404-spam the console.
  if (!import.meta.env.PROD) return;
  if (warmed.has(url)) return;
  warmed.add(url);
  fetch(url)
    .then((response) => {
      if (!response.ok) warmed.delete(url);
    })
    .catch(() => warmed.delete(url));
}

export function prewarmSocialCard(imageUrl: string): void {
  // Only card endpoints benefit; static images are skipped.
  if (!imageUrl.includes('/social-cards/')) return;
  warm(imageUrl);
}

/**
 * Fly chart URL for a chart page path, or null for any other path.
 */
export function chartCardUrlFor(pathname: string): string | null {
  const match = pathname.match(CHART_PATH_PATTERN);
  if (!match) return null;
  const [, owner, repo, chartType] = match;
  if (!owner || !repo || owner.includes('?') || repo.includes('?')) return null;
  // Fly's route names the health chart 'health-factors'.
  const apiChartType = chartType === 'health' ? 'health-factors' : chartType;
  return `${CHARTS_BASE}/charts/${apiChartType}?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`;
}

export function prewarmChartCard(pathname: string): void {
  const url = chartCardUrlFor(pathname);
  if (url) warm(url);
}
