/**
 * Social-card endpoint, served same-origin at /social-cards/:type.
 *
 * Replaces the Fly.io card service for og:image rendering (charts remain on
 * Fly — they need headless Chromium). Technique ported from
 * papercomputeco/console.papercompute.com#157: render in a Node function
 * with native resvg, cache durably at the CDN keyed on the card params, and
 * let pre-warming make crawler fetches cache hits. The old architecture
 * re-rendered on every request behind no CDN, so a cold Fly start plus live
 * Supabase queries regularly blew the 2-5s crawler timeout budget.
 */
import type { Config } from '@netlify/functions';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './_shared/supabase-client.ts';
import { generateSocialCard, type SocialCardData } from './_shared/social-cards/card-generator.ts';
import { fetchAvatarDataUris } from './_shared/social-cards/avatars.ts';
import { fetchGlobalStats, fetchRepoCardData } from './_shared/social-cards/data.ts';
import {
  cardHeaders,
  errorHeaders,
  parseCardRequest,
  type DataSource,
} from './_shared/social-cards/http.ts';
import { renderSvgToPng } from './_shared/social-cards/render.ts';

export default async function handler(req: Request): Promise<Response> {
  try {
    const card = parseCardRequest(new URL(req.url));

    let supabase: SupabaseClient | null = null;
    try {
      supabase = getSupabaseClient();
    } catch {
      // Missing configuration degrades to zero-stat cards rather than a 500.
      console.error('social-cards: Supabase configuration missing, rendering zero-stat card');
    }

    const t0 = performance.now();
    let data: SocialCardData;
    let dataSource: DataSource = 'none';
    if (card.type === 'repo' && card.owner && card.repo) {
      const { stats, avatarUrls } = supabase
        ? await fetchRepoCardData(supabase, card.owner, card.repo)
        : { stats: null, avatarUrls: [] };
      const avatars = await fetchAvatarDataUris(avatarUrls);
      data = { type: 'repo', title: `${card.owner}/${card.repo}`, stats, avatars };
      dataSource = stats ? 'database' : 'fallback';
    } else if (card.type === 'user' && card.username) {
      data = { type: 'user', title: `@${card.username}` };
    } else {
      const stats = supabase ? await fetchGlobalStats(supabase) : null;
      data = { type: 'home', stats };
      dataSource = stats ? 'database' : 'fallback';
    }
    const dataMs = performance.now() - t0;

    const { png, resvgMs } = renderSvgToPng(generateSocialCard(data));
    return new Response(new Uint8Array(png), {
      headers: cardHeaders({ dataMs, resvgMs }, dataSource),
    });
  } catch (error) {
    console.error(
      'Social card generation error: %s',
      error instanceof Error ? error.message : error
    );
    try {
      const { png } = renderSvgToPng(
        generateSocialCard({ type: 'error', title: 'Error', subtitle: 'Failed to generate card' })
      );
      return new Response(new Uint8Array(png), { status: 500, headers: errorHeaders() });
    } catch {
      return new Response('failed to generate card', {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  }
}

export const config: Config = {
  path: ['/social-cards', '/social-cards/:type'],
};
