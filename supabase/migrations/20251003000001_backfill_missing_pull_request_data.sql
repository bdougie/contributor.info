-- Backfill missing author_id and repository_id in pull_requests table
-- This migration addresses PRs that were created before these columns were properly populated
--
-- Data Analysis (as of 2025-10-03):
-- - 2,538 PRs with NULL author_id
-- - 2,247 of those can be backfilled from contributors table using author_github_id
-- - 2,264 PRs with NULL repository_id
-- - 34 of those can be backfilled from repositories table using repository_full_name

-- ============================================================================
-- STEP 1: Backfill author_id from contributors table
-- ============================================================================

-- Update pull_requests to set author_id where it's NULL but we have author_github_id
UPDATE pull_requests pr
SET author_id = c.id
FROM contributors c
WHERE pr.author_id IS NULL
  AND pr.author_github_id IS NOT NULL
  AND c.github_id = pr.author_github_id;

-- ============================================================================
-- STEP 2: Backfill repository_id from repositories table
-- ============================================================================

-- Update pull_requests to set repository_id where it's NULL but we have repository_full_name
UPDATE pull_requests pr
SET repository_id = r.id
FROM repositories r
WHERE pr.repository_id IS NULL
  AND pr.repository_full_name IS NOT NULL
  AND r.full_name = pr.repository_full_name;

-- ============================================================================
-- VALIDATION
-- ============================================================================

DO $$
DECLARE
  remaining_null_author_id INTEGER;
  remaining_null_repository_id INTEGER;
BEGIN
  -- Count remaining NULLs after backfill
  SELECT COUNT(*) INTO remaining_null_author_id
  FROM pull_requests
  WHERE author_id IS NULL;

  SELECT COUNT(*) INTO remaining_null_repository_id
  FROM pull_requests
  WHERE repository_id IS NULL;

  RAISE NOTICE '✅ Backfill migration completed';
  RAISE NOTICE 'Remaining PRs with NULL author_id: %', remaining_null_author_id;
  RAISE NOTICE 'Remaining PRs with NULL repository_id: %', remaining_null_repository_id;

  IF remaining_null_author_id > 0 THEN
    RAISE NOTICE '⚠️ Some PRs still have NULL author_id - these may need manual intervention';
  END IF;

  IF remaining_null_repository_id > 0 THEN
    RAISE NOTICE '⚠️ Some PRs still have NULL repository_id - these may need manual intervention';
  END IF;
END $$;
