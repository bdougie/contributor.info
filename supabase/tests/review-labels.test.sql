-- Run only through scripts/testing-tools/test-review-labels-migration.sh.
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
INSERT INTO auth.identities VALUES
 ('00000000-0000-0000-0000-000000000002','github','22'),('00000000-0000-0000-0000-000000000003','github','33');
INSERT INTO app_users VALUES
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000003');
INSERT INTO workspaces VALUES ('20000000-0000-0000-0000-000000000001','Paper Compute','10000000-0000-0000-0000-000000000001',true,'team');
INSERT INTO repositories VALUES ('30000000-0000-0000-0000-000000000001','papercomputeco/tapes',false);
INSERT INTO workspace_repositories VALUES ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001');
INSERT INTO review_label_campaigns(id,workspace_id,repository_ids,created_by) VALUES
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',ARRAY['30000000-0000-0000-0000-000000000001'::uuid],'00000000-0000-0000-0000-000000000001');
INSERT INTO review_label_invites(id,campaign_id,token_hash,reviewer_github_id,reviewer_login,created_by) VALUES
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',repeat('a',64),'22','yeazelm','00000000-0000-0000-0000-000000000001');

SET ROLE service_role;
DO $$
DECLARE e uuid; record jsonb; consent uuid;
  matt uuid := '00000000-0000-0000-0000-000000000002';
  john uuid := '00000000-0000-0000-0000-000000000003';
  pr uuid := '60000000-0000-0000-0000-000000000001';
BEGIN
  PERFORM record_review_invite_view(repeat('a',64),'70000000-0000-0000-0000-000000000001');
  PERFORM record_review_invite_view(repeat('a',64),'70000000-0000-0000-0000-000000000001');
  ASSERT (SELECT view_count=1 AND first_viewed_at=last_viewed_at AND accepted_at IS NULL FROM review_label_invites), 'Repeated browser visit must not duplicate or accept';
  PERFORM record_review_invite_view(repeat('a',64),'70000000-0000-0000-0000-000000000002');
  ASSERT (SELECT view_count=2 FROM review_label_invites), 'New browser session must count';
  BEGIN
    PERFORM accept_review_label_invite(repeat('a',64),john);
    RAISE EXCEPTION 'Wrong account accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Sign in with the invited GitHub account'; END;
  ASSERT NOT EXISTS(SELECT 1 FROM workspace_members), 'Failed acceptance must not create membership';
  ASSERT (SELECT accepted_at IS NULL FROM review_label_invites), 'Failed acceptance must not be tracked as accepted';
  UPDATE workspaces SET tier='pro';
  BEGIN
    PERFORM accept_review_label_invite(repeat('a',64),matt);
    RAISE EXCEPTION 'Member cap bypassed';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Workspace member limit reached'; END;
  UPDATE workspaces SET tier='team';
  e := accept_review_label_invite(repeat('a',64),matt);
  ASSERT accept_review_label_invite(repeat('a',64),matt)=e, 'Accept retries must be idempotent';
  ASSERT (SELECT count(*)=1 FROM workspace_members), 'Retry must not duplicate member';
  ASSERT (SELECT consent_at IS NULL FROM review_label_enrollments WHERE id=e), 'Joining must not grant consent';
  ASSERT (SELECT accepted_at IS NOT NULL AND accepted_by=matt FROM review_label_invites), 'Accepted identity and server time must persist';
  INSERT INTO review_label_prs(id,enrollment_id,repository_id,pr_number,payload) VALUES
    (pr,e,'30000000-0000-0000-0000-000000000001',123,
    '{"repo":"papercomputeco/tapes","hunks":[{"id":"h1","path":"main.go","diff":"@@ -1 +1 @@\n- panic()\n+ return err"}],"comments":[{"id":"c1","author":"jpmcb","body":"Keep this verbatim: \"quoted\" ☃\nsecond line","hunkId":"h1"}]}');
  BEGIN
    PERFORM save_review_label(john,pr,'c1','good',NULL,'2026-09-07-v1');
    RAISE EXCEPTION 'Someone else labeled';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Review not available to this account'; END;
  record := save_review_label(matt,pr,'c1','skip');
  ASSERT record->>'consent_id' IS NULL, 'Skip cannot activate consent';
  BEGIN
    PERFORM save_review_label(matt,pr,'c1','good',NULL,'old-version');
    RAISE EXCEPTION 'Old consent accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Read the current consent notice'; END;
  record := save_review_label(matt,pr,'c1','bad',NULL,'2026-09-07-v1');
  ASSERT record->>'reviewer_login'='yeazelm', 'Label actor must come from enrollment';
  ASSERT record->'comment'->>'author'='jpmcb', 'Human author must be preserved';
  ASSERT record->'comment'->>'body'=E'Keep this verbatim: "quoted" ☃\nsecond line', 'Comment bytes must round trip';
  ASSERT record->>'hunk'=E'@@ -1 +1 @@\n- panic()\n+ return err', 'Hunk must travel with comment';
  ASSERT (SELECT count(*)=1 FROM review_labels), 'Changing a label must update its current record';
  consent := (record->>'consent_id')::uuid;
  ASSERT consent IS NOT NULL, 'Substantive save must atomically grant consent';
  BEGIN
    PERFORM save_review_label(matt,pr,'h1','missed',E'two\nlines','2026-09-07-v1');
    RAISE EXCEPTION 'Multiline missed accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Enter one line, up to 280 characters'; END;
  record := save_review_label(matt,pr,'h1','missed','Handle shutdown','2026-09-07-v1');
  ASSERT record->>'comment' IS NULL AND record->>'note'='Handle shutdown' AND record->>'hunk' IS NOT NULL, 'Missed must carry hunk and note only';
  DELETE FROM workspace_members WHERE user_id='10000000-0000-0000-0000-000000000002';
  BEGIN
    PERFORM accept_review_label_invite(repeat('a',64),matt);
    RAISE EXCEPTION 'Old invite restored removed member';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Workspace membership required'; END;
  BEGIN
    PERFORM save_review_label(matt,pr,'c1','good',NULL,'2026-09-07-v1');
    RAISE EXCEPTION 'Removed member saved label';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM='Workspace membership required'; END;
  PERFORM withdraw_review_label_consent(matt,e);
  ASSERT NOT EXISTS(SELECT 1 FROM review_labels), 'Withdrawal must delete personal labels';
  ASSERT (SELECT consent_at IS NULL FROM review_label_enrollments WHERE id=e), 'Withdrawal clears consent';
  ASSERT EXISTS(SELECT 1 FROM review_label_consent_revocations WHERE consent_id=consent), 'Withdrawal must preserve revocation record';
END $$;
RESET ROLE;
DO $$
DECLARE t text; role_name text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'review_label%' LOOP
    ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass), 'RLS missing';
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      ASSERT NOT has_table_privilege(role_name,'public.'||t,'SELECT'), 'Personal data readable directly';
      ASSERT NOT has_table_privilege(role_name,'public.'||t,'INSERT'), 'Direct label/invite writes allowed';
    END LOOP;
  END LOOP;
  ASSERT NOT has_function_privilege('authenticated','accept_review_label_invite(text,uuid)','EXECUTE'), 'Browser can impersonate an invitee';
  ASSERT NOT has_function_privilege('anon','record_review_invite_view(text,uuid)','EXECUTE'), 'Anonymous direct tracking bypasses API validation';
END $$;
SELECT 'Review labels: identity, atomic acceptance, visit deduplication, private labels, consent and grants passed' AS result;
