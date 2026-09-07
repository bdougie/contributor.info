# Performance Scripts

Bundle analysis, Lighthouse checks, and runtime monitoring.

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `test-slow-network.js` | `npm run test:slow-network`, `test:slow-network:fast3g`, `test:slow-network:ci` | Load the built app under throttled network profiles and report timings |
| `analyze-mobile-performance.js` | `npm run analyze:mobile-performance` | Summarize Lighthouse mobile reports against thresholds |
| `compare-web-vitals.js` | `performance-monitoring.yml` | Compare Lighthouse CI web vitals between base and PR branches |
| `check-chunk-graph.mjs` | `npm run build:check-chunks`, `performance-monitoring.yml` | After a build: per-chunk size table from `dist/js`, per-chunk cap (`MAX_CHUNK_KB`, default 600), and a deny-list that fails if a route chunk statically imports a heavy vendor chunk it must not (e.g. `workspace-page-*` → `vendor-ai-sdk`) |
| `analyze-bundle.js` | `node scripts/performance/analyze-bundle.js` | Size report for `dist/assets` after a build |
| `performance-check.js` | `node scripts/performance/performance-check.js` | Bundle-size checks and recommendations without Lighthouse |
| `lighthouse-check.js` | `node scripts/performance/lighthouse-check.js` | Run a Lighthouse audit against a URL |
| `monitor-cdn-performance.js` | `npm run monitor-cdn` | Probe CDN response times for key assets |
| `monitor-database-performance.js` | `npm run monitor-db`, `monitor-db-snapshot`, `monitor-db-reset` | Track slow queries and table statistics over time |

Several of these were moved one directory deeper and still compute paths relative to the old location. See `tasks/docs-audit-2026-09-06.md` for the list.

## Related

- [docs/performance/](../../docs/performance/) - Web vitals monitoring and optimization guides
- [docs/testing/performance-monitoring.md](../../docs/testing/performance-monitoring.md)
