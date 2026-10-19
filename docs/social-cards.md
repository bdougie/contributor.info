# Social Cards System

## Overview

The social cards system generates dynamic Open Graph and Twitter Card images for social media sharing. Cards render same-origin in a Netlify Function behind durable CDN caching; chart screenshots (which need headless Chromium) still render on the Fly.io service.

## Architecture (Netlify Function + durable CDN)

Technique ported from papercomputeco/console.papercompute.com#157. The previous Fly.io card endpoint re-rendered on every request with no CDN in front, so a cold Fly start plus live Supabase queries regularly blew a crawler's timeout budget (Twitter ~2–3s, Facebook ~5s) — cards failed to load constantly.

### How it stays fast

- **Render**: `netlify/functions/social-cards.mts` builds the SVG in-process and rasterizes with native `@resvg/resvg-js` (N-API prebuilt binary — no wasm compile, no Chromium). Inter is vendored as subset font data (`_shared/social-cards/font-data.generated.ts`) because Lambda has no system fonts. Measured render: ~70–165ms.
- **Cache**: responses set `Netlify-CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800, durable` and `Netlify-Vary: query=owner|repo|username`. Each unique card renders roughly once globally, then serves from the CDN edge (~25ms); after a day, revalidation happens in the background — never in front of a crawler. Without `Netlify-Vary`, Netlify's CDN cache key ignores the query string and every card URL would serve whichever card rendered first. Error responses are `no-store` so a failure can't poison the durable cache.
- **Pre-warm**: `src/lib/social-cards/prewarm.ts` fetches the card once per unique URL per page load (production only), so by the time someone shares the link the crawler's fetch is a cache hit.
- **Degrade, don't hang**: Supabase lookups race a 1.5s timeout and fall back to zero-stat cards. Missing stats render as zeros — never mock figures.
- **Routing**: `/social-cards/*` is excluded from the `social-meta` edge function so responses are served straight from the CDN cache.

### Endpoints

```
GET https://contributor.info/social-cards/home
GET https://contributor.info/social-cards/repo?owner={owner}&repo={repo}
GET https://contributor.info/social-cards/user?username={username}
```

Charts still render on Fly.io (Playwright/Chromium with a Supabase-storage cache):

```
GET https://contributor-info-social-cards.fly.dev/charts/{chartType}?owner={owner}&repo={repo}
```

The Fly app scales to zero (`fly-social-cards/fly.toml`: `min_machines_running = 0`,
`auto_stop_machines = "suspend"`, `auto_start_machines = true`). Measured
2026-10-19, a stopped machine took ~17 s to serve its first chart (boot,
Chromium launch, render), which no crawler waits for. Charts stay on Fly
(Chromium, and we keep control of the cache); the fix is to keep crawlers off
the cold path:

- **Storage-first for crawlers.** Each render is written to the public
  Supabase Storage bucket `chart-screenshots` at a deterministic path,
  `{chartType}/{owner}/{repo}/{timeRange}-{distributionType}.png` (lowercase).
  `social-meta.ts` HEADs that object (1.5 s budget) and, if it exists and is
  under 24 h old, uses the public object URL as `og:image`. Only a miss sends
  the crawler to the Fly URL. The path and TTL live in both
  `fly-social-cards/src/cache.js` and `social-meta.ts`; change them together.
- **Pre-warm on human view.** `prewarmChartCard` in
  `src/lib/social-cards/prewarm.ts` fetches the Fly chart URL when someone
  views a chart tab, so the screenshot is in storage before the link is
  shared.
- **Suspend, not stop.** On a miss the machine resumes from a memory snapshot
  in well under a second instead of relaunching Chromium. Suspend needs
  <= 2 GB memory and no swap, which the VM block respects.

Storage writes need `SUPABASE_SERVICE_ROLE_KEY` on the Fly app (RLS refuses
the anon key; the logs show `Storage cache write error: new row violates
row-level security policy` when it is missing). Do not raise
`min_machines_running` to hide the cold start.

### Card types

| Type | Content | Data |
|------|---------|------|
| Home | Site branding, global stats (repos, contributors, PRs) | Supabase, cached daily |
| Repo | Weekly PR volume, active contributors | Supabase, cached daily |
| User | Username + branding | None needed |

All cards are 1200x630 PNG (Twitter `summary_large_image`, Open Graph, LinkedIn, Discord/Slack compatible).

## Observability

Card responses carry `Server-Timing: data;dur=…, resvg;dur=…` (Supabase fetch vs rasterize):

```bash
curl -sI 'https://contributor.info/social-cards/repo?owner=vitejs&repo=vite' | grep -i -E 'server-timing|cache'
```

A repeat request served by the CDN shows a cache hit and ~25ms latency.

## Where card URLs are set

- `index.html` — static default `og:image`/`twitter:image`
- `netlify/edge-functions/social-meta.ts` — crawler-facing rewrite for all paths
- `netlify/edge-functions/ssr-{repo,profile,home,workspace-detail}.ts` + `_shared/html-template.ts` — SSR pages
- `src/components/common/layout/meta-tags-provider.tsx` — client-side Helmet tags + pre-warm

## Testing

- Unit tests: `netlify/functions/_shared/social-cards/social-cards.test.ts`
- Dev preview page: `/dev/social-cards` (use a Netlify deploy preview — the function doesn't run under bare `vite dev`)
- Platform validators: [Twitter](https://cards-dev.twitter.com/validator), [Facebook](https://developers.facebook.com/tools/debug/), [LinkedIn](https://www.linkedin.com/post-inspector/)

## Fonts

Regenerate the vendored font subsets with `scripts/social-cards/generate-font-data.mjs` — see `scripts/social-cards/README.md`.

## Environment

The function uses the shared Supabase client (`netlify/functions/_shared/supabase-client.ts`), which needs `SUPABASE_URL`/`VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Netlify environment (already set for other functions). Missing configuration degrades to zero-stat cards rather than errors.

## Migration History

- **Jan 2025**: Netlify Edge Functions → Fly.io Express service (real data, but no CDN, per-request renders, cold starts)
- **Jul 2026**: Card rendering → same-origin Netlify Function with native resvg, durable CDN caching, and pre-warming (PR #1825). Charts remain on Fly.io. The Fly service's card-rendering code was removed; its `/social-cards/*` URLs 301-redirect to contributor.info so og:image URLs cached by social platforms from old shares keep resolving.
- **Oct 2026**: Fly chart service set to scale-to-zero (cost-reduction plan, Phase 1b). Previously one `shared-cpu-2x` machine ran 24/7 for a handful of chart renders a day.
- **Oct 2026**: Chart cards made cold-start proof (cost-reduction plan, Phase 4, #1861): crawlers read the rendered PNG straight from Supabase Storage, chart tabs pre-warm on view, Fly machines suspend instead of stop, storage TTL 6 h → 24 h. The storage tier had silently never worked (anon key vs RLS); the Fly app now needs the service role key.

## Related Documentation

- [Fly.io Service README](/fly-social-cards/README.md) (charts)
- [Meta Tags Provider](/src/components/common/layout/meta-tags-provider.tsx)
