# Background jobs: pg_cron + pgmq

Phase 3 of the [cost-reduction plan](./cost-reduction-plan.md) (#1853, #1858,
#1859). Supabase is the scheduler and the queue; the `process-job` edge
function is the worker; gh-datapipe Fly machines do the GitHub capture. There
is no Inngest in the path any more.

```
frontend / Netlify fns / webhooks ──▶ POST /functions/v1/queue-event {eventName, data}
   ├─ capture/*         ──▶ datapipe_jobs row + one Fly machine (gh-datapipe)
   ├─ retired event     ──▶ 200 {retired:true}, nothing stored
   └─ anything else     ──▶ enqueue_job(): background_jobs row + pgmq 'jobs' message
                            then process-job is kicked (EdgeRuntime.waitUntil)

pg_cron '* * * * *'  ──▶ drain_jobs_queue()  ──pg_net──▶ process-job   (only if queue depth > 0)
pg_cron (6 schedules)──▶ enqueue_job(...)  or  invoke_edge_function(...)   # former Inngest crons

process-job ──▶ jobs_read(vt=600, qty=5) ──▶ handler ──▶ jobs_delete | jobs_set_vt(backoff) | jobs_archive
```

Migrations: `20261019000002_jobs_queue.sql` (queue, `background_jobs`,
`enqueue_job`, `invoke_edge_function` on Vault, worker wrappers, drain and
housekeeping crons) and `20261019000003_inngest_crons_to_pg_cron.sql` (the
schedules).

## Operator setup

1. Apply both migrations (see the cost-reduction plan for the Management API
   route while migration history is diverged).
2. Store the service-role key in Vault. Until it exists every cron runs, logs a
   `NOTICE`, and calls nothing:
   ```sql
   select vault.create_secret('<service role key>', 'service_role_key');
   ```
   `invoke_edge_function()` defaults to this project's URL; override with a
   `supabase_url` Vault secret if the project ever moves.
3. Edge function secrets (`supabase secrets set`): `GITHUB_TOKEN`,
   `OPENAI_API_KEY` (embeddings), `SLACK_WEBHOOK_ENCRYPTION_KEY` (Slack
   report), `FLY_DATAPIPE_TOKEN` + `FLY_DATAPIPE_IMAGE` (capture/*). The
   `INNGEST_*` secrets are no longer read by `queue-event`, `process-job`,
   `sync-discussions`, `workspace-sync` or `process-webhook`.
4. Deploy `queue-event`, `process-job`, `sync-discussions`, `workspace-sync`,
   `process-webhook` (all import from `_shared/`).

## Schedules

| pg_cron job | Schedule (UTC) | Runs | Replaces |
|---|---|---|---|
| `process-jobs-queue` | every minute | `drain_jobs_queue()` → `process-job` when the queue is non-empty | Inngest event delivery |
| `jobs-housekeeping` | 03:53 daily | `jobs_housekeeping()`: stuck rows, 30-day purge | — |
| `jobs-classify-repository-size` | 00:13, 06:13, 12:13, 18:13 | job `classify/repository.size` | `classify-repository-size` |
| `jobs-refresh-repository-metadata` | 00:17 daily | job `cron/refresh-repository-metadata` | `refresh-repository-metadata-cron` (steps 1–2) |
| `jobs-slack-assignee-report` | 09:03 daily | job `cron/slack-assignee-report` | `send-slack-assignee-report-cron` |
| `jobs-sync-workspace-priorities` | 00:29, 06:29, 12:29, 18:29 | job `workspace/priorities.sync` | `sync-workspace-priorities` |
| `jobs-compute-embeddings` | 00:37, 06:37, 12:37, 18:37 | job `embeddings/compute.requested` | `compute-embeddings` |
| `jobs-workspace-issues-sync` | 00:47, 06:47, 12:47, 18:47 | edge `workspace-issues-sync` `{hoursBack: 24, limit: 25}` | deleted `capture-workspace-issues.yml` |

Cron-enqueued jobs pass a dedupe window, so a stalled worker never piles up
duplicates of the same schedule.

## Who may send what

The Supabase gateway accepts the public anon key, so `queue-event` decides by
the bearer token it is given:

| Caller | Allowed |
|---|---|
| service role (Netlify functions, webhook background function; `SUPABASE_SERVICE_ROLE_KEY`) | any event |
| signed-in user (the browser sends the session token when there is one) | `capture/*` for a tracked repository, `workspace/priorities.sync` |
| anonymous (anon key) | `capture/*` for a tracked repository |

Retired events are acknowledged for every caller. Anything else answers 403.
`capture/*` from any caller reuses a capture of the same repository and
sources that is queued or running and under ten minutes old, so a page load
or sync button cannot start one Fly machine per request. `discover/*`,
`sync-router/*`, `classify/*` and `embedding*` are server-only; the
`sync-router/*` handlers additionally refuse repositories nobody has tracked.

## Dedupe

`enqueue_job(..., dedupe_window, dedupe_statuses)` returns the id of an
identical active job (same type and `repositoryId`) instead of queueing a new
one. Policies are in `_shared/jobs/retired.ts`:

- item-level embedding events merge into a **queued** job only. A running job
  has already chosen its items, so a later issue or PR gets its own run, and
  the selection query at execution time picks up whatever is still missing.
- whole-table sweeps (`workspace/priorities.sync`, `classify/*`) merge into
  queued **and** processing jobs; a second run would only repeat the first.

Inngest crons that were **not** carried over, because their targets no longer
exist or gh-datapipe already does the work:

| Inngest function | Why |
|---|---|
| `distill-session-knowledge` | `tapes_sessions` / `tapes_knowledge` dropped 2026-04-28 |
| `send-user-slack-monthly-leaderboard-cron` | `user_slack_integrations` dropped 2026-04-28 |
| `scheduled-workspace-aggregation`, `cleanup-workspace-metrics-data` | `workspace_metrics_cache`, `_history`, `_aggregation_queue` dropped 2026-04-28 |
| `enrich-contributors-cron` | reads `contributors.workspace_id`, a column that does not exist; every run threw |
| `batch-generate-embeddings` | per-repository fan-out (the burst pattern that hit the Inngest cap); `compute-embeddings` works the same `items_needing_embeddings` view |
| `sync-discussions-cron`, `sync-workspace-comments-cron` | the gh-datapipe `hourly-sync` machine fetches recent discussions and comments for tracked repositories; each of these would have started one Fly machine per repository |
| `refresh-repository-metadata-cron` step 3 | one `capture/repository.events` per repository nightly; `hourly-sync` covers events |

Also unscheduled: `sync-github-events-hourly` (2025), which called
`github-sync` through the GUC-based `invoke_edge_function()` that never had a
key. `datapipe-hourly` owns `github_events_cache` now.

## Job types

Handlers live in `supabase/functions/_shared/jobs/` and are wired in
`registry.ts`. `capture/*` never reaches a handler: `queue-event` and
`process-job` hand those to `_shared/datapipe-capture.ts`.

| Type | Handler | Notes |
|---|---|---|
| `classify/repository.single` | classify-repositories | writes `tracked_repositories.size/metrics/size_calculated_at` |
| `classify/repository.size` | classify-repositories | ≤ 25 stale repositories per run |
| `discover/repository.new`, `capture/repository.discover` | discover-repository | then enqueues classify + capture |
| `embeddings/compute.requested`, `embeddings.generate`, `embedding/issue.generate`, `embedding/pr.generate`, `embedding/batch.process`, `similarity/repository.recalculate` | embeddings | all reduce to "compute for this repository"; deduped per repository for 10 min |
| `workspace/priorities.sync` | workspace-priorities | |
| `cron/refresh-repository-metadata` | refresh-repository-metadata | ≤ 300 repositories per run |
| `cron/slack-assignee-report` | slack-assignee-report | |
| `sync-router/*` | sync-router | the Netlify `sync-router` function's job types |

Retired events (`workspace.metrics.aggregate`, `workspace.repository.changed`,
`embedding/progress.update`, `capture/commits.*`, `update/pr.activity`) are
listed in `_shared/jobs/retired.ts`; `queue-event` answers them with
`{ success: true, retired: true }`.

## Retries and limits

- A failed delivery is retried by extending the message's visibility timeout:
  60 s, 120 s, 240 s … capped at 1 h. `background_jobs.max_retries` (default
  3) extra deliveries, then the message is archived (`pgmq.a_jobs`) and the
  row marked `failed`.
- `NonRetriableJobError` (bad payload, missing row, missing secret) archives
  immediately.
- One worker invocation takes new messages for 280 s and reads 5 at a time;
  the visibility timeout is 600 s so a slow invocation never overlaps itself.
  Handlers check `ctx.remainingMs()` and stop early rather than hit the
  400 s edge limit; whatever is left waits for the next run.
- Messages read but not handled before the budget ran out are made visible
  again on exit; when under a minute of budget is left the worker reads one
  message at a time.
- An embedding run that lost a batch, or ran out of time with items left,
  throws so the message retries; already-embedded items are excluded by the
  selection query, so the retry only does what is missing.
- Per-isolate circuit breaker: 5 consecutive failures of one job type pause
  that type for a minute.

## Watching it

```sql
-- queue depth, oldest message age
select * from pgmq.metrics('jobs');

-- what ran, and what failed, in the last day
select type, status, count(*), max(duration_ms)
from background_jobs
where created_at > now() - interval '1 day'
group by 1, 2 order by 1, 2;

-- failures with their last error
select id, type, retry_count, error, failed_at
from background_jobs where status = 'failed' order by failed_at desc limit 20;

-- did the crons fire
select jobname, status, start_time, return_message
from cron.job_run_details
where start_time > now() - interval '1 day'
order by start_time desc;

-- archived (given-up) messages
select * from pgmq.a_jobs order by archived_at desc limit 20;
```

The `health-jobs` edge function reports the same `background_jobs` counts.

## Manual operations

```sql
-- run something now
select public.enqueue_job('workspace/priorities.sync', '{"trigger":"manual"}', null, 'manual');

-- re-run a failed or completed row (no queue message; process-job runs it
-- directly; queued/processing rows are refused with 409 because the queue owns them)
-- curl -X POST $SUPABASE_URL/functions/v1/process-job \
--   -H "Authorization: Bearer $SERVICE_ROLE_KEY" -d '{"jobId":"<uuid>"}'

-- drain the queue right now
-- curl -X POST $SUPABASE_URL/functions/v1/process-job \
--   -H "Authorization: Bearer $SERVICE_ROLE_KEY" -d '{"source":"manual"}'
```
