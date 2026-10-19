# Plan: contributor.info on Supabase + Netlify + Fly (scale-to-zero), no Inngest

Status: in progress, 2026-10-19. Phases 0 and 1 merged; Phase 2 (this
revision) takes the app out of maintenance mode. Fly machines destroyed except
the scale-to-zero social-cards and gh-datapipe-sync apps; Inngest paused after
50k+ executions last month; GitHub Actions workflows disabled except
`progressive-backfill.yml` and `chunk-recovery.yml`. Companion plan for the
data pipeline: `gh-datapipe/docs/plans/2026-10-18-cost-reduction.md`.

## Goal

Bring the app back with Supabase as the only fixed bill plus ~$6/mo of Fly
usage. Netlify (unlimited account) hosts the app and runs request-driven,
background and scheduled functions. Inngest is removed. GitHub Actions stays
free (public repo) and only runs what nothing else does. No new vendors.

## What runs today

| Layer | What | Cost driver |
|---|---|---|
| Netlify | React SPA, 46 functions, 8 edge functions | Unlimited plan |
| Supabase | Postgres, ~50 edge functions incl. `inngest-prod`, `queue-event`, `process-job`, `github-webhook`, `process-webhook`; `background_jobs` table; pg_cron already schedules `github-sync` and cleanup | The bill to keep |
| Inngest | 22 functions via `inngest-prod` (Deno) + 8 via Netlify `inngest-embeddings` (Node). 9 crons, 13+ event-driven. Frontend → edge `queue-event` → `inn.gs` | 50k+ executions/mo, over Hobby; Pro is $99 |
| Fly `contributor-info-webhooks` | Express GitHub App webhook receiver (`app/webhooks/*`). Moved off Netlify because of the 10s sync-function timeout | 512MB always on, ~$4/mo |
| Fly `contributor-info-social-cards` | Playwright/Chromium chart screenshots + redirects for legacy og:image URLs. OG cards already moved to Netlify `social-cards.mts`. **No reference remains in `src/`.** | 2 CPU/2GB always on, ~$12/mo |
| GitHub Actions | 34 workflows, 11 scheduled; `progressive-backfill` every 15 min is the `github_actions` processor in `hybrid-queue-manager.ts` | $0 |

Three schedulers (Inngest, Actions, pg_cron) and three capture engines (Inngest
TS, Actions node scripts, gh-datapipe Python) overlap. The 50k Inngest
executions are mostly cron fan-out across 52 tracked repos plus `capture/*`
events, both of which leave Inngest in this plan.

## Decisions

1. **Inngest → Supabase.** Three buckets:
   - **9 crons → pg_cron** calling the edge functions that already implement
     them, via the existing `invoke_edge_function()` helper. No logic moves.
   - **`capture/*` events → gh-datapipe.** `process-job` starts a Fly datapipe
     machine instead of running the TypeScript capture. Those Inngest
     functions are retired, not ported. Three capture engines become one.
   - **Everything else → pgmq + `process-job`.** `workspace.metrics.aggregate`,
     `workspace.repository.changed`, `workspace/priorities.sync`,
     `embeddings/*`, `discover/repository.new`, `classify/repository.single`.
     All idempotent writes, so whole-message retry is correct; none needs
     sleeps or step memoization. ~8 functions to port from `step.run` bodies
     into `process-job` cases (several already exist there).
   Cloudflare Workflows/Queues is the upgrade path if a job later needs
   per-step durability or a run dashboard. Not needed now.
2. **Webhooks → Netlify Background Function.** Background functions return 202
   immediately and run up to 15 minutes, which removes the reason the Fly box
   existed. `app/webhooks/*` handlers run as-is on Node. Fly webhooks app and
   `webhooks-server/` are deleted.
3. **Social cards → Fly scale-to-zero.** Chromium needs a container; Fly is
   fine for it at `min_machines_running = 0`, `auto_stop_machines = "stop"`,
   woken by the proxy on request (~3–5 s cold start incl. Chromium; the
   Supabase Storage cache covers repeats). Cost ≈ $0.50/mo. Keeps the legacy
   og:image redirects working too.
4. **GitHub Actions: re-enable only `progressive-backfill` and
   `chunk-recovery`** until Phase 4 folds them into gh-datapipe; delete the
   scheduled workflows that duplicate another path.
5. **Netlify: Background + Scheduled Functions are available and unlimited.**
   Prefer pg_cron for anything that is "call an edge function on a timer"
   (one clock, visible in `cron.job_run_details`); use Netlify Scheduled
   Functions only where Node-only code is needed.

## Target

```
GitHub App webhooks ──▶ Netlify Background Function github-webhook-background (202, up to 15 min) ──▶ app/webhooks/* handlers ──▶ Supabase
Browser / Netlify fns ──▶ edge queue-event ──▶ pgmq 'jobs' + background_jobs row
pg_cron every 1 min ──pg_net──▶ edge process-job ──▶ pgmq.read batch ──▶ dispatch by type ──▶ pgmq.delete | retry via visibility timeout
   ├─ capture/* ──▶ Fly Machines API: create datapipe machine (auto_destroy) ──▶ datapipe_jobs
   └─ workspace.* / embeddings/* / discover/* / classify/* ──▶ existing edge-function logic
pg_cron (9 schedules) ──▶ invoke_edge_function(...)       # former Inngest crons
pg_cron "7 * * * *", "0 2 * * *" ──▶ start Fly datapipe machines   # from the companion plan
Netlify ──▶ SPA + functions (chat, api-*, backfill-* → Fly Machines API, social-cards, polar-*)
Fly ──▶ gh-datapipe-sync (stopped between jobs), contributor-info-social-cards (scale-to-zero)
GitHub Actions ──▶ CI on push; progressive-backfill + chunk-recovery (interim)
```

### Queue design (pgmq)

- `select pgmq.create('jobs');` Supabase Queues UI gives visibility for free.
- `queue-event` keeps its idempotency check against `idempotency_keys`, then
  inserts a `background_jobs` row (status `queued`) and `pgmq.send('jobs',
  jsonb_build_object('job_id', id, 'type', name, 'payload', data))`. The
  `sendToInngest()` path is deleted.
- `process-job` is invoked every minute by pg_cron via `pg_net` (and can also
  be invoked directly by `queue-event` for low latency). It
  `pgmq.read('jobs', vt => 600, qty => 10)`, marks the `background_jobs` row
  `processing`, dispatches on `type`, then `pgmq.delete` on success. On
  failure it leaves the message to reappear after the visibility timeout and
  increments `background_jobs.retry_count`; at `max_retries` it
  `pgmq.archive`s and marks the row `failed`.
- Concurrency: Supabase Pro edge functions run many instances; keep per-tick
  batch at 10 and let overlapping ticks run. GitHub rate limits are gh-datapipe's
  problem (3 apps), not this queue's.
- Edge function wall clock is 150 s (free) / 400 s (Pro). Any job that could
  exceed it goes to a Fly machine, not an edge function. Today that is only
  `capture/*`.

### Webhook background function

`netlify/functions/github-webhook-background.mts` (the `-background` suffix is
what makes Netlify run it async). Verifies `X-Hub-Signature-256`, dedupes on
`X-GitHub-Delivery` via `idempotency_keys`, then calls the existing
`app/webhooks/event-router.ts`. Writes with the service-role client
(`src/lib/supabase-admin.ts`), per the RLS lesson in `fly-webhook-migration.md`.
Netlify functions bundle `app/webhooks/*` and `app/services/*` with esbuild
the same way the Fly server did; declare `external_node_modules` for anything
with native bindings. Set the GitHub App webhook URL to
`https://contributor.info/.netlify/functions/github-webhook-background` and
delete the two 307 redirects from `netlify.active.toml`.

## Phases

### Phase 0: inventory and cheap deletes (1–2 h)

- [~] Inngest executions by function for last month. The REST API only retains
      ~1 day of `inngest/function.finished` events on this plan (51 runs,
      2026-10-09 → 2026-10-10, 40 of them `capture-pr-details-graphql`), so the
      monthly split has to come from the dashboard's usage page (manual login).
      What the code does tell us: the registered crons add up to roughly 1,100
      runs/month (`generate-embeddings` every 2 h = 360, `sync-workspace-comments`
      every 4 h = 180, four every-6-h functions = 480, six dailies = 180,
      one monthly), so the 50k+ cap was hit by event-driven `capture/*` fan-out
      and per-step executions, not by the schedules. Size pgmq for bursts, not
      for the crons. Note there are 13 `cron:` triggers in `src/lib/inngest/functions/`,
      not 9; reconcile the list in Phase 3a. Cancel the account once Phase 3 is done.
- [x] Fly: no volumes on `contributor-info-webhooks` or
      `contributor-info-social-cards` (checked 2026-10-18). Both apps still have a
      `started` machine each (webhooks shared-cpu-1x/512MB, social cards
      shared-cpu-2x/2GB) which is the Phase 1 work. `gh-datapipe` (10 GB) and
      `gh-datapipe-watchevents` (20 GB) still carry volumes; tracked in
      open-source-ready/gh-datapipe#265.
- [x] Deleted duplicate scheduled workflows: `scheduled-data-sync.yml`,
      `update-pr-activity.yml` (gh-datapipe + `update/pr.activity`),
      `capture-workspace-issues.yml` (edge `workspace-issues-sync`),
      `performance-monitoring.yml`, `posthog-session-analysis.yml`,
      `rls-monitor.yml`, `daily-sitemap-generation.yml`, `submit-sitemap.yml`,
      `update-tracked-repos.yml`. All were already disabled on GitHub (manually
      or for inactivity). Kept `progressive-backfill.yml` and `chunk-recovery.yml`
      (both `disabled_inactivity` until Phase 2). Two things the deleted files
      did that were not duplicates: `performance-monitoring.yml` was also the
      PR gate for `scripts/performance/check-chunk-graph.mjs`, now a step in
      `ci-tests.yml`; and `capture-workspace-issues.yml` was the only scheduled
      caller of `workspace-issues-sync`, now listed under Phase 3a. The weekly
      `update-tracked-repos.yml` is not replaced: `release.yml` regenerates
      `tracked-repositories.{txt,json}` on every push to `main`, and nothing in
      this repo or gh-datapipe reads those files.
- [x] Polar billing is **not live**: `POLAR_ENVIRONMENT=production` is set on
      Netlify but the stored `POLAR_ACCESS_TOKEN` is rejected by both the
      production and sandbox Polar APIs, and the only `active` row in
      `subscriptions` is the owner's own account with a hand-set `team` tier and
      no `polar_*` ids. Phase 2 can therefore land before Phase 3.
- [ ] Follow-up for Phase 3b: `background_jobs` was dropped by
      `supabase/migrations/20260428000007_drop_dead_tables.sql`, but
      `process-job`, `process-webhook` and `health-jobs` still reference it.
      The table has to be recreated (or those functions repointed) before the
      pgmq queue can feed `process-job`.

### Phase 1: webhooks on Netlify, social cards scale-to-zero (half day)

- [x] `netlify/functions/github-webhook-background.mts` (helpers in
      `lib/github-webhook.mts`, unit tested). Dispatches `pull_request`,
      `issues`, `issue_comment`, `installation`, `installation_repositories`
      straight to the `app/webhooks/*` handlers, as the Fly server did; the
      in-memory `event-router` is reached through `issues.ts`/`pull-request.ts`
      and is per-invocation state only. `check_run`, `label` and `ping` are
      acknowledged and dropped (no handler existed before either). Service-role
      writes: the function sets the anon env names to the service key before
      dynamically importing the handlers, which is what the Fly box did via its
      secrets. The three `inngest.send` calls in `installation.ts` are gone;
      nothing consumed those events.
- [x] While the site is paused, `maintenance/functions/` re-exports the function
      so it still deploys; `maintenance/_redirects` lets its path through the
      catch-all. Phase 2 deletes both with the rest of `maintenance/`.
- [ ] Cutover (needs secrets that only exist on Fly today): set
      `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (base64) and
      `GITHUB_APP_WEBHOOK_SECRET` in the Netlify env, deploy, repoint the GitHub
      App webhook URL to
      `https://contributor.info/.netlify/functions/github-webhook-background`,
      then "Redeliver" one of each event type from the App's Advanced tab and
      check `idempotency_keys` for a `completed` row per delivery.
- [x] Deleted `webhooks-server/` and `.github/workflows/deploy-github-webhooks.yml`;
      the two 307 redirects in `netlify.active.toml` are now 200 rewrites to the
      function; CSP `connect-src` no longer lists the Fly host.
- [ ] After cutover is verified: `fly apps destroy contributor-info-webhooks`
      and delete the `FLY_API_TOKEN_WEBHOOKS` repo secret.
- [x] `fly-social-cards/fly.toml` rewritten from the legacy `[[services]]` block
      to `[http_service]` with `min_machines_running = 0`,
      `auto_stop_machines = "stop"`, `auto_start_machines = true`, one health
      check; redeployed 2026-10-18. Wake/stop behaviour recorded in #1856.

### Phase 2: bring the site back (1 h)

- [x] `git mv netlify.active.toml netlify.toml`, deleted `maintenance/`
      (#1857). The webhook function now deploys from `netlify/functions/`
      directly, so the re-export shim and its `_redirects` pass-through went
      with the rest of the directory.
- [x] Re-enabled `progressive-backfill.yml` (every 15 min) and
      `chunk-recovery.yml` (every 2 h) with `gh workflow enable`; both had been
      `disabled_inactivity`. They are the interim capture path until Phase 4.
- [ ] `@netlify/plugin-lighthouse` was a Netlify UI plugin (not in the repo);
      it was removed because it broke the static maintenance build. Re-add it
      from the Netlify UI if wanted.
- [ ] Found on the #1865 deploy preview: the `GITHUB_TOKEN` in the Netlify env
      is dead (GitHub returns 401), the same token that is dead on Fly
      (gh-datapipe#265). `/api/health` reports github `unhealthy`,
      `/api/track-repository` returns 503 "GitHub API error", and every
      function that reads `GITHUB_TOKEN` / `VITE_GITHUB_TOKEN` is affected.
      Rotate the token in Netlify (and Fly) before announcing the site is back.
- [ ] Set `FLY_DATAPIPE_TOKEN` and `FLY_DATAPIPE_IMAGE` in the Netlify env once
      #1863 (gh-datapipe scale-to-zero) is merged; the backfill functions need
      them to start Fly machines.
- [x] Inngest stays paused. Polar billing is not live (see the Phase 0 notes), so
      this phase can land before Phase 3. Until Phase 3 lands, the frontend's
      `queue-event` calls fail closed (they already catch and log); the site
      works read-only for new data.

### Phase 3: Inngest → pg_cron + pgmq (1–2 days)

- [ ] Migration A: `cron.schedule` for the 9 crons → `invoke_edge_function()`
      with the service key from Vault (replace the `app.service_role_key` GUC):
      `classify-repository-size` (0 */6), `distill-session-knowledge` (0 4),
      `enrich-contributors-cron` (0 3), `refresh-repository-metadata-cron` (0 0),
      `send-slack-assignee-report-cron` (0 9), `send-user-slack-monthly-leaderboard-cron`
      (0 9 1 * *), `sync-discussions-cron` (0 2), `sync-workspace-comments-cron`
      (0 */4), `sync-workspace-priorities` (0 */6). Phase 0 found four more
      `cron:` triggers in `src/lib/inngest/functions/` that this list missed:
      `scheduled-workspace-aggregation` (0 6,18) and
      `cleanup-workspace-metrics-data` (0 3) in `aggregate-workspace-metrics.ts`,
      `compute-embeddings` (0 */6) and `batch-generate-embeddings` (0 */2, in
      `generate-embeddings.ts`). They are not duplicates: `compute-embeddings`
      works a prioritized queue of issues, PRs and discussions in one run;
      `batch-generate-embeddings` fans out one `generate-embeddings` event per
      tracked repository (up to 100 every 2 h) for issues and PRs only. Keep
      `compute-embeddings` as the pg_cron schedule and confirm its queue covers
      tracked repositories; drop the per-repo fan-out, which is exactly the
      event burst pattern that hit the Inngest cap. Note the Netlify Inngest app
      (`functions/index.ts`) and the Supabase `inngest-prod` app register
      different subsets, so take the union. Also add a schedule that is not an
      Inngest cron at all: `workspace-issues-sync` (0 */6) was only ever called
      by the deleted `capture-workspace-issues.yml`; the remaining
      `workspace-issues-refresh` path is visit-triggered from the Issues tab, so
      unvisited workspaces would otherwise stop getting issue updates. Confirm
      each has an edge function entry point that does not depend on Inngest's
      `step` object; add thin ones where the logic only exists inside the
      Inngest function.
- [ ] Migration B: `pgmq.create('jobs')`; pg_cron every minute → `process-job`.
- [ ] `queue-event`: replace `sendToInngest()` with `background_jobs` insert +
      `pgmq.send`.
- [ ] `process-job`: pgmq read/delete/archive loop; add cases for the bucket-3
      types; `capture/*` cases call `fly-machines.createMachine()` (shared lib
      with the Netlify functions, or a Deno copy under `supabase/functions/_shared`).
- [ ] Move the per-repository git-history indexing and file-embedding work
      that `installation_repositories.added` triggers (`app/webhooks/installation.ts`,
      `handleRepositoriesAdded`) onto the queue as one job per repo. Since
      Phase 1a it runs inline inside the webhook background function and is
      bounded by its 15 min budget; a large installation should fan out instead.
- [ ] Frontend: `src/lib/inngest/client-safe.ts` already prefers
      `/functions/v1/queue-event`; remove the direct `inngest.send` fallback.
      Delete `hybrid-queue-manager.ts`'s `github_actions` branch once Phase 4 lands.
- [ ] Delete `supabase/functions/inngest-prod`, `netlify/functions/inngest*.mts`,
      `src/lib/inngest/` (keep `types/event-data.ts` if `process-job` uses it),
      `inngest.config.*`, Inngest env vars. Cancel Inngest.
- [ ] Watch for a week: `cron.job_run_details` failures, `pgmq.metrics('jobs')`
      queue depth, `background_jobs` failed rows, edge invocation count.

### Phase 4: one capture engine (later)

- [ ] Fold `progressive-backfill.yml` / `chunk-recovery.yml` into gh-datapipe
      backfills (`datapipe_jobs` already tracks progress); disable the workflows.
- [ ] Decide `/api/v1/discover/search` (see companion plan).
- [ ] Chart screenshots: optionally move from the Fly Chromium app to resvg in
      the Netlify `social-cards` function and delete the last Fly app that is
      not gh-datapipe.

## Expected monthly bill

| Before | After |
|---|---|
| Fly (datapipe sync + api + watchevents + webhooks + social cards) ≈ $100 | ~$6 (datapipe machines while running + social cards wake-ups) |
| GitHub Actions ≈ $32 (private datapipe repo) | $0 |
| Inngest: blocked at Hobby; Pro would be $99 | $0 |
| Netlify | unlimited plan, unchanged |
| Supabase | unchanged |

## Risks

| Risk | Mitigation |
|---|---|
| Netlify Background Function cold start + bundle size for `app/webhooks` | 15-min budget makes cold start irrelevant; GitHub only needs the 202. Size: same code the Fly image bundled with esbuild |
| Double-processing from overlapping `process-job` ticks | pgmq visibility timeout + `background_jobs.status` check before dispatch; handlers are idempotent |
| A bucket-3 job turns out to need multi-step durability | Move that one to Cloudflare Workflows; the queue shape does not change |
| Edge function 400 s limit | Anything longer runs on a Fly machine (already true for `capture/*`) |
| pg_cron silently stops | The freshness job in the companion plan is the canary; `cron.job_run_details` is queryable from a Netlify health check |
