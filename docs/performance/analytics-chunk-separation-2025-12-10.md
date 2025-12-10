# Analytics Chunk Separation Analysis

**Date:** 2025-12-10
**Issue:** #1280 - Consolidate analytics vendor chunks
**Status:** No change needed - current separation is optimal

## Current State

| Chunk | Size | Gzip | Contents |
|-------|------|------|----------|
| `vendor-analytics` | 157.13 kB | 52.47 kB | PostHog core |
| `vendor-monitoring` | 454.07 kB | 150.52 kB | Sentry + rrweb |

## Loading Patterns

### PostHog (`src/lib/posthog-lazy.ts`)
- **Lazy-loaded** via dynamic `import('posthog-js')`
- Only loads when analytics functions are called
- Session recording deferred for LCP improvement
- Rate-limited to prevent excessive events

### Sentry (`src/lib/sentry-lazy.ts`)
- **Lazy-loaded** via dynamic `import('@sentry/react')`
- Initialized via `requestIdleCallback` with 5s timeout
- Loads during browser idle time after page render
- Error queue buffers exceptions until loaded

## Why Separation is Correct

### 1. Both Already Load Asynchronously
Neither chunk blocks initial page render. HTTP request count doesn't impact LCP because both load after React mounts via `requestIdleCallback` or on-demand.

### 2. Different Loading Triggers
- **Sentry**: Loads 2-5s after page load (idle callback)
- **PostHog**: Loads only when tracking needed (user action, web vitals)

Merging would force both to load together, potentially loading PostHog earlier than needed.

### 3. Bundle Size Consideration
- Combined chunk would be **611 kB** (203 kB gzip)
- If only error tracking is needed, 611 kB vs 454 kB is wasteful
- Session recording (rrweb in Sentry chunk) is heavy and not always needed

### 4. HTTP/2 Multiplexing
Modern browsers use HTTP/2 multiplexing - multiple small chunks load efficiently over a single connection. The "multiple requests" overhead is minimal.

## Measurements

```
Current (2 chunks):
- vendor-analytics: 157.13 kB (52.47 kB gzip)
- vendor-monitoring: 454.07 kB (150.52 kB gzip)
- Total: 611.20 kB (202.99 kB gzip)

Proposed (1 chunk):
- vendor-monitoring: ~611 kB (~203 kB gzip)
- Total: Same bytes, fewer requests
```

## Conclusion

The current separation is intentional and optimal:
1. ✅ No LCP impact (both load after initial render)
2. ✅ Independent loading allows for scenario-specific optimization
3. ✅ HTTP/2 handles multiple requests efficiently
4. ✅ Lazy loading already minimizes initial load impact

**Recommendation:** Keep current separation. The "optimization" would increase coupling without measurable benefit.
