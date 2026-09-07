# Data Sync Scripts

Operational scripts that trigger or backfill GitHub data in Supabase. Most of them send Inngest events rather than writing to the database directly, so they need `INNGEST_PRODUCTION_EVENT_KEY` (or `INNGEST_EVENT_KEY` locally) plus the Supabase URL and key from `.env`.

| Script | Entry point | Purpose |
|--------|-------------|---------|
| `update-tracked-repos.js` | `release.yml`, `update-tracked-repos.yml` | Regenerate `tracked-repositories.txt` and `.json` at the repo root from the database |
| `trigger-pr-activity-updates.js` | `update-pr-activity.yml` | Queue PR activity refreshes for tracked repositories |
| `populate-commits.ts` | `npm run populate-commits` | Capture commits for one repository through `src/lib/capture-commits.ts` |
| `backfill-reviews-comments.mjs` | `node scripts/data-sync/backfill-reviews-comments.mjs [--dry-run]` | Find PRs missing reviews or comments and emit `capture/pr.reviews` and `capture/pr.comments` |
| `backfill-discussion-summaries.mjs` | `node scripts/data-sync/backfill-discussion-summaries.mjs` | Generate LLM summaries for discussions that have none |
| `backfill-pr-stats.js` | `node scripts/data-sync/backfill-pr-stats.js` | Call the `backfill-pr-stats` edge function to recompute PR statistics |
| `refresh-self-selection-data.ts` | `tsx scripts/data-sync/refresh-self-selection-data.ts` | Refresh contribution stats via the `refresh_contribution_stats` RPC |

Repository tracking itself is user-initiated in the app. For a full historical backfill use the GitHub Actions workflow documented in [scripts/github-actions/](../github-actions/).

## Related

- [docs/data-fetching/](../../docs/data-fetching/) - Architecture of the sync pipeline
- [docs/features/progressive-backfill.md](../../docs/features/progressive-backfill.md)
