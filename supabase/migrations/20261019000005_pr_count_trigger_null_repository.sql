-- pull_requests rows written by gh-datapipe arrive with repository_id NULL and
-- get linked in a follow-up UPDATE (gh-datapipe _link_pull_request_relations).
-- update_repository_pr_count_trigger() compared OLD.repository_id !=
-- NEW.repository_id, which is NULL (not true) when OLD is NULL, so linking a
-- row never incremented repositories.pull_request_count. Use IS DISTINCT FROM
-- and guard each side so NULL -> uuid counts as an insert and uuid -> NULL as
-- a delete.

CREATE OR REPLACE FUNCTION public.update_repository_pr_count_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    old_repo_id UUID;
    new_repo_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.repository_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = pull_request_count + 1,
                total_pull_requests = total_pull_requests + 1
            WHERE id = NEW.repository_id;

            INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
            SELECT 'repository_sync', NEW.repository_id, 'completed', 1,
                   jsonb_build_object('operation', 'pr_count_increment', 'pr_id', NEW.id)
            WHERE EXISTS (SELECT 1 FROM repositories WHERE id = NEW.repository_id);
        END IF;
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.repository_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = GREATEST(pull_request_count - 1, 0),
                total_pull_requests = GREATEST(total_pull_requests - 1, 0)
            WHERE id = OLD.repository_id;

            INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
            SELECT 'repository_sync', OLD.repository_id, 'completed', 1,
                   jsonb_build_object('operation', 'pr_count_decrement', 'pr_id', OLD.id)
            WHERE EXISTS (SELECT 1 FROM repositories WHERE id = OLD.repository_id);
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' AND OLD.repository_id IS DISTINCT FROM NEW.repository_id THEN
        old_repo_id := OLD.repository_id;
        new_repo_id := NEW.repository_id;

        IF old_repo_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = GREATEST(pull_request_count - 1, 0),
                total_pull_requests = GREATEST(total_pull_requests - 1, 0)
            WHERE id = old_repo_id;

            INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
            SELECT 'repository_sync', old_repo_id, 'completed', 1,
                   jsonb_build_object('operation', 'pr_move_decrement', 'pr_id', NEW.id);
        END IF;

        IF new_repo_id IS NOT NULL THEN
            UPDATE repositories
            SET pull_request_count = pull_request_count + 1,
                total_pull_requests = total_pull_requests + 1
            WHERE id = new_repo_id;

            INSERT INTO sync_logs (sync_type, repository_id, status, records_processed, metadata)
            SELECT 'repository_sync', new_repo_id, 'completed', 1,
                   jsonb_build_object('operation', 'pr_move_increment', 'pr_id', NEW.id);
        END IF;

        RETURN NEW;
    END IF;

    RETURN COALESCE(NEW, OLD);
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO sync_logs (sync_type, repository_id, status, error_message, metadata)
        VALUES ('repository_sync',
                COALESCE(NEW.repository_id, OLD.repository_id),
                'failed',
                SQLERRM,
                jsonb_build_object('operation', TG_OP, 'error_context', 'pr_count_trigger'));
        RAISE;
END;
$function$;
