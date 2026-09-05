-- Run with scripts/testing-tools/test-work-inbox-migration.sh (never against production).
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002'),
 ('00000000-0000-0000-0000-000000000003');
INSERT INTO app_users VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003');
INSERT INTO workspaces VALUES
 ('20000000-0000-0000-0000-000000000001','Paper Compute','10000000-0000-0000-0000-000000000001',true),
 ('20000000-0000-0000-0000-000000000002','Tapes','10000000-0000-0000-0000-000000000001',true);
INSERT INTO repositories VALUES ('30000000-0000-0000-0000-000000000001','papercomputeco/tapes');
INSERT INTO workspace_repositories VALUES
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001');
INSERT INTO workspace_members VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002',now()),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003',NULL);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$
DECLARE
  scope jsonb := public.begin_workspace_work_scan();
  repo uuid := '30000000-0000-0000-0000-000000000001';
  payload jsonb := '[{"subject_key":"thread:1","source_version":"comment:1","title":"Review","url":"https://github.com/papercomputeco/tapes/pull/1#discussion_r1","actor":"reviewer","preview":"Please check","occurred_at":"2026-09-01T00:00:00Z"}]';
  row public.workspace_work_inbox%ROWTYPE;
  baseline timestamptz := clock_timestamp() - interval '1 hour';
BEGIN
  ASSERT (scope->>'workspace_count')::integer = 2, 'Owner without a member row must qualify';
  ASSERT jsonb_array_length(scope->'repositories') = 1, 'Overlapping repositories must be unique';
  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline,payload,true);
  SELECT * INTO row FROM public.workspace_work_inbox;
  ASSERT row.is_read AND row.is_pending, 'Initial baseline is quiet, but visible';
  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline + interval '1 minute',payload,true);
  ASSERT (SELECT count(*) FROM public.workspace_work_inbox) = 1, 'A second workspace/device must not duplicate the row';
  ASSERT (SELECT is_read FROM public.workspace_work_inbox), 'Repeat scan must not re-alert';

  payload := jsonb_set(payload,'{0,source_version}','"comment:2"');
  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline + interval '2 minutes',payload,true);
  SELECT * INTO row FROM public.workspace_work_inbox;
  ASSERT NOT row.is_read, 'New comment must alert';
  PERFORM public.read_workspace_work(row.id,1);
  ASSERT NOT (SELECT is_read FROM public.workspace_work_inbox), 'Stale read must not consume a new comment';
  PERFORM public.read_workspace_work(row.id,2);
  ASSERT (SELECT is_read AND is_pending FROM public.workspace_work_inbox), 'Read is not resolved';

  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline + interval '3 minutes','[]',false);
  ASSERT (SELECT is_pending FROM public.workspace_work_inbox), 'Incomplete response cannot resolve work';
  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline + interval '4 minutes','[]',true);
  ASSERT NOT (SELECT is_pending FROM public.workspace_work_inbox), 'Complete absence resolves work';
  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline + interval '2 minutes',payload,true);
  ASSERT NOT (SELECT is_pending FROM public.workspace_work_inbox), 'Out of order snapshot must be ignored';
  PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',baseline + interval '5 minutes',payload,true);
  ASSERT (SELECT is_pending AND NOT is_read FROM public.workspace_work_inbox), 'Reappearance rearms the alert';
  PERFORM public.read_workspace_work(row.id,2);
  ASSERT NOT (SELECT is_read FROM public.workspace_work_inbox), 'Old acknowledgement cannot read a reactivated request';

  BEGIN
    INSERT INTO public.workspace_work_inbox SELECT * FROM public.workspace_work_inbox;
    RAISE EXCEPTION 'Direct writes should be forbidden';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.record_workspace_work_snapshot(repo,'awaiting_reply',clock_timestamp(),
      jsonb_set(payload,'{0,url}','"https://evil.example/"'),true);
    RAISE EXCEPTION 'Unsafe URL should be rejected';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'Invalid work item'; END;
END $$;

-- An accepted member gets their own state; a pending invite does not qualify.
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
DO $$ BEGIN
  ASSERT jsonb_array_length(public.begin_workspace_work_scan()->'repositories') = 1;
  ASSERT (SELECT count(*) FROM public.workspace_work_inbox) = 0, 'Cannot read another account inbox';
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false);
DO $$ BEGIN
  ASSERT jsonb_array_length(public.begin_workspace_work_scan()->'repositories') = 0;
  BEGIN
    PERFORM public.record_workspace_work_snapshot('30000000-0000-0000-0000-000000000001','awaiting_reply',now(),'[]',true);
    RAISE EXCEPTION 'Pending invite must not write';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE workspaces SET is_active = false;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.workspace_work_inbox) = 0, 'Losing every workspace hides saved work';
END $$;
RESET ROLE;
DO $$ BEGIN
  ASSERT NOT has_function_privilege('anon','public.begin_workspace_work_scan()','EXECUTE');
  ASSERT NOT has_table_privilege('authenticated','public.workspace_work_cursors','SELECT');
  ASSERT (SELECT count(*) FROM pg_class WHERE relname IN ('workspace_work_inbox','workspace_work_cursors') AND relrowsecurity) = 2;
END $$;
SELECT 'Workspace inbox migration tests passed' AS result;
