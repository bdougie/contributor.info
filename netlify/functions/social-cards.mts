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
import { fetchGlobalStats, fetchRepoStats } from './_shared/social-cards/data.ts';
import { cardHeaders, errorHeaders, parseCardRequest } from './_shared/social-cards/http.ts';
import { renderSvgToPng } from './_shared/social-cards/render.ts';

export default async function handler(req: Request): Promise<Response> {
  try {
    const card = parseCardRequest(new URL(req.url));

    let supabase: SupabaseClient | null = null;
    try {
      supabase = getSupabaseClient();
    } catch {
      // Missing configuration degrades to zero-stat cards rather than a 500.
    }

    const t0 = performance.now();
    let data: SocialCardData;
    if (card.type === 'repo' && card.owner && card.repo) {
      data = {
        type: 'repo',
        title: `${card.owner}/${card.repo}`,
        stats: supabase ? await fetchRepoStats(supabase, card.owner, card.repo) : null,
      };
    } else if (card.type === 'user' && card.username) {
      data = { type: 'user', title: `@${card.username}` };
    } else {
      data = { type: 'home', stats: supabase ? await fetchGlobalStats(supabase) : null };
    }
    const dataMs = performance.now() - t0;

    const { png, resvgMs } = renderSvgToPng(generateSocialCard(data));
    return new Response(new Uint8Array(png), { headers: cardHeaders({ dataMs, resvgMs }) });
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
