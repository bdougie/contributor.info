-- Phase 3a of docs/infrastructure/cost-reduction-plan.md (#1853, #1858).
--
-- The Inngest cron triggers become pg_cron schedules. Supabase replaces the
-- clock; the logic runs in the `process-job` edge function (via enqueue_job,
-- see 20261019000002_jobs_queue.sql) or in an existing edge function (via
-- invoke_edge_function). Minutes are offset from :00 so nothing collides with
-- the datapipe schedules at :07/:23/:41.
--
-- Inngest crons that are NOT scheduled here, and why (full notes in the plan):
--   distill-session-knowledge           tapes_sessions / tapes_knowledge were dropped 2026-04-28
--   send-user-slack-monthly-leaderboard user_slack_integrations was dropped 2026-04-28
--   scheduled-workspace-aggregation     workspace_metrics_cache was dropped 2026-04-28
--   cleanup-workspace-metrics-data      same tables; mark_workspace_cache_stale() is a no-op now
--   enrich-contributors-cron            reads contributors.workspace_id, a column that does not exist
--   batch-generate-embeddings           per-repo fan-out; compute-embeddings covers the same items
--   sync-discussions-cron               gh-datapipe hourly-sync fetches recent discussions
--   sync-workspace-comments-cron        gh-datapipe hourly-sync fetches recent comments
--   refresh-repository-metadata step 3  (capture/repository.events per repo) hourly-sync covers events
--
-- Also unscheduled: `sync-github-events-hourly` from 20250120000003. It called
-- invoke_edge_function('github-sync'), which never had a key to send, and the
-- datapipe-hourly machine now owns github_events_cache. With Vault wired up it
-- would otherwise start running for the first time.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron missing - skipping Inngest replacement schedules';
    RETURN;
  END IF;

  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN (
     'sync-github-events-hourly',
     'jobs-classify-repository-size',
     'jobs-refresh-repository-metadata',
     'jobs-slack-assignee-report',
     'jobs-sync-workspace-priorities',
     'jobs-compute-embeddings',
     'jobs-workspace-issues-sync'
   );

  -- classify-repository-size: every 6 h (Inngest: 0 */6 * * *)
  PERFORM cron.schedule('jobs-classify-repository-size', '13 */6 * * *',
    $cron$ SELECT public.enqueue_job('classify/repository.size', '{}'::jsonb, NULL, 'cron', INTERVAL '6 hours') $cron$);

  -- refresh-repository-metadata-cron: daily (Inngest: 0 0 * * *)
  PERFORM cron.schedule('jobs-refresh-repository-metadata', '17 0 * * *',
    $cron$ SELECT public.enqueue_job('cron/refresh-repository-metadata', '{}'::jsonb, NULL, 'cron', INTERVAL '12 hours') $cron$);

  -- send-slack-assignee-report-cron: daily 09:00 UTC (Inngest: 0 9 * * *).
  -- Integrations are due when next_scheduled_at <= now(), so 09:03 still sends.
  PERFORM cron.schedule('jobs-slack-assignee-report', '3 9 * * *',
    $cron$ SELECT public.enqueue_job('cron/slack-assignee-report', '{}'::jsonb, NULL, 'cron', INTERVAL '6 hours') $cron$);

  -- sync-workspace-priorities: every 6 h (Inngest: 0 */6 * * *)
  PERFORM cron.schedule('jobs-sync-workspace-priorities', '29 */6 * * *',
    $cron$ SELECT public.enqueue_job('workspace/priorities.sync', '{"trigger":"cron"}'::jsonb, NULL, 'cron', INTERVAL '6 hours') $cron$);

  -- compute-embeddings: every 6 h (Inngest: 0 */6 * * *), whole queue
  PERFORM cron.schedule('jobs-compute-embeddings', '37 */6 * * *',
    $cron$ SELECT public.enqueue_job('embeddings/compute.requested', '{}'::jsonb, NULL, 'cron', INTERVAL '6 hours') $cron$);

  -- workspace-issues-sync: every 6 h. Not an Inngest cron; its only scheduled
  -- caller was the deleted capture-workspace-issues.yml workflow.
  PERFORM cron.schedule('jobs-workspace-issues-sync', '47 */6 * * *',
    $cron$ SELECT public.invoke_edge_function('workspace-issues-sync', '{"hoursBack": 24, "limit": 25}'::jsonb) $cron$);
END $$;
