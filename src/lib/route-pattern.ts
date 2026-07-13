/**
 * Maps a raw pathname to the app's route pattern so analytics can be
 * aggregated per route (e.g. p75 LCP for /:owner/:repo across all repos).
 *
 * Kept as a plain string matcher (no react-router dependency) so it can be
 * used from non-React modules like the web-vitals -> PostHog pipeline
 * without pulling router internals into lazily loaded analytics chunks.
 *
 * Patterns mirror the route table in src/App.tsx. Unknown paths fall back
 * to the raw pathname so no data point is ever dropped.
 */

const STATIC_ROUTES = new Set<string>([
  '/',
  '/login',
  '/trending',
  '/workspaces',
  '/workspaces/new',
  '/workspace/new',
  '/changelog',
  '/widgets',
  '/settings',
  '/billing',
  '/privacy',
  '/privacy/data-request',
  '/terms',
  '/spam',
  '/spam/new',
]);

/** Sub-routes nested under /:owner/:repo in src/App.tsx */
const REPO_SUBROUTES = new Set<string>([
  'activity',
  'contributions',
  'health',
  'distribution',
  'feed',
  'widgets',
]);

export function getRoutePattern(pathname: string): string {
  // Normalize trailing slashes (but keep the root path as '/')
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;

  if (STATIC_ROUTES.has(path)) {
    return path;
  }

  // /dev/* and /admin/* pages are static, low-traffic routes - keep as-is
  if (
    path === '/dev' ||
    path.startsWith('/dev/') ||
    path === '/admin' ||
    path.startsWith('/admin/')
  ) {
    return path;
  }

  if (path.startsWith('/invitation/')) {
    return '/invitation/:token';
  }

  if (/^\/workspace\/[^/]+\/[^/]+$/.test(path)) {
    return '/workspace/:id/:tab';
  }
  if (/^\/workspace\/[^/]+$/.test(path)) {
    return '/workspace/:id';
  }

  const segments = path.split('/').filter(Boolean);
  if (segments.length === 1) {
    return '/:username';
  }
  if (segments.length === 2) {
    return '/:owner/:repo';
  }
  if (segments.length === 3 && REPO_SUBROUTES.has(segments[2])) {
    return `/:owner/:repo/${segments[2]}`;
  }

  // Unknown route shape: fall back to the raw pathname
  return path;
}
