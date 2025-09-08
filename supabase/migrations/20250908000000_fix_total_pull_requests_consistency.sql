-- Migration: Fix total_pull_requests column consistency
-- Addresses GitHub issue #694: Self Selection and Contributor Confidence charts failing
-- 
-- Root cause: total_pull_requests column was added later but never maintained,
-- causing chart functions to return zero counts even when PR data exists.

-- Step 1: Fix existing data inconsistencies
-- Ensure all repositories have correct pull_request_count first
SELECT refresh_all_repository_pull_request_counts();

-- Step 2: Sync total_pull_requests to match pull_request_count
UPDATE repositories 
SET total_pull_requests = pull_request_count 
WHERE total_pull_requests != pull_request_count 
   OR total_pull_requests IS NULL;

-- Step 3: Update existing trigger to maintain both columns
-- Replace the existing trigger function to keep both columns in sync
CREATE OR REPLACE FUNCTION update_repository_pr_count_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1,
            total_pull_requests = total_pull_requests + 1
        WHERE id = NEW.repository_id;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE  
    IF TG_OP = 'DELETE' THEN
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0),
            total_pull_requests = GREATEST(total_pull_requests - 1, 0)
        WHERE id = OLD.repository_id;
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE (if repository_id changes)
    IF TG_OP = 'UPDATE' AND OLD.repository_id != NEW.repository_id THEN
        -- Decrease count for old repository
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0),
            total_pull_requests = GREATEST(total_pull_requests - 1, 0)
        WHERE id = OLD.repository_id;
        
        -- Increase count for new repository
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1,
            total_pull_requests = total_pull_requests + 1
        WHERE id = NEW.repository_id;
        RETURN NEW;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Step 4: Verify the fix worked
DO $$
DECLARE
    mismatch_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM repositories 
    WHERE pull_request_count != total_pull_requests;
    
    IF mismatch_count > 0 THEN
        RAISE WARNING 'Still have % repositories with mismatched PR counts after migration', mismatch_count;
    ELSE
        RAISE NOTICE 'Migration successful: All repository PR counts are now consistent';
    END IF;
END $$;

-- Migration completed
-- This fixes the systematic data inconsistency that caused charts to fail
-- Both Self Selection and Contributor Confidence charts should now work correctly