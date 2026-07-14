/**
 * Server-side avatar fetching for social cards. Avatars embed in the SVG as
 * data URIs (resvg decodes PNG/JPEG), so the card is self-contained — the
 * crawler never fetches subresources. Failures degrade to the placeholder
 * circles; a slow avatar must never cost the render its crawler budget.
 */

const FETCH_TIMEOUT_MS = 900;
const AVATAR_SIZE = 80; // 2x the rendered 32px circle

// Avatar URLs come from our own contributors table, but constrain the
// server-side fetch to GitHub's avatar host anyway.
const ALLOWED_HOSTS = new Set(['avatars.githubusercontent.com', 'github.com']);

export function sizedAvatarUrl(avatarUrl: string): string | null {
  try {
    const url = new URL(avatarUrl);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return null;
    // github.com/{username}.png takes `size` and redirects to the CDN,
    // which takes `s` — it converts the param when redirecting.
    url.searchParams.set(url.hostname === 'github.com' ? 'size' : 's', String(AVATAR_SIZE));
    return url.toString();
  } catch {
    return null;
  }
}

async function fetchOne(avatarUrl: string): Promise<string | null> {
  const sized = sizedAvatarUrl(avatarUrl);
  if (!sized) return null;
  try {
    const res = await fetch(sized, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('image/png') && !type.startsWith('image/jpeg')) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return `data:${type.split(';')[0]};base64,${bytes.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Fetch avatars in parallel; failed ones are dropped (not null-padded) so
 * the card renders however many arrived, placeholders for the rest.
 */
export async function fetchAvatarDataUris(avatarUrls: string[]): Promise<string[]> {
  const results = await Promise.all(avatarUrls.map(fetchOne));
  return results.filter((uri): uri is string => uri !== null);
}
