# Workspace Pages Performance Audit (2026-09-07)

Applies the method in `.agents/skills/performance/SKILL.md` to `/workspaces`, `/workspaces/new`, and `/i/:workspaceId` (plus its tabs). Supersedes `tasks/investigate-workspaces-2g-loading.md`, whose fixes landed in #1732 (`1e305f20`); section 4 records what that PR fixed, what it missed, and what regressed since. Every claim cites the tree as of `235f4b4d` (main after #1845) and the `dist/` built 2026-09-07 11:19.

## 1. Baseline

**Lab** (Lighthouse CI run 34151257988 on `codex/workspace-settings-redesign`, mobile, 4x CPU, simulated throttling, `vite preview`, logged out, no edge functions):

| Route | Perf | FCP | LCP | TBT | Script transfer |
|---|---|---|---|---|---|
| `/` | 0.84 | 3.05s | 3.38s | 153ms | 300KB |
| `/workspaces` | 0.76 | 2.96s | 3.80s | 328ms | 303KB |
| `/continuedev/continue` | 0.58 | 3.16s | 5.40s | 628ms | 339KB |

`/i/:workspaceId` is **not audited by Lighthouse CI at all** (`.lighthouserc.json` URL list). It needs auth, and LHCI has no session. There is no reproducible lab number for the page this audit is about. That is the first gap to close (section 5).

**Field** (`web_vitals_events`, last 30 days, `page_path ~ '^/i/'`):

| Navigation | Samples | Sessions | p75 LCP |
|---|---|---|---|
| `navigate` (cold) | 14 | 10 | 2018ms |
| `reload` | 27 | 5 | 842ms |

Ten sessions is not a population. Field data for workspaces is dominated by dogfooding on 4g. Treat 2.0s cold p75 as a hint, not a baseline. `/workspaces` and `/workspaces/new` have no LCP samples at all in 30 days.

**Reproduce the lab number:**

```bash
npm run build && mv dist .lighthouse-build && npx lhci autorun --config=.lighthouserc.json
```

## 2. Critical path for `/i/:workspaceId`

Traced from the response to the first non-skeleton paint.

1. **Edge SSR paints the real page.** `netlify/edge-functions/ssr-workspace-detail.ts` renders name, tier, description, owner avatar, and repo/member counts (`:76-397`), inlines `window.__SSR_DATA__ = { route: 'workspace-detail', data: { workspace } }` (`:474-479`), and sets `s-maxage=300, stale-while-revalidate=3600` (`:483`). `shouldSSR()` is unconditional (`_shared/ssr-utils.ts:53-69`). For a cold visit the LCP element is this HTML.
2. **Preloaded chunks arrive**: `vendor-react-core`, `index`, `vendor-utils`, `vendor-supabase`, `vendor-ui` (`vite.config.ts:250-284`).
3. **Two lazy hops before the page chunk.** `WorkspaceRoutesWrapper` (`src/App.tsx:137-141`) is a `React.lazy` chunk of 152 bytes whose component is `<>{children}</>` (`src/components/features/workspace/WorkspaceRoutesWrapper.tsx`). Then `workspace-page` (109KB), which statically imports `WorkspaceDashboard` (110KB) and, through `WorkspaceService` → `@/lib/inngest/client`, **zod**, which Rollup hoisted into `vendor-ai-sdk` (197KB, 50KB gzip). Verified: `dist/js/workspace-page-*.js` imports named exports from `vendor-ai-sdk-*.js`. The workspace page pays for the AI SDK chunk without using it.
4. **Hydration throws the SSR paint away.** `useWorkspaceDetailSSRData()` (`src/pages/workspace-page.tsx:172`) calls `useSSRData()`, which looks up `getSSRDataForRoute(location.pathname)` (`src/hooks/use-ssr-data.ts:78`). That does an exact string compare against `ssrData.route` (`src/lib/ssr-hydration.ts:158-165`). The edge wrote `'workspace-detail'`; the hook asks for `'/i/<slug>'`. They never match, so `ssrData` is always `null` and the seeding block at `workspace-page.tsx:1217-1242` is dead. `/workspaces` avoids this by passing the literal key (`src/pages/workspaces-page.tsx:330`) and skipping the fetch when the data is under 60s old (`:353-357`). Even with the key fixed, `fetchWorkspace()` starts with `setLoading(true)` (`:1164`) and `loading` initializes to `true` (`:190`), so the SSR HTML is replaced by `WorkspaceDashboardSkeleton` (`:1255-1261`) on every load.
5. **Eight serial Supabase round trips before the dashboard shows** (`fetchWorkspaceCore`, `:388-566`): dynamic `getSupabase()` import (`:396`), `auth.getUser()` (`:400`), `workspaces` row (`:408-413`), `getAppUserId()` (`:429`), `workspace_members` row (`:449-454`), `app_users` row (`:458-462`), member count (`:483-486`), `workspace_repositories` with `repositories` join and **no `.limit()`** (`:492-511`). `setLoading(false)` at `:557`. Queries 2/4 and 5/6/7/8 are independent once the workspace row exists.
6. **Concurrent with step 5**: `WorkspaceContext` (`src/App.tsx:457`) runs `useUserWorkspaces()` on every route (4 serial queries, React Query, 5-min stale). Once repos land: `useWorkspaceGitHubAppStatus` (hand-rolled) and `GitHubMyWorkCard` → `useGitHubWorkspaceWork` → **4 parallel GitHub Search API calls** for signed-in users with `gcTime: 0` (`src/hooks/use-github-workspace-work.ts:20-44`). Added in `8fc24cd0`, after the 2G fix.
7. **After paint**, Phase B (`fetchWorkspaceMetrics`, `:569-1033`) runs three serial waves: four parallel list queries with `.limit(queryLimit)` (`:592-646`), two parallel open-count queries that pull up to 1000 `repository_id` rows each to count client-side (`:912-925`), then a serial contributor-count query (`:944-949`). `metricsLoading` flips with no debounce (`:182`, `:1029`, `:1723`).
8. **Phase C** (`fetchWorkspaceEnrichment`, `:1037-1160`) is fire-and-forget and skipped on slow connections (`:1177`): one `github_events_cache` query per repo, an unlimited `contributors` bio lookup (`:1091-1094`), up to 10 GitHub profile calls, bio writes, and an awaited LLM call (`:1124`). Not gated on idle, not gated on visibility.

Skeletons: `WorkspaceDashboardSkeleton` renders the real dashboard with `loading=true` (`src/components/features/workspace/WorkspaceDashboard.tsx:319-350`), so it is layout-identical. But the route-level fallback is the generic `PageSkeleton` branch (`src/App.tsx:280-303`), because `isRepoRoute()` excludes `/i/` and `/workspaces` (`:218-219`) and no workspace-shaped skeleton exists under `src/components/skeletons/`. SPA navigation into a workspace shows three centered bars, then the dashboard.

Charts: none on the overview. `WorkspaceDashboard` imports only cards and lists (`WorkspaceDashboard.tsx:1-9`). `TrendChart` and `ActivityChart` use lazy uPlot. `RepositoryComparison.tsx` is the only recharts consumer under workspace and has zero importers.

## 3. Critical path for `/workspaces`

- Edge SSR renders real content for both auth states (`ssr-workspaces.ts:515`, `:568`) and the client seed works (`workspaces-page.tsx:330-357`).
- When the seed is stale (>60s) and the user is signed in, the page runs `3 + 3N` serial queries: user, app user, memberships, then a `for` loop per workspace doing repo count, member count, and top-3 repos (`workspaces-page.tsx:406-450`). It does not reuse `useUserWorkspaces`, which `WorkspaceContext` has already resolved with 4 queries.
- In the lab waterfall, before LCP, the browser also downloads `changelog-page`, `feed-page`, `vendor-ai-sdk`, `use-cached-repo-data`, `supabase-pr-data-smart-deduped`, and the command palette. `prefetchCriticalRoutes()` (`src/lib/route-prefetch.ts:174-190`, called from `layout.tsx:161`) prefetches `/changelog`, `/docs`, `/feed` on idle with a 5s timeout. Under 4x CPU throttle "idle" arrives before LCP, and `/feed` transitively pulls the repo-page data layer and zod. On a workspace route none of those are likely next.
- The unauthenticated path is two `head: true` counts in parallel (`:479-487`). Fine.

## 4. What #1732 fixed, missed, and what regressed

| Item from the 2G investigation | Status | Evidence |
|---|---|---|
| One 18-query serial `fetchWorkspace` | Fixed: split into Phase A/B/C, first paint after A | `workspace-page.tsx:388`, `:569`, `:1037`, `:1163-1180` |
| Phase 1 six serial queries | Still serial | `:400`, `:408`, `:429`, `:449`, `:458`, `:483` |
| No limits on PR/issue/review/comment queries | Fixed, `.limit(queryLimit)`, 100 on slow connections | `:606`, `:619`, `:632`, `:645`, `:385` |
| `workspace_repositories` unlimited | Missed, and it is pre-paint | `:492-511` |
| GitHub profile + LLM in critical path | Fixed: moved to un-awaited Phase C, skipped on 2G | `:1104-1124`, `:1177` |
| `useIsSlowConnection` unused | Fixed | `:171`, `:385`, `:1177` |
| SSR hydration refetches everything | Seed code added but dead (route-key mismatch) | `use-ssr-data.ts:78` vs `ssr-workspace-detail.ts:476` |
| Open PR/issue counts via `count: 'exact', head: true` | Not done; still fetches up to 1000 ids per table | `:912-925` |
| `vendor-recharts` on the critical path | No longer true; no chart on the overview | `WorkspaceDashboard.tsx:1-9` |
| (new) 4 GitHub Search calls on the overview | Regression, `8fc24cd0` | `use-github-workspace-work.ts:20-44` |
| (new) zod in `vendor-ai-sdk` on the critical path | Not previously known | `dist/js/workspace-page-*.js` imports from `vendor-ai-sdk-*.js` |

## 5. Ranked fixes

Ordered by the skill's priority list: remove work from the critical path, serve the shape, seed from caches, dedupe and limit, preload precisely, gate on visibility, defer vendors. Each has a verification that a tool can run.

### P0. Make the workspace detail page keep its SSR paint

Change `useSSRData` to accept an explicit route key (as `workspaces-page` does) and pass `'workspace-detail'` from `useWorkspaceDetailSSRData`. Initialize `loading` from `!ssrData?.workspace` and `workspace`/`repositories` from the seed, in the `useState` initializers, not in the effect. In `fetchWorkspace`, do not call `setLoading(true)` when state was seeded; run Phase A as a background refresh and only flip `metricsLoading`.

Also make the edge inline the fields the dashboard needs for first paint (repositories with counts already come from `renderWorkspaceContent`; reuse the same object) so the seed is complete.

Verify: `curl -s https://contributor.info/i/<slug> | grep -c x-ssr-rendered` is 1, then in DevTools with "Disable cache" the `#root` DOM is never replaced by `WorkspaceDashboardSkeleton` (add a data attribute to the skeleton and assert absence in `e2e/`). Field: `/i/` cold-navigate p75 LCP should fall toward the SSR TTFB.

### P0. Get zod out of the AI SDK chunk

In `vite.config.ts` `manualChunks`, add before the `@ai-sdk` test:

```ts
if (id.includes('/node_modules/zod/')) return 'vendor-zod';
```

Then decide whether the workspace page should import the Inngest client statically at all. `WorkspaceService` (`src/services/workspace.service.ts:24`) imports it for event sends that only happen on user actions. Switch to a dynamic `import('@/lib/inngest/client')` inside those methods, or move them to a separate `workspace-events.service.ts` that the page imports lazily.

Verify: `ANALYZE=true npm run build` shows `vendor-zod` separate; `grep -l vendor-ai-sdk dist/js/workspace-page-*.js` returns nothing. Add that grep to the checklist.

### P1. Collapse Phase A from 8 round trips to 3

Given the workspace row, run `[auth.getUser + getAppUserId]` in one `Promise.all`, then `[workspace_members row, app_users row, member count, workspace_repositories]` in another. Add `.limit()` to `workspace_repositories` (tier limits already exist in `src/types/workspace.ts`; use the max). Better: one RPC or a `security_invoker` view that returns workspace + membership + repos in a single call, which also removes the `getAppUserId` hop.

Verify: Network tab shows at most 3 Supabase requests before the dashboard renders. On the `test:slow-network` harness, time to dashboard on Slow 3G drops by roughly 5 RTTs.

### P1. Defer `GitHubMyWorkCard`'s GitHub calls

Gate the four `useQueries` on the card being in the viewport (`ProgressiveSection` pattern from the skill) or on `runWhenIdle`, and raise `gcTime` from 0 to at least the `staleTime` so tab switches within a minute reuse results. Keep `EPHEMERAL_QUERY_META` so it never persists.

Verify: no `api.github.com/search` requests before LCP in the Network tab.

### P1. Replace the client-side open counts

`:912-925` selects up to 2000 `repository_id` rows to count per repo. Use `workspace_preview_stats_secure` (already exists and already computes per-workspace counts) or add a `count_open_by_repository(repo_ids uuid[])` RPC that returns `(repository_id, open_prs, open_issues)`. One round trip, tens of bytes.

Verify: response size of the open-count request under 2KB.

### P2. Route-level skeleton for workspaces

Add `workspace-skeleton.tsx` under `src/components/skeletons/layouts/` matching the header, tab bar, and metric-card grid, and have `PageSkeleton` pick it when the path starts with `/i/` or `/workspaces/`. Import it eagerly. Reuse `WorkspaceDashboardSkeleton` inside it.

Verify: Lighthouse CLS on SPA navigation from `/workspaces` to `/i/<slug>` stays under 0.1 (currently unmeasured).

### P2. Remove the `WorkspaceRoutesWrapper` lazy hop

It is a 152-byte chunk that renders its children. Delete the `lazy()` and the file, or make it a plain import. One fewer request on the critical path.

Verify: `ls dist/js | grep WorkspaceRoutesWrapper` returns nothing.

### P2. Make `/workspaces` reuse `useUserWorkspaces`

The list page rebuilds what `WorkspaceContext` already fetched with 4 queries, using `3 + 3N` serial queries. Read from the React Query cache and render immediately; refetch in the background if stale.

Verify: on a signed-in `/workspaces` load with a stale SSR seed, at most 4 Supabase requests.

### P2. Stop prefetching `/feed` from workspace routes

`prefetchCriticalRoutes` should be route-aware: on `/i/*` and `/workspaces*`, prefetch the sibling tabs the user is likely to click (`WorkspacePRsTab`, `WorkspaceIssuesTab`) instead of `/changelog`, `/docs`, `/feed`. Or drop the fixed list and rely on `usePrefetchOnIntent` on nav links.

Verify: `/workspaces` lab waterfall shows no `feed-page`, `changelog-page`, or `vendor-ai-sdk` before LCP.

### P3. Debounce `metricsLoading`

Same 800ms hold as `repo-view.tsx:255-270` so a warm Phase B never flashes card skeletons.

### P3. Gate Phase C on idle and visibility

Wrap the enrichment call in `runWhenIdle` and only run the bio/LLM step when the activity feed is in view. Add `.limit()` to the `contributors` bio lookup.

### P3. Delete dead code

`src/components/features/workspace/RepositoryComparison.tsx` (recharts, no importers) and its skeleton in `skeletons/AnalyticsSkeletons.tsx:143`. `src/hooks/useWorkspace.ts` appears unused by the page; confirm and remove.

## 6. Gating

- Add an authenticated `/i/<demo-slug>` URL to `.lighthouserc.json`. LHCI supports `extraHeaders`/`puppeteerScript`; the simplest path is a `/i/demo` route that renders `DemoWorkspacePage` without auth (`src/App.tsx:497-503` already routes `/i/demo`). Audit that at warn level until it is stable for three weeks, then promote LCP and CLS to error.
- Add the bundle-graph assertion to CI: `workspace-page-*.js` must not import `vendor-ai-sdk-*.js`. Extend to a small deny-list per route chunk (`workspaces-page` must not import `vendor-recharts`, etc.).
- Fix `.github/workflows/performance-monitoring.yml` to parse `dist/js/` (see `tasks/performance-audit-2026-09-07.md` section 5) so the size table is not empty.
- Add `/i/:workspace` and `/workspaces` to the per-route LCP dashboard (`docs/performance/per-route-lcp-dashboard.md`) so the field number in section 1 has a home.

## 7. Docs

- Mark `tasks/investigate-workspaces-2g-loading.md` superseded by this file (done; banner added).
- After P0 lands, add a "Workspace detail" section to `docs/performance/progressive-loading.md` mirroring the repo-page timeline, so the two SSR-backed pages are documented the same way.
- Note in `docs/performance/README.md` that Lighthouse CI does not cover authenticated routes until section 6 is done.

## 8. Resolution (same day, branch `perf/workspace-loading`)

Everything in section 5 landed except where noted.

| Item | Status |
|---|---|
| P0 SSR seed | Done. Route key fixed in `use-ssr-data.ts`; edge payload carries the full row and repo fields; state seeded in initializers; `fetchWorkspace` no longer resets `loading` after first render. Tests: `src/lib/workspace/__tests__/workspace-ssr-seed.test.ts`, `src/hooks/__tests__/use-ssr-data.test.tsx`. |
| P0 zod out of `vendor-ai-sdk` | Done, and further: `vendor-zod` and `vendor-otel` chunks; `WorkspaceService`, `AddRepositoryModal`, and `event-validation` are dynamic imports; the draft-storage schema in `workspace-onboarding.ts` is hand-written. `workspace-page-*` imports neither `vendor-zod` nor `vendor-ai-sdk`; `vendor-ai-sdk` is now only reachable from the lazy chat panel and shrank from 197KB to 63KB. |
| P1 Phase A collapse | Done: two `Promise.all` waves; `workspace_repositories` limited to 100 and ordered by pin. |
| P1 `GitHubMyWorkCard` deferral | Done: IntersectionObserver (200px) or idle, `gcTime` 60s. |
| P1 open counts | Done via `count_workspace_open_items` RPC (migration `20260907191704`, SECURITY INVOKER, granted to anon/authenticated; advisor clean). Also fixes undercounting past 1000 rows. |
| P2 route skeleton | Done: `WorkspaceSkeleton`, eager import, used for `/i/*` and `/workspaces*` (not `/workspaces/new`). |
| P2 `WorkspaceRoutesWrapper` | Deleted. |
| P2 `/workspaces` reuses React Query | Done: `useUserWorkspaces` + `useCachedAuth`; demo stats via `useQuery` seeded from SSR. |
| P2 route-aware prefetch | Done: `prefetchCriticalRoutes(pathname)` is a no-op on workspace routes. |
| P3 metrics debounce | Done: skeleton held on first load, 800ms debounce on refetch. |
| P3 Phase C on idle + bio limit | Done. |
| P3 dead code | `RepositoryComparison.tsx`, its skeleton, and `useWorkspace.ts` deleted. |
| Gate: `/i/demo` in Lighthouse CI | Done (warn level). |
| Gate: chunk-graph assertion | Done: `scripts/performance/check-chunk-graph.mjs`, wired into `performance-monitoring.yml` in place of the `dist/assets` grep; dead `test:performance` step removed. |
| Gate: per-route LCP dashboard rows | Not done. Add `/i/:workspace` and `/workspaces` when the dashboard is next edited. |

Baseline to compare against after merge: `/workspaces` lab perf 0.76 / LCP 3.80s (section 1). `/i/demo` gets its first number on the PR's Lighthouse run.
