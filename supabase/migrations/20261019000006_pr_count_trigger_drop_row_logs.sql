-- Review of #1869 (Devin) pointed at the per-row sync_logs writes in
-- update_repository_pr_count_trigger(). They are the wrong shape for that
-- table: 747,459 of 747,987 sync_logs rows in production are one of these
-- pr_count_* entries, status 'completed' with no completed_at, logged once per
-- pull request insert. The validation constraint from 20240616000001 does not
-- exist in production, and pull_requests is service-role-only, so they never
-- failed there; a fresh database with that constraint would reject the
-- first linked PR. Drop the logging and keep the counting.

CREATE OR REPLACE FUNCTION public.update_repository_pr_count_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.repository_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = pull_request_count + 1,
                total_pull_requests = total_pull_requests + 1
            WHERE id = NEW.repository_id;
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.repository_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = GREATEST(pull_request_count - 1, 0),
                total_pull_requests = GREATEST(total_pull_requests - 1, 0)
            WHERE id = OLD.repository_id;
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.repository_id IS DISTINCT FROM NEW.repository_id THEN
        IF OLD.repository_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = GREATEST(pull_request_count - 1, 0),
                total_pull_requests = GREATEST(total_pull_requests - 1, 0)
            WHERE id = OLD.repository_id;
        END IF;

        IF NEW.repository_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = pull_request_count + 1,
                total_pull_requests = total_pull_requests + 1
            WHERE id = NEW.repository_id;
        END IF;
        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$function$;
