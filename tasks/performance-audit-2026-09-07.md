# Performance and Perf-Docs Audit (2026-09-07)

Scope: everything under `docs/performance/`, the perf-adjacent docs it links to, the perf CI, and the real loading pipeline of the `/:owner/:repo` page. Every claim below was checked against the working tree on 2026-09-07 (dist built the same morning). File:line citations refer to that tree.

Deliverables produced alongside this audit:

- `docs/performance/progressive-loading.md` — the new, code-verified description of how the repo page loads (SSR shell, hydration-aware Suspense, cache-seeded hooks, idle-deferred background work).
- `.agents/skills/performance/` — a repo-agnostic skill distilled from the techniques that actually work here, symlinked at `.claude/skills/performance`.

## 1. Headline findings

1. **The best performance work in the repo is undocumented.** Edge-function SSR for `/`, `/workspaces`, `/:owner/:repo` and `/:username` (`netlify.toml:74-105`, `netlify/edge-functions/ssr-*.ts`), the hydration-aware Suspense fallback (`src/App.tsx:239-258`), the one-shot `window.__REPO_SSR__` handoff (`netlify/edge-functions/ssr-repo.ts:64-86`, `src/lib/utils/repository-helpers.ts:40-58`), the cache-seeded `useState` initializers (`src/hooks/use-cached-repo-data.ts:85-107`), the request-dedup layer (`src/lib/utils/repository-helpers.ts:59-100`), `runWhenIdle` (`src/lib/utils/idle-callback.ts`), the modulePreload allowlist (`vite.config.ts:250-284`), and the two-tier analytics loading (`src/App.tsx:352-398`) appear in none of the performance docs. `performance-best-practices.md` still lists SSR and service-worker caching as future work; both shipped.
2. **The "progressive loading" the docs describe is not what the repo page runs.** `useProgressiveRepoData` (`src/hooks/use-progressive-repo-data.ts`) implements the critical → full → enhancement tiers the checklist recommends, but its only consumer is `src/components/examples/progressive-repo-view-with-error-boundaries.tsx`. `RepoView` uses `useCachedRepoData`. `LazyChartWrapper` and `useIntersectionLoader` are likewise exported and unused. Anyone reading the docs and grepping for "progressive" lands on dead code.
3. **The bundle-size CI gate is a no-op.** `.github/workflows/performance-monitoring.yml:63,82` greps `dist/assets/*.js`, but Vite emits to `dist/js/` (`vite.config.ts:155-156`), so the table is empty and `total_size` is blank. The second check greps for "larger than 600 kB", but `chunkSizeWarningLimit` is 1300 (`vite.config.ts:246`), so Vite never prints that string. Only `.lighthouserc.json` (script ≤600KB, total ≤2MB) actually gates anything, and only on `/`.
4. **The bundle-splitting postmortem's decision was reversed and nobody updated it.** `docs/postmortems/2025-08-21-bundle-splitting-attempt.md` concludes "never use function-based `manualChunks`, keep Radix with React". `vite.config.ts:173-232` is a function-based `manualChunks` that splits Radix into `vendor-ui` and Recharts into `vendor-recharts`, and it works. The live constraints are different ones: Sentry and `@ai-sdk` must be matched before the `react/` substring test (`vite.config.ts:175-188`, issue #1400).
5. **Every number in the perf docs is unverifiable.** No committed bundle report, no baseline artifact. Chunk names in the docs (`vendor-react`, `vendor-nivo`) no longer exist; `@nivo` is not a dependency.

## 2. Per-doc verdicts

| Doc | Verdict | Stale details (fix or delete) |
|---|---|---|
| `docs/performance/README.md` | Keep, extend | Add `progressive-loading.md`; drop the "historical bundle-splitting" framing once the postmortem is annotated. |
| `docs/performance/code-splitting-patterns.md` | Rewrite to 1/3 length | Lazy wrappers verified. Stale: `manualChunks` snippet (`vendor-react`, `vendor-nivo`), all kB figures, "New Implementation" framing. Missing: Sentry/AI-SDK ordering guards, "markdown deliberately not chunked" (`vite.config.ts:219-223`), `embeddings-excluded`, modulePreload allowlist. |
| `docs/performance/lazy-loading-implementation.md` | Merge into image guide | `rootMargin` prop does not exist (hardcoded `'50px'` at `src/components/ui/optimized-image.tsx:67`); `OptimizedAvatar` uses native `loading`, not IntersectionObserver; preconnect "next step" already done (`index.html:38-42`); all size numbers unverifiable. |
| `docs/performance/image-optimization-guide.md` | Merge with above | Points at `@/components/common/optimized-image` but every consumer imports `@/components/ui/optimized-image`; two parallel components exist (consolidate). `optimize:images` script never added (real script is `optimize-images` → a different file). Vite image-optimizer params (`vite.config.ts:55-58`) undocumented. |
| `docs/performance/performance-best-practices.md` | Keep the "Do/Don't" guidance, cut the process section | `/admin/performance` → `/admin/performance-monitoring` (`src/App.tsx:636`). `test:performance`, `monitor:vitals` scripts do not exist. Budgets (JS <350KB) contradict `.lighthouserc.json` (600KB) and reality (`dist/js` total 4.4MB uncompressed; `index-*.js` 292KB). Slack channel, perf team, monthly reviews, PSI on PRs: none exist. SSR and service worker listed as future work: both shipped. |
| `docs/performance/performance-checklist.md` | Replace with the skill's checklist | Four nonexistent npm scripts (`test:performance`, `test:coverage`, `monitor:vitals`, `report:performance`). "No chunk >200KB" and "CSS <100KB" are both violated today (`dist/css/index-*.css` 160KB). |
| `docs/performance/netlify-compression.md` | Keep, add one paragraph | Caching headers are hand-configured (`netlify.toml:364-382`, `public/_headers:57-65`), not automatic. Curl example uses unhashed `/js/index.js`. Missing the critical interlock: `[build.processing.js] bundle=false, minify=false` (`netlify.toml:18-20`). |
| `docs/performance/maintainer-roles-caching.md` | Keep, trim | Service and consumer verified. Stale: "99% reduction" unbenchmarked; the test blocks shown do not exist; "future IndexedDB persistence" is overtaken by React Query persistence (`src/lib/query-client.ts`). |
| `docs/performance/posthog-web-vitals.md` | Keep (already flagged in the 2026-09-06 audit) | Config claims `autocapture:false` / `capture_pageview:false`; code has both true. |
| `docs/performance/per-route-lcp-dashboard.md` | Keep | Current (Sep 2026). |
| `docs/postmortems/2025-08-21-bundle-splitting-attempt.md` | Keep as history, add a "Superseded" banner | Decision reversed (see finding 4). Broken links: `./production-deployment-2025-06-22.md` (real: `2025-06-22-production-deployment.md`), `../performance/BUNDLE_OPTIMIZATION_2025.md` (missing). |
| `docs/postmortems/lcp-improvements-dec-2025.md` | Keep | Accurate. The `deferToIdle` pattern it introduced now lives in `src/lib/utils/idle-callback.ts` as `runWhenIdle`; link it. Metrics table still says "TBD". |
| `docs/implementations/pr-1282-supabase-lazy-loading-audit.md` | Trim to the design note | `supabase-lazy.ts` verified. Stale: `du -sh dist/assets/*.js` (dir is `dist/js/`), `/admin/performance`, two link texts naming docs that do not exist. Missing the countervailing fact that `vendor-supabase` is now explicitly preloaded (`vite.config.ts:270-284`) because it is on every route's critical path. |
| `docs/testing/performance-monitoring.md` | Fix paths | Dashboard route wrong twice (`/dev/performance-monitoring`, `/performance-monitoring`; real: `/admin/performance-monitoring`). `src/lib/supabase-monitoring.ts` cited three times, does not exist. `/api/health/database` and `/api/health/github` do not exist. |
| `docs/user-experience/invisible-data-loading.md` | Keep | Philosophy and code refs verified. Stale: `process.env.NODE_ENV` (Vite uses `import.meta.env`), example test does not exist, PWA offline listed as future (shipped: `src/lib/service-worker-client.ts:52`, `dist/offline.html`). |

## 3. Enforced vs aspirational

Actually enforced today:

- `.lighthouserc.json` on PRs touching `src/**`, `package.json`, `vite.config.ts`, `index.html` (`.github/workflows/lighthouse-ci.yml`). Error-level on `/` only: LCP ≤4000ms, FCP ≤4000ms, CLS ≤0.1, script ≤600KB, stylesheet ≤100KB, total ≤2MB, perf ≥0.8. The repo page (`/continuedev/continue`) and `/workspaces` are warn-only.
- `react-hooks` lint rules (`eslint.config.js`).
- `verify:csp` before every build (constrains inline critical CSS).

Not enforced by anything:

- Every kB budget quoted in the docs.
- Image `width`/`height`/`loading` rules (no lint rule).
- "Code split if >50KB", debounce/throttle/virtualization rules.
- `src/__tests__/performance/web-vitals.test.ts` is `it.skip` (`:7`). `e2e/performance.spec.ts` is the only live perf test.
- `scripts/performance/compare-web-vitals.js` prints a static checklist and reads no data; the workflow runs it with `|| true`.

## 4. Repo page: what is real vs dead

Real pipeline (documented in `docs/performance/progressive-loading.md`):

1. Edge SSR shell with inlined `window.__REPO_SSR__` (`netlify/edge-functions/ssr-repo.ts`), 5-minute `s-maxage`, 1-hour `stale-while-revalidate` (`:549`).
2. `hydrateRoot` when SSR markup is present, `markHydrationComplete` deferred to idle (`src/main.tsx:83-97`).
3. Suspense fallback returns `null` until hydration completes, then a route-shaped skeleton on SPA navigation (`src/App.tsx:239-258`); `RepoViewSkeleton` is eagerly imported so the fallback cannot itself suspend.
4. `useCachedRepoData` seeds state synchronously from a module cache (5-min TTL, 20 entries) so remounts never flash loading (`src/hooks/use-cached-repo-data.ts:85-107`).
5. `fetchPRDataSmart` does a single `.limit(500)` Supabase read, then defers the background sync trigger with `runWhenIdle` (`src/lib/supabase-pr-data-smart.ts:198-217`).
6. Entity lookup deduped and TTL-cached, misses uncached (`src/lib/utils/repository-helpers.ts:59-100`).
7. Non-success status banners debounced 800ms (`src/components/features/repository/repo-view.tsx:255-270`).
8. Charts render through `ProgressiveChart` (IntersectionObserver-gated, skeleton → chart) (`src/components/ui/charts/ProgressiveChart.tsx`).
9. Web vitals init on idle, Supabase-only provider first; PostHog on first interaction or 5s; session recording at 30s (`src/App.tsx:311-398`).
10. Progressive-capture modules load 5s after mount, then on idle; smart notifications wait a further 3s before queuing (`src/App.tsx:428-448`, `src/lib/progressive-capture/smart-notifications.ts:840-843`).

Dead or misleading:

- `src/hooks/use-progressive-repo-data.ts`, `use-progressive-repo-data-with-error-boundaries.ts`, `src/components/examples/progressive-repo-view-with-error-boundaries.tsx` — unused by any route. Their tests are excluded in `vitest.config.ts:76-80`. Delete or wire in.
- `src/components/ui/charts/lazy-chart-wrapper.tsx`, `src/hooks/use-intersection-loader.ts` — exported, no consumers.
- `src/components/common/optimized-image.tsx` — parallel to `src/components/ui/optimized-image.tsx`; only the `ui/` one is imported.
- `index.html:44-47` `vite-plugin-pwa:modulepreload` markers — plugin not installed; inert comments.
- Font caching headers and CSP allowances for Google Fonts (`public/_headers:19,135-145`, `netlify.toml:435-438`) — the app serves system fonts only.

Debt worth an issue:

- Three hand-maintained route exclusion lists must stay in sync: `src/App.tsx:212-227`, `src/lib/progressive-capture/smart-notifications.ts:813-830`, `netlify.toml:97`.
- `smart-notifications.ts:859-868` monkey-patches `history.pushState` to detect SPA navigation because it lives outside the router.
- `use-cached-repo-data.ts` hand-rolls a cache that React Query (`src/lib/query-client.ts`, already provided at `main.tsx:74`) would give for free with persistence.
- `supabase-lazy.ts` is only lazy for modules that avoid the static `@/lib/supabase` import; `supabase-pr-data-smart.ts:1`, `queue-manager.ts:1`, `smart-notifications.ts:1`, `web-vitals-analytics.ts:1` all import it statically, and the client is now preloaded anyway.

## 5. Defects found (code, not docs)

| Where | Problem | Fix |
|---|---|---|
| `.github/workflows/performance-monitoring.yml:63,82` | greps `dist/assets/` (output is `dist/js/`) | change both patterns to `dist/js/.*\.js` |
| `.github/workflows/performance-monitoring.yml:71` | greps "larger than 600 kB"; Vite prints 1300 | assert on parsed sizes instead of Vite's warning text |
| `.github/workflows/performance-monitoring.yml:320-322` | runs `npm run test:performance` behind an `-f` guard on a path that does not exist | delete the step |
| `src/__tests__/performance/web-vitals.test.ts:7` | `it.skip` | implement or delete |
| `scripts/performance/{analyze-bundle,lighthouse-check,performance-check}.js` | orphaned (no npm script, no workflow) and `__dirname` one level shallow after the folder move | delete, or wire into `package.json` and fix paths (already listed in `tasks/docs-audit-2026-09-06.md`) |

## 6. Recommended doc actions, in order

1. Land `docs/performance/progressive-loading.md` (done) and link it from the README (done).
2. Annotate the 2025-08-21 postmortem with a "Superseded 2026" note pointing at `vite.config.ts:173-232` and the new constraints.
3. Collapse `code-splitting-patterns.md`, `lazy-loading-implementation.md`, `image-optimization-guide.md` into one `bundling-and-assets.md` that quotes the live config and no numbers.
4. Replace `performance-checklist.md` with a pointer to the skill's checklist (`.agents/skills/performance/references/checklist.md`), which only lists checks a tool can run.
5. Fix the route and path errors in `performance-best-practices.md`, `pr-1282-supabase-lazy-loading-audit.md`, `testing/performance-monitoring.md`.
6. Delete the unused progressive hooks and example page, or make `RepoView` use them. Either outcome removes the doc/code contradiction.
