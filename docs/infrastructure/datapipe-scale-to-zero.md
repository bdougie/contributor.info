# gh-datapipe on Fly scale-to-zero

Companion to `cost-reduction-plan.md`. gh-datapipe (open-source-ready/gh-datapipe#265)
runs as a process-less Fly app with no machine running between jobs. This page
covers the contributor.info side: the Supabase objects, the Netlify functions
and the edge-function routing.

## Supabase

Migration `supabase/migrations/20261019000000_datapipe_jobs_and_scheduling.sql`:

| Object | Purpose |
|---|---|
| `datapipe_jobs` | one row per machine run; written by the machine via `--job-id` |
| `datapipe_machines` | `hourly-sync` and `daily` machine IDs, updated after each gh-datapipe deploy |
| `datapipe_start_machine(job_type)` | inserts a row and starts the stopped machine through pg_net |
| `datapipe_freshness_check()` | every 3 h: starts a sync if any core table is older than 30 h |
| `datapipe_housekeeping()` | daily: fails stuck rows, purges rows older than 30 days |
| cron `datapipe-hourly` `7 * * * *`, `datapipe-daily` `0 2 * * *` | the clock |

After applying the migration:

```sql
select vault.create_secret('<fly deploy token>', 'fly_datapipe_token');
insert into datapipe_machines (name, fly_machine_id)
values ('hourly-sync', '<id>'), ('daily', '<id>')
on conflict (name) do update set fly_machine_id = excluded.fly_machine_id;
```

Until both exist the cron jobs run, log a NOTICE, and start nothing.

## Netlify functions

`backfill-trigger`, `backfill-status`, `backfill-cancel` use
`lib/datapipe-jobs.mts` and `lib/fly-machines.mts`. A trigger creates the job
row, then a Fly machine with `auto_destroy` that runs
`unified_workspace_backfill.py --job-id <row>`. Status is read from the row.

Env: `FLY_DATAPIPE_TOKEN`, `FLY_DATAPIPE_IMAGE`, optional `FLY_DATAPIPE_APP`
(default `gh-datapipe-sync`) and `FLY_DATAPIPE_REGION` (default `iad`), plus
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. `GH_DATPIPE_KEY` and
`GH_DATPIPE_API_URL` are gone.

The chat tools that used the gh-datapipe `/api/v1` DuckDB service now read
Supabase directly through `lib/repo-analytics.mts` with the same response
shapes.

## Edge functions (Phase 4)

`supabase/functions/_shared/datapipe-capture.ts` maps every former Inngest
`capture/*` event to a `--sources` list (table in
`gh-datapipe/docs/capture-event-mapping.md`). `queue-event` routes `capture/*`
straight to it, creating a `datapipe_jobs` row and a Fly machine, and
`process-job` does the same for `capture/*` rows. Edge env: `FLY_DATAPIPE_TOKEN`,
`FLY_DATAPIPE_IMAGE`.

Known gap: gh-datapipe lands reviews in `github_events_cache`, not the `reviews`
table. See the mapping doc.

## Debugging

See `gh-datapipe/docs/operational-runbook.md` ("Fly Scale-to-Zero and pg_cron
Scheduling") for the `cron.job_run_details`, `net._http_response` and
`datapipe_jobs` queries.
