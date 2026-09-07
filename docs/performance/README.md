# Performance Documentation

Guides for measuring and improving contributor.info performance. Historical
bundle-splitting experiments live in
[postmortems/2025-08-21-bundle-splitting-attempt.md](../postmortems/2025-08-21-bundle-splitting-attempt.md).

## Monitoring

- [PostHog Web Vitals](./posthog-web-vitals.md) - How Core Web Vitals are captured and batched to PostHog
- [Per-Route p75 LCP Dashboard](./per-route-lcp-dashboard.md) - Building the per-route LCP dashboard from the `web_vitals_batch` event

## Optimization Guides

- [Performance Best Practices](./performance-best-practices.md) - Rules of thumb for new code
- [Performance Checklist](./performance-checklist.md) - Checklist to run before shipping a feature
- [Code Splitting Patterns](./code-splitting-patterns.md) - Route and vendor chunking patterns used in `vite.config.ts`
- [Lazy Loading Implementation](./lazy-loading-implementation.md) - Lazy routes, components, and images
- [Image Optimization Guide](./image-optimization-guide.md) - The `OptimizedImage` component and asset pipeline
- [Netlify Compression](./netlify-compression.md) - Built-in Brotli and gzip behavior on Netlify

## Caching

- [Maintainer Roles Caching](./maintainer-roles-caching.md) - Caching strategy for maintainer role lookups

## Related

- [Testing performance monitoring](../testing/performance-monitoring.md)
- [Infrastructure](../infrastructure/) - Deployment and edge function docs
