# PRD: Edge SSR for Public Pages

## Project Overview

### Objective
Improve LCP from 5.6s to <2.5s for SEO-critical public pages using Netlify Edge Functions for server-side rendering, while keeping the existing SPA architecture for protected routes.

### Background
- PR #1374 attempted full React Router v7 SSR migration but failed with 502 errors on Netlify
- Issue #1368 identified LCP as the primary performance bottleneck
- Issue #1378 outlined SSR strategy showing only 3 routes need full SSR
- Current `social-meta` edge function proves edge SSR works in this codebase

### Success Metrics
- [ ] LCP < 2.5s on `/`, `/trending`, `/:owner/:repo`
- [ ] Lighthouse Performance score ≥ 74
- [ ] No regression for authenticated routes
- [ ] Deploy preview passes all checks

## Implementation Summary

### Status
All phases implemented, ready for testing on deploy preview.

### Files Created
- `netlify/edge-functions/_shared/supabase.ts` - Supabase client for edge
- `netlify/edge-functions/_shared/html-template.ts` - HTML template utilities
- `netlify/edge-functions/_shared/ssr-utils.ts` - SSR utilities (bot detection, formatting)
- `netlify/edge-functions/ssr-home.ts` - Home page SSR
- `netlify/edge-functions/ssr-trending.ts` - Trending page SSR
- `netlify/edge-functions/ssr-repo.ts` - Repository page SSR
- `src/lib/ssr-hydration.ts` - Client-side hydration utilities
- `src/hooks/use-ssr-data.ts` - React hooks for SSR data

### Files Modified
- `netlify.toml` - Added edge function routes
- `src/main.tsx` - Added hydrateRoot support for SSR pages

## Current State Analysis

### What Works
- SPA with client-side routing (React Router v6)
- `social-meta` edge function for OG tags
- Supabase data fetching via hooks
- All protected routes function correctly

### What's Broken
- LCP 5.6s on public pages (SEO penalty)
- Full SSR migration (PR #1374) gets 502 errors
- No server-rendered content for crawlers

### Why Full SSR Failed
1. 47+ routes converted = large error surface
2. Complex provider tree may have SSR incompatibilities
3. Netlify's RR v7 adapter is relatively new
4. Origin-based SSR has cold start issues

## Architecture

### Request Flow
```text
Request → Netlify Edge
           │
   Match route pattern?
      │                       │
   PUBLIC PAGE            OTHER ROUTES
   /, /trending,          /settings, /admin, etc.
   /:owner/:repo
      │                       │
      ↓                       ↓
  Edge SSR              SPA (index.html)
  Function              Client routing
      │
      ↓
  Pre-rendered HTML
  with embedded data
      │
      ↓
  Client hydrates
```

### SSR Strategy by Route

| Route | SSR Mode | Rationale |
|-------|----------|-----------|
| `/` | Edge SSR | Landing page LCP, first impression |
| `/trending` | Edge SSR | Public data, SEO critical |
| `/:owner/:repo` | Edge SSR | SEO, social cards, most shared |
| `/i/:workspaceId` | SPA | Protected, no SEO need |
| `/settings` | SPA | Protected, no SEO need |
| `/admin/*` | SPA | Protected, no SEO need |
| `/dev/*` | SPA | Internal, no SEO need |

## Implementation Plan

### Phase 1: Foundation (HIGH Priority) ✅
Create base infrastructure for edge SSR.

**Tasks:**
- [x] Create `netlify/edge-functions/ssr-utils.ts` with shared rendering utilities
- [x] Create HTML template function that matches SPA shell
- [x] Set up Supabase server client for edge (similar to `src/lib/supabase-server.ts`)
- [x] Add edge function TypeScript config

**Files Created:**
- `netlify/edge-functions/_shared/supabase.ts`
- `netlify/edge-functions/_shared/html-template.ts`
- `netlify/edge-functions/_shared/ssr-utils.ts`

**Acceptance Criteria:**
- ✅ Utility functions compile without errors
- ✅ HTML template produces valid HTML matching SPA structure

### Phase 2: Home Page SSR (HIGH Priority) ✅
Implement edge SSR for the landing page.

**Tasks:**
- [x] Create `netlify/edge-functions/ssr-home.ts`
- [x] Fetch hero stats from Supabase (total repos, contributors, etc.)
- [x] Render static content + dynamic stats
- [x] Add route in `netlify.toml`
- [x] Ensure client hydration works

**Files Created:**
- `netlify/edge-functions/ssr-home.ts`

**Files Modified:**
- `netlify.toml` - Add edge function route

**Acceptance Criteria:**
- ✅ Home page renders HTML with data on first request
- [ ] No hydration mismatch warnings (verify on deploy)
- [ ] LCP improved (target: <3s) (verify on deploy)

### Phase 3: Trending Page SSR (HIGH Priority) ✅
Implement edge SSR for trending repositories.

**Tasks:**
- [x] Create `netlify/edge-functions/ssr-trending.ts`
- [x] Fetch trending repos from Supabase
- [x] Render repository cards server-side
- [x] Add meta tags for SEO
- [x] Add route in `netlify.toml`

**Files Created:**
- `netlify/edge-functions/ssr-trending.ts`

**Files Modified:**
- `netlify.toml` - Add edge function route

**Acceptance Criteria:**
- ✅ Trending page shows repos on initial HTML
- ✅ SEO meta tags present in source
- [ ] LCP < 2.5s (verify on deploy)

### Phase 4: Repository Page SSR (HIGH Priority) ✅
Implement edge SSR for individual repository pages.

**Tasks:**
- [x] Create `netlify/edge-functions/ssr-repo.ts`
- [x] Parse `:owner/:repo` from URL
- [x] Fetch repository data from Supabase
- [x] Render contributor stats, charts placeholder
- [x] Handle 404 for unknown repos (falls back to SPA)
- [x] Add meta tags with repo-specific OG data
- [x] Add route in `netlify.toml`

**Files Created:**
- `netlify/edge-functions/ssr-repo.ts`

**Files Modified:**
- `netlify.toml` - Add edge function route

**Acceptance Criteria:**
- ✅ Repo pages render with data on first load
- ✅ 404 handling works (falls back to SPA for tracking)
- ✅ Social cards work (OG tags)
- [ ] LCP < 2.5s (verify on deploy)

### Phase 5: Hydration & Client Integration (MEDIUM Priority) ✅
Ensure seamless client-side takeover.

**Tasks:**
- [x] Create hydration entry point that reads SSR data from `window.__SSR_DATA__`
- [x] Create SSR hydration utilities (`src/lib/ssr-hydration.ts`)
- [x] Create React hooks for consuming SSR data (`src/hooks/use-ssr-data.ts`)
- [x] Update main.tsx to use `hydrateRoot` when SSR content exists
- [ ] Test navigation from SSR page to SPA routes (verify on deploy)
- [ ] Test back/forward navigation (verify on deploy)

**Files Created:**
- `src/lib/ssr-hydration.ts`
- `src/hooks/use-ssr-data.ts`

**Files Modified:**
- `src/main.tsx`

**Acceptance Criteria:**
- ✅ Client hydrates using `hydrateRoot` when SSR content present
- [ ] Navigation between SSR and SPA routes is seamless (verify on deploy)
- [ ] No hydration mismatch warnings (verify on deploy)

### Phase 6: Testing & Validation (MEDIUM Priority) ⏳
Comprehensive testing of the hybrid approach.

**Tasks:**
- [x] Build passes without errors
- [x] TypeScript compiles without errors
- [x] Updated netlify.toml with edge function routes
- [x] Updated PRD with implementation status
- [ ] Verify Lighthouse scores on deploy preview
- [ ] Test crawler rendering (Google bot simulation)
- [ ] Test error scenarios (Supabase down, etc.)
- [ ] Add E2E tests for SSR pages (follow-up)

**Acceptance Criteria:**
- ✅ Build passes
- [ ] Lighthouse Performance ≥ 74 (verify on deploy)
- [ ] Google bot sees full content (verify on deploy)
- [ ] Graceful degradation on errors (verify on deploy)

## Technical Guidelines

### Edge Function Constraints
- 50ms CPU time limit (soft)
- 512KB response size recommended
- No Node.js APIs (use Web APIs)
- Use `Deno.env.get()` for env vars

### Data Fetching in Edge
```typescript
// Use Supabase client with service role for edge
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);
```

### HTML Template Structure
```typescript
function renderHTML(content: string, data: unknown, meta: MetaTags) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  ${renderMetaTags(meta)}
  <link rel="stylesheet" href="/assets/index.css" />
  <script>window.__SSR_DATA__ = ${JSON.stringify(data)};</script>
</head>
<body>
  <div id="root">${content}</div>
  <script type="module" src="/assets/index.js"></script>
</body>
</html>`;
}
```

### Caching Strategy
```typescript
// Edge function response headers
return new Response(html, {
  headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  },
});
```

## Rollback Plan

If edge SSR causes issues:
1. Remove edge function routes from `netlify.toml`
2. Edge functions remain but are not invoked
3. SPA fallback handles all routes
4. No code changes to main app required

## Dependencies

- Netlify Edge Functions (already configured)
- Supabase client (existing)
- Existing CSS/JS assets from SPA build

## References

- Issue #1368 - Original LCP improvement request
- Issue #1378 - TanStack Start SSR strategy (route table reference)
- PR #1374 - Failed RR v7 migration (learnings)
- `netlify/edge-functions/social-meta.ts` - Working edge function example

## Open Questions

1. Should we use streaming SSR or render complete HTML?
2. Cache invalidation strategy when repo data updates?
3. Should we pre-render at build time for top 100 repos?
