# Testing Tools

Manual smoke tests and probes for external integrations. These are not part of `npm test`; each is run by hand against a local or production environment. Credentials come from `.env`, never from arguments.

## Inngest and queue

| Script | Purpose |
|--------|---------|
| `test-inngest.js` | Smoke test against the local Inngest dev server |
| `test-production-inngest.js` | Send the three production test events before a deploy |
| `test-supabase-queue.js` | Exercise the Supabase `queue-event` edge function |
| `test-pr-comments.mjs` | Emit `capture/pr.comments` for one PR and watch it land |
| `test-repository-issues-with-verification.mjs` | Emit `capture/repository.issues` and verify the rows written |
| `test-review-sync.mjs` | Check that a PR has reviews and comments in the database |
| `test-backfill-endpoints.js` | End-to-end test of the manual backfill Netlify endpoints (`[base-url]` argument, defaults to localhost) |
| `test-idempotency.js` | Send duplicate events and confirm only one is processed |

## Auth and third parties

| Script | Purpose |
|--------|---------|
| `test-github-auth.mjs` | Verify the GitHub token in `.env` can reach the API |
| `test-dub-api-direct.js` | Call the dub.co API directly to validate URL shortening |

## Social cards

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `test-social-cards.js` | `npm run test-social-cards` | Render and validate social cards with Playwright |
| `test-social-card-speed.js` | manual | Measure delivery time from the Fly.io social-cards service |
| `social-elements-testing.md` | doc | How to test social card and dub.co behavior together |

## CI

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `test-ci-environment.js` | `npm run test:ci-env` | Run the unit tests with CI-like environment variables |
| `test-work-inbox-migration.sh` | manual | Exercise work-inbox RLS and state transitions in a disposable PostgreSQL |

## Related

- [docs/testing/](../../docs/testing/) - Testing philosophy and guidelines
- [scripts/load-testing/](../load-testing/) - k6 load tests
