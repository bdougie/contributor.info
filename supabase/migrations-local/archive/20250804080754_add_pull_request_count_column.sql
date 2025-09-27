-- Local-safe version of 20250804080754_add_pull_request_count_column.sql
-- Generated: 2025-08-27T02:47:08.061Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Migration to add pull_request_count column to repositories table
-- This column will track the total number of PRs for each repository

-- Add the pull_request_count column
ALTER TABLE repositories ADD COLUMN pull_request_count INTEGER DEFAULT 0;

-- Create an index for performance on this column
CREATE INDEX IF NOT EXISTS idx_repositories_pull_request_count ON repositories(pull_request_count DESC);

-- Function to update pull_request_count for a specific repository
CREATE OR REPLACE FUNCTION update_repository_pull_request_count(repository_uuid UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE repositories 
    SET pull_request_count = (
        SELECT COUNT(*) 
        FROM pull_requests 
        WHERE repository_id = repository_uuid
    )
    WHERE id = repository_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to update pull_request_count for all repositories
CREATE OR REPLACE FUNCTION refresh_all_repository_pull_request_counts()
RETURNS VOID AS $$
BEGIN
    UPDATE repositories 
    SET pull_request_count = pr_counts.count
    FROM (
        SELECT 
            repository_id,
            COUNT(*) as count
        FROM pull_requests 
        GROUP BY repository_id
    ) pr_counts
    WHERE repositories.id = pr_counts.repository_id;
    
    -- Set count to 0 for repositories with no PRs
    UPDATE repositories 
    SET pull_request_count = 0 
    WHERE pull_request_count IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically update pull_request_count when PRs are added/removed
CREATE OR REPLACE FUNCTION update_repository_pr_count_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT
    IF TG_OP = 'INSERT' THEN
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1
        WHERE id = NEW.repository_id;
        RETURN NEW;
    END IF;
    
    -- Handle DELETE  
    IF TG_OP = 'DELETE' THEN
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0)
        WHERE id = OLD.repository_id;
        RETURN OLD;
    END IF;
    
    -- Handle UPDATE (if repository_id changes)
    IF TG_OP = 'UPDATE' AND OLD.repository_id \!= NEW.repository_id THEN
        -- Decrease count for old repository
        UPDATE repositories 
        SET pull_request_count = GREATEST(pull_request_count - 1, 0)
        WHERE id = OLD.repository_id;
        
        -- Increase count for new repository
        UPDATE repositories 
        SET pull_request_count = pull_request_count + 1
        WHERE id = NEW.repository_id;
        
        RETURN NEW;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically maintain pull_request_count
CREATE TRIGGER update_repository_pr_count_on_insert
    AFTER INSERT ON pull_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_repository_pr_count_trigger();

CREATE TRIGGER update_repository_pr_count_on_delete
    AFTER DELETE ON pull_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_repository_pr_count_trigger();

CREATE TRIGGER update_repository_pr_count_on_update
    AFTER UPDATE ON pull_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_repository_pr_count_trigger();

-- Initialize pull_request_count for existing repositories
SELECT refresh_all_repository_pull_request_counts();

-- Add comment
COMMENT ON COLUMN repositories.pull_request_count IS 'Total number of pull requests for this repository (maintained automatically via triggers)';
COMMENT ON FUNCTION update_repository_pull_request_count IS 'Updates pull_request_count for a specific repository';
COMMENT ON FUNCTION refresh_all_repository_pull_request_counts IS 'Updates pull_request_count for all repositories';
COMMENT ON FUNCTION update_repository_pr_count_trigger IS 'Trigger function to automatically maintain pull_request_count when PRs are added/removed/updated';


COMMIT;
