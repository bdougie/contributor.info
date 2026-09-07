# Progressive Loading on the Repository Page

How `/:owner/:repo` gets from a cold request to a fully interactive page, in the order the browser experiences it. Every step names the file that implements it so you can verify it rather than trust it. Audited 2026-09-07 (`tasks/performance-audit-2026-09-07.md`).

The principle behind all of it: **paint the shape first, fill it from the fastest source available, and push everything that does not change what the user sees off the critical path.**

## Timeline

```
0ms     Edge SSR returns full HTML for the repo header + contributor stats
        (netlify/edge-functions/ssr-repo.ts)
        window.__REPO_SSR__ inlined with the repository row
        Cache-Control: s-maxage=300, stale-while-revalidate=3600

~tens   Preloaded chunks arrive in LCP order: vendor-react-core, index,
of ms   vendor-utils, vendor-supabase, vendor-ui (vite.config.ts modulePreload)
        Charts, markdown, analytics are NOT preloaded.

hydrate hydrateRoot() reuses the SSR DOM (src/main.tsx). The Suspense
        fallback returns null until hydration completes, so the SSR markup
        is never replaced by a skeleton (src/App.tsx PageSkeleton).

first   useRepositoryTracking and useCachedRepoData seed useState from
render  module caches. On a warm navigation nothing flashes "loading".
        getRepositoryByOwnerName() consumes __REPO_SSR__ instead of querying.

first   One Supabase read, .limit(500), for PRs; direct commits in parallel
data    (src/lib/supabase-pr-data-smart.ts, src/hooks/use-cached-repo-data.ts)
        Status banners are held back 800ms so a fast cache hit never flashes
        "Getting familiar with ...".

idle    Background sync event fired via runWhenIdle() if data is stale (>6h)
        Web vitals monitoring starts, reporting to Supabase only.
        Route prefetch for hovered links.

on      Charts mount through ProgressiveChart once they intersect the viewport
scroll  (src/components/ui/charts/ProgressiveChart.tsx)

first   PostHog loads (or at 5s if the user never interacts).
input   Session recording is delayed a further 30s.

5s      Progressive-capture modules load on idle; smart notifications wait
        another 3s before queuing capture jobs (src/App.tsx:428-448).
```

## Layer 1: edge SSR shell

`netlify.toml` routes `/:owner/:repo` to the `ssr-repo` edge function, with an `excludedPath` list for every static route that also has two segments. The function:

- fetches the asset manifest, the repository row, and contributor stats in one `Promise.all` (`netlify/edge-functions/ssr-repo.ts:466-470`);
- renders the real header and contributor avatars when the repo exists, and a **skeleton with the correct layout** when it does not, so a 404 still paints the page shape (`:491`, `:566`);
- inlines `window.__REPO_SSR__` with the minimal repository identity (`:64-86`). The payload is stringified, `<` is escaped to the `\u003c` sequence, then the string is stringified again and wrapped in `JSON.parse(...)`. That is the only safe way to put untrusted JSON inside a `<script>` block;
- sets `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600` and `X-SSR-Rendered: true` (`:549`, `_shared/html-template.ts:405-420`).

If the manifest cannot be loaded, the function falls back to the SPA shell rather than risk a hydration mismatch.

## Layer 2: hydration without a skeleton flash

`src/main.tsx:84-97` calls `hydrateRoot` when `shouldHydrate()` sees SSR markup in `#root` plus either `__SSR_DATA__` or the `x-ssr-rendered` meta tag (`src/lib/ssr-hydration.ts:194-210`). `markHydrationComplete()` is deferred to `requestIdleCallback` so React's async work finishes first.

The single `<Suspense fallback={<PageSkeleton />}>` around the routes (`src/App.tsx:462`) is hydration-aware:

```tsx
const PageSkeleton = () => {
  if (isSSRPage() && !isHydrationComplete()) return null; // keep SSR HTML
  if (isRepoRoute()) return <RepoViewSkeleton />;         // SPA navigation
  ...
};
```

Two details make this work. `RepoViewSkeleton` is imported eagerly (`src/App.tsx:15`) so the fallback can never suspend itself. And `isRepoRoute()` parses `window.location.pathname` synchronously because the fallback renders outside the router context and cannot call `useParams`. Its exclusion list (`src/App.tsx:212-227`) must match the one in `netlify.toml` and the one in `src/lib/progressive-capture/smart-notifications.ts:813-830`.

The skeleton itself (`src/components/skeletons/layouts/repo-view-skeleton.tsx:16-44`) renders the real `owner/repo` text in the breadcrumb, not a gray bar, so the breadcrumb never shifts.

## Layer 3: state seeded from caches, not from "loading"

Every hook on the page that could show a loading state reads a module-level cache **inside its `useState` initializer**, so a remount (tab switch, back navigation) renders the final state on the first frame.

`src/hooks/use-cached-repo-data.ts:85-107`:

```ts
const cacheKey = `${owner}/${repo}/${timeRange}`;
const cachedEntry = repoDataCache[cacheKey];
const hasFreshCache = cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_DURATION;

const [stats, setStats] = useState<RepoStats>(
  hasFreshCache ? cachedEntry.stats : { pullRequests: [], loading: true, error: null }
);
```

The cache is 5 minutes, capped at 20 entries with LRU trimming (`:32-70`). The key deliberately excludes `includeBots` because bot filtering is post-processing: toggling it recomputes the lottery factor from cached PRs instead of refetching (`:142-174`).

`src/hooks/use-repository-tracking.ts:30-57` does the same with a `confirmedTrackedRepos` map so a known-tracked repo skips the `checking` state entirely.

## Layer 4: one read, deduped, then background sync on idle

`useCachedRepoData` fires its two network calls in parallel (`:203-206`): `fetchPRDataSmart` and `fetchDirectCommitsWithDatabaseFallback`.

`fetchPRDataSmart` (`src/lib/supabase-pr-data-smart.ts`) is the database-first path. Its docblock says it: *show what we have, fetch what we need in background.*

1. Resolve the repository through `getRepositoryByOwnerName` (`src/lib/utils/repository-helpers.ts:76-100`). This consumes `__REPO_SSR__` one-shot if it matches, otherwise runs one query. Concurrent callers share the in-flight promise, found rows are cached 5 minutes, and misses are **not** cached so the tracking flow can poll for a repo that was just created. Before this existed, the page fired 4-6 identical lookups per view (#1815).
2. One Supabase select with `.limit(500)` (`:169-175`). The `mode: 'basic' | 'full'` option (`:87-166`) trims body, diff stats, reviews and comments for callers that do not need them.
3. Staleness is empty data or `last_updated_at` older than 6 hours (`:188-196`).
4. If stale, the Inngest sync event is fired through `runWhenIdle` (`:198-217`) so the fire-and-forget POST never sits in the pre-LCP waterfall.

`src/lib/supabase-pr-data-smart-deduped.ts` wraps the whole call in `withRequestDeduplication` with a 5-second TTL, which is the import the page actually uses.

`runWhenIdle` (`src/lib/utils/idle-callback.ts`) is the shared helper for all of this: `requestIdleCallback` with a 2s timeout, `setTimeout(100)` on Safari, and it returns a canceller.

## Layer 5: never flash a status the user will not need

`src/components/features/repository/repo-view.tsx:255-270` holds back any non-success data status for 800ms:

```ts
useEffect(() => {
  const shouldShow = !isLoading && !showTrackingCard && dataStatus?.status !== 'success';
  if (shouldShow) timer = setTimeout(() => setDebouncedShowStatus(true), 800);
  else setDebouncedShowStatus(false);
  return () => clearTimeout(timer);
}, [isLoading, showTrackingCard, dataStatus]);
```

On a cache hit the status resolves to `success` within the window and the banner never mounts. `src/components/features/activity/metrics-and-trends-card.tsx:264-270` uses the same trick. Reserved-height slots (`repo-view.tsx:334-342`, `src/styles/cls-fixes.css`) keep the layout stable while the timestamp and status areas are empty.

## Layer 6: charts on intersection

The scatter chart and treemap render through `ProgressiveChart` (`src/components/ui/charts/ProgressiveChart.tsx:65-160`): a skeleton until the container intersects the viewport (`rootMargin: 50px`), then the chart after a short timeout. The component supports a low-fidelity middle stage, but both current callers pass only `skeleton` and `highFidelity`, so in practice it is skeleton → 100ms → chart. The chart skeleton hardcodes the chart's height (`src/components/features/activity/contributions-wrapper.tsx:33-42`) so the swap is CLS-free.

The chart libraries live in their own chunks (`vendor-recharts`, `vendor-uplot`) that the preload allowlist excludes.

## Layer 7: measurement and vendors off the critical path

`src/App.tsx:311-398`:

- Web vitals monitoring is dynamically imported on `requestIdleCallback` (3s fallback) and starts with the Supabase provider only. Every metric is tagged with the route and the repository (`src/lib/web-vitals-analytics.ts:132-135`), which is what the per-route LCP dashboard reads.
- PostHog is imported on the first `mousedown`, `keydown`, `scroll` or `touchstart` (`{ once: true, passive: true }`), with a 5s fallback. After it loads it is added as a second vitals provider.
- Session recording (rrweb, roughly 80KB) waits a further 30s (#1400).

The rule: measure with the lightest thing you own before loading anything a vendor ships.

## Layer 8: background capture, well after LCP

`src/App.tsx:428-448` waits 5s, then imports the three progressive-capture modules on idle. Each self-initializes on import. Smart notifications parse the URL, wait another 3s, and only then check whether the repo needs capture jobs. The background processor polls its queue every 30s, three jobs per batch. None of this can affect first paint by construction.

## What is not on this path

These exist in the tree and read like the loading mechanism, but the repo page does not use them. Treat them as candidates for deletion or adoption, not as documentation of current behaviour.

- `src/hooks/use-progressive-repo-data.ts` and `use-progressive-repo-data-with-error-boundaries.ts`: a critical → full → enhancement tiered loader. Only consumer is `src/components/examples/progressive-repo-view-with-error-boundaries.tsx`. Tests excluded in `vitest.config.ts:76-80`.
- `src/components/ui/charts/lazy-chart-wrapper.tsx` and `src/hooks/use-intersection-loader.ts`: no consumers.
- `src/components/common/optimized-image.tsx`: parallel to `src/components/ui/optimized-image.tsx`, which is the one everything imports.

## Adding something to the repo page

Ask, in order:

1. Does it change what the user sees before first paint? If not, import it dynamically and schedule it with `runWhenIdle`.
2. Can it start from a cache? Seed `useState` from it so remounts do not flash.
3. Can it fail or be slow? Reserve its height and debounce its error/status UI.
4. Does it need the repository row? Go through `getRepositoryByOwnerName`, never a fresh query.
5. Is it a chart or below the fold? Wrap it in `ProgressiveChart` or `React.lazy` inside `<Suspense fallback={null}>`.
6. Is it a vendor SDK? Load it on first interaction with a timed fallback.

Then run `npm run build` and confirm the new code did not land in a preloaded chunk (`vendor-react-core`, `index`, `vendor-utils`, `vendor-supabase`, `vendor-ui`). The Lighthouse CI run on the PR audits `/continuedev/continue` at 4x CPU throttle.

## Related

- `docs/performance/per-route-lcp-dashboard.md` for reading the effect of a change.
- `docs/postmortems/lcp-improvements-dec-2025.md` for why the static-shell approach was abandoned in favour of edge SSR plus hydration.
- `docs/postmortems/2025-08-21-bundle-splitting-attempt.md` for the history behind the current chunking. Its conclusion has since been superseded by `vite.config.ts:173-232`.
- `.agents/skills/performance/` for the repo-agnostic version of these techniques.
