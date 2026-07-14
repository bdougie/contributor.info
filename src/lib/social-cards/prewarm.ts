/**
 * Pre-warms the social-card CDN cache. /social-cards/* caches durably at
 * Netlify's edge keyed on the card params, so a background fetch here means
 * a share link unfurls from cache (~25ms) instead of paying a render in
 * front of a crawler with a 2-5s timeout budget.
 *
 * Technique ported from console.papercompute.com#157.
 */

// Card URLs warmed this page load; a failed warm is dropped so a later
// view retries.
const warmed = new Set<string>();

export function prewarmSocialCard(imageUrl: string): void {
  // Only card endpoints benefit; static images and chart URLs are skipped.
  if (!imageUrl.includes('/social-cards/')) return;
  // Under `vite dev` the endpoint doesn't exist and would 404-spam the console.
  if (!import.meta.env.PROD) return;
  if (warmed.has(imageUrl)) return;
  warmed.add(imageUrl);
  fetch(imageUrl).catch(() => warmed.delete(imageUrl));
}
