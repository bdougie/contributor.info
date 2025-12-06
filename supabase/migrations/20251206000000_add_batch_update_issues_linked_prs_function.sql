-- Create a PostgreSQL function to batch update issues with linked PRs data
-- This replaces sequential per-issue updates with a single database call
-- Part of issue #1261: Cache linked PRs in database to reduce API calls

CREATE OR REPLACE FUNCTION batch_update_issues_linked_prs(
  updates JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
  update_record JSONB;
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  -- Updates is an array of objects: [{id: uuid, linked_prs: jsonb}, ...]
  -- We use a VALUES join approach for efficient batch updates

  WITH update_data AS (
    SELECT
      (elem->>'id')::UUID AS id,
      (elem->'linked_prs') AS linked_prs
    FROM jsonb_array_elements(updates) AS elem
  )
  UPDATE issues i
  SET
    linked_prs = ud.linked_prs,
    linked_prs_synced_at = now_ts,
    last_synced_at = now_ts
  FROM update_data ud
  WHERE i.id = ud.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN updated_count;
END;
$$;

-- Grant execute permission to authenticated users and anon for RLS compatibility
GRANT EXECUTE ON FUNCTION batch_update_issues_linked_prs(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_issues_linked_prs(JSONB) TO anon;

COMMENT ON FUNCTION batch_update_issues_linked_prs IS 'Batch update issues with linked PRs data. Accepts a JSONB array of {id, linked_prs} objects and updates all matching issues in a single transaction.';
