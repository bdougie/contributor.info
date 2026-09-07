# Scripts

Automation, setup, and maintenance scripts for contributor.info. Every script lives in a folder with its own `README.md` that lists each file, its entry point (`npm run …`, a workflow, or manual), and what it does.

## Rules

- **No secrets in scripts.** Read Supabase URLs, keys, and tokens from the environment. Never inline them, even as fallbacks (see CLAUDE.md).
- **ES modules only.** `package.json` sets `"type": "module"`; a `.js` file using `require()` will not load. Use `.cjs` if CommonJS is unavoidable.
- **Paths are relative to the repo root.** Scripts are run from the root (`node scripts/<folder>/<file>`). When a script builds paths from `__dirname`, remember it is two levels below the root.
- **One-time scripts get deleted.** A data fix, a migration applier, or an incident investigation is removed once its job is done; what it learned goes in a postmortem under `docs/postmortems/`.
- **Every script is documented** in its folder README. If a script is not referenced by `package.json`, a workflow, another script, or a doc, it is a deletion candidate.

## Folders

### Local development

- [`setup/`](./setup/) - `npm run setup`, environment switching, seed data, git hooks
- [`migrations/`](./migrations/) - Migration analysis, validation, and local-safe generation used by CI

### Data operations

- [`data-sync/`](./data-sync/) - Trigger and backfill GitHub data through Inngest and edge functions
- [`embeddings/`](./embeddings/) - Backfill and monitor vector embeddings for workspace items
- [`github-actions/`](./github-actions/) - Progressive backfill, chunk recovery, and failure reporting run by workflows

### Operations and diagnostics

- [`debugging/`](./debugging/) - Inngest and Supabase secret checks, stuck-job repair, commit and build checks
- [`monitoring/`](./monitoring/) - PR data corruption monitor and rollout health report
- [`performance/`](./performance/) - Bundle analysis, Lighthouse, slow-network tests, CDN and database monitors
- [`load-testing/`](./load-testing/) - k6 load tests for the `queue-event` edge function
- [`testing-tools/`](./testing-tools/) - Manual smoke tests for Inngest, GitHub auth, dub.co, and social cards

### Site and assets

- [`assets/`](./assets/) - Image conversion and PWA icon generation
- [`social-cards/`](./social-cards/) - Font data generation for the social-card renderer
- [`sitemap/`](./sitemap/) - Daily sitemap generation
- [`changelog/`](./changelog/) - RSS and Atom feeds from `CHANGELOG.md`

### Analytics and tooling

- [`posthog/`](./posthog/) - PostHog cohort and feature flag setup
- [`utilities/`](./utilities/) - CSP hash, redirect validation, doc linting, evals, tier labeling

## Entry points at a glance

| Command | Script |
|---------|--------|
| `npm run setup` / `setup:verify` / `setup:reset` | `setup/first-time-setup.mjs`, `verify-setup.mjs`, `reset-setup.mjs` |
| `npm run db:seed` / `seed:status` / `db:seed:clean` | `setup/generate-seed-data.mjs`, `check-seed-status.mjs`, `clean-seed-data.mjs` |
| `npm run verify:csp` / `validate:redirects` | `utilities/verify-csp-hash.js`, `validate-redirects.js` |
| `npm run lint:docs` | `utilities/lint-docs.sh` |
| `npm run eval:maintainer` | `utilities/run-maintainer-eval.ts` |
| `npm run similarity:check` | `github-actions/actions-similarity.ts` |
| `npm run recover:chunks` | `github-actions/recover-stuck-chunks.js` |
| `npm run populate-commits` | `data-sync/populate-commits.ts` |
| `npm run generate-sitemap` | `sitemap/generate-sitemap.js` |
| `npm run setup-cohorts` | `posthog/create-posthog-cohorts.js` |
| `npm run test:slow-network` / `analyze:mobile-performance` | `performance/test-slow-network.js`, `analyze-mobile-performance.js` |
| `npm run test-social-cards` / `test:ci-env` | `testing-tools/test-social-cards.js`, `test-ci-environment.js` |
| `npm run check-commits` / `build:lighthouse` | `debugging/check-commits.cjs`, `check-build-clean.js` |

Workflows in `.github/workflows/` call `data-sync/update-tracked-repos.js`, `data-sync/trigger-pr-activity-updates.js`, `github-actions/*.js`, `migrations/*.js`, `performance/compare-web-vitals.js`, `sitemap/generate-sitemap.js`, and `changelog/generate-rss.js`.
