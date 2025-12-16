# LCP Improvements Postmortem - December 2025

## Summary

In mid-December 2025, we identified a performance regression where the Lighthouse score dropped from 74 to 68. The primary culprit was Largest Contentful Paint (LCP) at 5.6s, well above the 2.5s "good" threshold.

## Timeline

| Date | Event |
|------|-------|
| Dec 16 | Issue #1342 created tracking regression |
| Dec 16 | Sub-issues #1343, #1344, #1346, #1347 created for individual CWV metrics |
| Dec 16 | PR #1367 merged with deferred persistence fix |
| Dec 16 | Issues #1343, #1344, #1346, #1347 closed |

## Root Cause

Multiple factors contributed to the regression:

1. **React Query persistence blocking initial render** - `persistQueryClient` was running synchronously during app initialization
2. **Main thread congestion** - Too much JavaScript executing before first paint
3. **Resource loading order** - Critical resources not prioritized appropriately

## Attempted Solutions

### Static HTML Shell (Reverted)

**Approach:** Pre-render a static HTML shell in `index.html` that displays immediately while React bootstraps.

**Why it failed:**
- React's `createRoot()` **replaces** the DOM entirely rather than hydrating
- This caused a flash of content followed by complete replacement
- Total Blocking Time (TBT) spiked to **1,420ms**
- The "shell" was visible for only milliseconds before being destroyed

**Key Learning:** Static HTML shell patterns only work with:
- Server-side rendering (SSR) with hydration
- Static site generation (SSG) with hydration
- NOT with client-side rendering (CSR) SPAs

### Deferred Query Persistence (Successful)

**Approach:** Use `requestIdleCallback` to defer `persistQueryClient` initialization until the browser is idle.

```typescript
// Before: Blocking initialization
persistQueryClient({ queryClient, persister });

// After: Deferred initialization
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(() => persistQueryClient({ queryClient, persister }));
} else {
  setTimeout(() => persistQueryClient({ queryClient, persister }), 1);
}
```

**Why it worked:**
- Moves non-critical work out of the critical rendering path
- Browser can paint first before processing persistence
- Safari compatibility via `setTimeout` fallback
- Zero impact on functionality

## Metrics Improvement

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Lighthouse Score | 68 | TBD | 74+ |
| LCP | 5.6s | TBD | <2.5s |
| TBT | 250ms | TBD | <200ms |
| FCP | 2.7s | TBD | <1.8s |
| TTI | 4.5s | TBD | <3.8s |

## Recommendations

### Do

1. **Defer non-critical initialization** - Use `requestIdleCallback` or `setTimeout` for work that can wait
2. **Profile before optimizing** - Use Chrome DevTools Performance panel to identify actual bottlenecks
3. **Test hydration assumptions** - If trying SSR patterns, verify they work with your React setup
4. **Measure with real conditions** - Lighthouse throttling simulates slower devices

### Don't

1. **Don't add static HTML shells to CSR SPAs** - They get destroyed immediately by React
2. **Don't assume patterns transfer** - What works in Next.js/Remix won't work in Vite SPA
3. **Don't optimize blindly** - Every optimization should have measurable impact
4. **Don't block initial render** - Move all optional work to idle callbacks

## Best Practices Established

### Deferred Initialization Pattern

```typescript
function deferToIdle(callback: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback);
  } else {
    // Safari fallback
    setTimeout(callback, 1);
  }
}

// Usage
deferToIdle(() => {
  // Non-critical initialization here
});
```

### Critical Path Checklist

When adding new initialization code, ask:

1. Is this needed before first paint? If no, defer it.
2. Does this block the main thread? If yes, break it up.
3. Can users see/interact before this completes? If no, it's critical.
4. Is this fetching data the user sees immediately? If no, defer it.

## Related Issues

- [#1342](https://github.com/bdougie/contributor.info/issues/1342) - Performance regression tracking
- [#1343](https://github.com/bdougie/contributor.info/issues/1343) - FCP improvements
- [#1344](https://github.com/bdougie/contributor.info/issues/1344) - TTI improvements
- [#1346](https://github.com/bdougie/contributor.info/issues/1346) - TBT improvements
- [#1347](https://github.com/bdougie/contributor.info/issues/1347) - LCP improvements

## Related PRs

- [#1367](https://github.com/bdougie/contributor.info/pull/1367) - Defer query-client persistence

## Follow-up Actions

- [ ] Monitor LCP metrics in PostHog dashboard over next week
- [ ] Update #1342 with final metrics once stabilized
- [ ] Consider additional deferrals for PostHog, analytics initialization
- [ ] Document patterns in CLAUDE.md for future reference

---

**Author:** @bdougieyo
**Date:** 2025-12-16
**Status:** Complete
