---
name: performance
description: Audit, improve, and verify frontend loading performance in SPAs (React + Vite first, but the method is framework-agnostic). Use when asked about LCP, CLS, INP, bundle size, code splitting, chunking, lazy loading, progressive loading, skeletons, hydration flashes, slow pages, Lighthouse scores, or "why does this route feel slow". Also use before adding any new data fetch, vendor SDK, chart, or initialization code to an existing page.
version: 1.0.0
tags: [performance, web-vitals, lcp, cls, bundle, code-splitting, progressive-loading, ssr, hydration, react, vite]
---

# Performance

Make pages paint the right thing first, fill it from the fastest source, and keep everything else off the critical path. Then prove it with a measurement a tool can repeat.

## The method

Work in this order. Skipping to step 3 is how repos end up with lazy wrappers nobody uses and budgets nobody enforces.

1. **Measure before touching anything.** Get one number you can reproduce: a Lighthouse run at mobile 4x CPU throttle against the exact route, or the p75 LCP for that route from real-user monitoring. Record the command. See `references/measurement.md`.
2. **Draw the critical path for the route.** What must arrive before the largest visible element paints? Trace it from the HTML response through preloaded chunks, the first data fetch, and the first render. Anything not on that path is a deferral candidate. Use the checklist in `references/progressive-loading.md#tracing-a-route`.
3. **Apply techniques in priority order.** Cheapest, highest-leverage first:
   1. Remove work from the critical path (idle-defer, dynamic import, drop). This beats every other change.
   2. Serve the shape first (SSR shell or eager skeleton), then hydrate without replacing it.
   3. Seed state from caches so remounts never show "loading".
   4. Dedupe and parallelize the first data fetches; add limits.
   5. Preload exactly the chunks the first paint needs and nothing more.
   6. Gate below-the-fold work on intersection.
   7. Load vendor SDKs on first interaction with a timed fallback.
4. **Verify with the same measurement, then gate it.** A change that cannot be seen in the number you recorded in step 1 is not a performance change. Once it is, add or tighten the CI assertion so it cannot regress. See `references/measurement.md#gating`.
5. **Document what you did, not what you hope.** Quote live config, cite file and line, never paste a kB figure that no script reproduces. Old numbers rot in weeks and mislead the next reader.

## Rules that hold across repos

- **Idle-defer anything whose result is not visible at first paint.** Analytics, persistence setup, background sync triggers, prefetching, feature flags for below-the-fold UI. Use `requestIdleCallback` with a timeout and a `setTimeout` fallback for Safari. Return a canceller.
- **Never replace server-rendered HTML with a skeleton.** A Suspense fallback that renders during hydration of SSR markup causes a flash and a CLS hit. Return `null` until hydration completes; show the skeleton only on client-side navigation.
- **A skeleton must be the same height as what replaces it**, and it must not itself suspend. Import skeleton components eagerly.
- **Read caches inside `useState` initializers**, not in effects. An effect that copies cache to state still renders one "loading" frame.
- **Debounce error and status banners.** If a banner would resolve within a few hundred ms on a cache hit, hold it back that long. Users should never see a state that was true for 40ms.
- **Cache misses are not cacheable when something polls for the entity to appear.** Cache found rows with a TTL; let nulls and errors fall through.
- **One preload allowlist, hand-written.** The bundler's default is to preload every static import of the entry. Filter that set to the chunks the LCP element needs and order them by need.
- **Do not split what shares React's runtime blindly.** Substring matches on module ids are order-sensitive: `@sentry/react` and `@ai-sdk/react` match `react/`. Test the exceptions before the general rule. Do not chunk libraries whose helpers get hoisted into a shared chunk that then forces eager loading (markdown toolchains are the usual offender); let dynamic `import()` split them.
- **Turn off the host's post-build JS processing** (Netlify's bundle/minify, similar CDN features) when the bundler already did it. It reorders module initialization.
- **Load vendors on first interaction.** `mousedown | keydown | scroll | touchstart` with `{ once: true, passive: true }`, plus a 5s fallback so users who never touch the page are still counted. Delay session replay another 30s.
- **Tag every RUM metric with the route and the entity** (repo, workspace, document id). A p75 for the whole site hides the one route that is slow.
- **Lighthouse asserts on the landing route as errors; secondary routes as warnings** until they are stable. A flaky error-level gate gets disabled within a month.
- **Never write a budget you do not enforce.** If the doc says "JS < 350KB", a CI job must fail at 350KB. Otherwise delete the sentence.

## Anti-patterns to name on sight

- A "progressive" or "tiered" data hook that no route imports. Delete it or wire it in; do not document it.
- A CI bundle-size step that greps a directory the bundler does not emit to, or greps for a warning string whose threshold was later changed. Both pass forever.
- Static HTML shells in a client-rendered SPA. `createRoot` replaces the DOM, so the shell flashes then disappears and TBT rises. Only SSR + `hydrateRoot` makes a shell worth having.
- A `-lazy.tsx` wrapper around a component that is always on screen at first paint. It adds a request and a suspense boundary for nothing.
- Route-exclusion lists duplicated in the edge config, the app's Suspense fallback, and a background module. Generate them from one source or expect drift.
- Docs with kB tables and percentages. They were true for one commit.

## Reference files

- `references/progressive-loading.md` — the layered loading model with copy-pasteable snippets: SSR shell + safe inline data, hydration-aware fallback, cache-seeded hooks, idle deferral, request dedup, debounced status, intersection-gated charts, vendor tiering. Includes the route-tracing checklist.
- `references/bundling.md` — Vite `manualChunks` and `modulePreload.resolveDependencies` patterns, ordering pitfalls, what not to split, host processing interlocks.
- `references/measurement.md` — Lighthouse CI config shape, a bundle-size gate that actually runs, per-route RUM tagging, slow-network testing, and how to write perf docs that stay true.
- `references/checklist.md` — the pre-merge checklist. Every item is something a script, lint rule, or CI job can check; nothing aspirational.

## Worked example

contributor.info's `/:owner/:repo` page applies every technique above in order. `docs/performance/progressive-loading.md` in that repo walks the timeline with file:line citations, and `tasks/performance-audit-2026-09-07.md` shows what an audit of the surrounding docs found (dead hooks, a no-op CI gate, a reversed postmortem). Use both as the template for auditing another repo.
