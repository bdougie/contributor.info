/**
 * HTTP surface for the social-card endpoint: query-param parsing and
 * response headers. Kept separate from the handler so it stays unit-testable
 * without a function runtime.
 */

export type CardType = 'home' | 'repo' | 'user';

export interface CardRequest {
  type: CardType;
  owner: string | null;
  repo: string | null;
  username: string | null;
}

// Same constraint the Fly service enforced: GitHub-safe name characters only.
const NAME_PATTERN = /^[a-zA-Z0-9_.-]+$/;

export function sanitizeName(value: string | null): string | null {
  if (!value) return null;
  if (value.length > 100) return null;
  return NAME_PATTERN.test(value) ? value : null;
}

/**
 * Resolve the requested card from the URL. Malformed or missing params fall
 * back to the home card rather than erroring — a crawler should always
 * receive an image.
 */
export function parseCardRequest(url: URL): CardRequest {
  const segment = url.pathname.replace(/\/$/, '').split('/').pop() ?? '';
  const owner = sanitizeName(url.searchParams.get('owner'));
  const repo = sanitizeName(url.searchParams.get('repo'));
  const username = sanitizeName(url.searchParams.get('username'));

  if ((segment === 'repo' || segment === 'social-cards') && owner && repo) {
    return { type: 'repo', owner, repo, username: null };
  }
  if ((segment === 'user' || segment === 'social-cards') && username) {
    return { type: 'user', owner: null, repo: null, username };
  }
  return { type: 'home', owner: null, repo: null, username: null };
}

export interface CardTimings {
  dataMs: number;
  resvgMs: number;
  /** Avatar stage: fetch duration and "fetched/wanted" counts (repo cards). */
  avatarsMs?: number;
  avatarsDesc?: string;
}

// 'database' = stats fetched; 'fallback' = query failed or repo unknown,
// zeros rendered; 'none' = card type needs no data.
export type DataSource = 'database' | 'fallback' | 'none';

// Bump to force every cached card to re-render on the next deploy. Cached
// function responses stay valid across deploys unless the function bundle
// changes — an unchanged bundle (e.g. an empty commit) invalidates nothing.
export const CARD_VERSION = '3';

/**
 * Durable CDN caching keyed on the card params: each unique card renders
 * roughly once globally, then serves from Netlify's edge (~25ms) — a crawler
 * never waits on Supabase or a render. Stats refresh daily via
 * stale-while-revalidate, so revalidation never blocks a request either.
 *
 * Netlify's CDN cache key ignores the query string unless told via
 * Netlify-Vary — without it, every card URL would serve whichever card
 * rendered first.
 */
export interface CardHeaderOptions {
  /**
   * The render is missing data it should have had (stats fallback on a
   * transient failure, or contributors without avatars). Cache it briefly
   * instead of durably so the card heals within the hour — a hiccup must
   * not get locked into the durable cache for a day.
   */
  degraded?: boolean;
}

export function cardHeaders(
  t: CardTimings,
  dataSource: DataSource,
  opts: CardHeaderOptions = {}
): Record<string, string> {
  const cdnCache = opts.degraded
    ? 'public, s-maxage=3600, stale-while-revalidate=86400, durable'
    : 'public, s-maxage=86400, stale-while-revalidate=604800, durable';
  const avatarSegment =
    t.avatarsMs !== undefined
      ? `, avatars;dur=${t.avatarsMs.toFixed(1)};desc="${t.avatarsDesc ?? ''}"`
      : '';
  return {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=3600',
    'Netlify-CDN-Cache-Control': cdnCache,
    'Netlify-Vary': 'query=owner|repo|username',
    // Tag durable-cached cards so they can be purged by tag (purge API)
    // without a full-site cache flush.
    'Netlify-Cache-Tag': 'social-cards',
    'Server-Timing': `data;dur=${t.dataMs.toFixed(1)}, resvg;dur=${t.resvgMs.toFixed(1)}${avatarSegment}`,
    'X-Data-Source': dataSource,
    'X-Card-Version': CARD_VERSION,
    'Access-Control-Allow-Origin': '*',
  };
}

// A failed render must never land in the durable cache in front of a later
// healthy response.
export function errorHeaders(): Record<string, string> {
  return {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };
}
