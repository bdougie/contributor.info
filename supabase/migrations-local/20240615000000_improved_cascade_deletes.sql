-- Local-safe version of 20240615000000_improved_cascade_deletes.sql
-- Generated: 2025-08-27T02:47:08.034Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;


-- Ensure anon exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon;
    RAISE NOTICE 'Created missing role: anon';
  END IF;
END $$;

-- Improved Cascade Delete Behavior Migration
-- This migration updates foreign key constraints to implement better cascade delete behavior
-- Based on the principle: preserve contribution history but allow anonymization

-- =====================================================
-- DROP EXISTING FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Drop existing constraints from pull_requests table
ALTER TABLE pull_requests 
DROP CONSTRAINT IF EXISTS pull_requests_repository_id_fkey,
DROP CONSTRAINT IF EXISTS pull_requests_author_id_fkey,
DROP CONSTRAINT IF EXISTS pull_requests_assignee_id_fkey,
DROP CONSTRAINT IF EXISTS pull_requests_merged_by_id_fkey;

-- Drop existing constraints from reviews table
ALTER TABLE reviews 
DROP CONSTRAINT IF EXISTS reviews_pull_request_id_fkey,
DROP CONSTRAINT IF EXISTS reviews_reviewer_id_fkey;

-- Drop existing constraints from comments table
ALTER TABLE comments 
DROP CONSTRAINT IF EXISTS comments_pull_request_id_fkey,
DROP CONSTRAINT IF EXISTS comments_commenter_id_fkey,
DROP CONSTRAINT IF EXISTS comments_in_reply_to_id_fkey;

-- Drop existing constraints from contributor_organizations table
ALTER TABLE contributor_organizations 
DROP CONSTRAINT IF EXISTS contributor_organizations_contributor_id_fkey,
DROP CONSTRAINT IF EXISTS contributor_organizations_organization_id_fkey;

-- Drop existing constraints from tracked_repositories table
ALTER TABLE tracked_repositories 
DROP CONSTRAINT IF EXISTS tracked_repositories_repository_id_fkey;

-- Drop existing constraints from monthly_rankings table
ALTER TABLE monthly_rankings 
DROP CONSTRAINT IF EXISTS monthly_rankings_contributor_id_fkey,
DROP CONSTRAINT IF EXISTS monthly_rankings_repository_id_fkey;

-- Drop existing constraints from daily_activity_snapshots table
ALTER TABLE daily_activity_snapshots 
DROP CONSTRAINT IF EXISTS daily_activity_snapshots_contributor_id_fkey,
DROP CONSTRAINT IF EXISTS daily_activity_snapshots_repository_id_fkey;

-- Drop existing constraints from sync_logs table
ALTER TABLE sync_logs 
DROP CONSTRAINT IF EXISTS sync_logs_repository_id_fkey;

-- =====================================================
-- MODIFY COLUMNS TO ALLOW NULL WHERE NEEDED
-- =====================================================

-- Allow author_id to be NULL in pull_requests for anonymization
ALTER TABLE pull_requests 
ALTER COLUMN author_id DROP NOT NULL;

-- Allow reviewer_id to be NULL in reviews for anonymization
ALTER TABLE reviews 
ALTER COLUMN reviewer_id DROP NOT NULL;

-- Allow commenter_id to be NULL in comments for anonymization
ALTER TABLE comments 
ALTER COLUMN commenter_id DROP NOT NULL;

-- Allow contributor_id to be NULL in monthly_rankings for anonymization
ALTER TABLE monthly_rankings 
ALTER COLUMN contributor_id DROP NOT NULL;

-- Allow contributor_id to be NULL in daily_activity_snapshots for anonymization
ALTER TABLE daily_activity_snapshots 
ALTER COLUMN contributor_id DROP NOT NULL;

-- =====================================================
-- ADD IMPROVED FOREIGN KEY CONSTRAINTS
-- =====================================================

-- PULL REQUESTS TABLE
-- When repository is deleted, remove all related PRs (CASCADE)
ALTER TABLE pull_requests 
ADD CONSTRAINT fk_pull_requests_repository 
FOREIGN KEY (repository_id) REFERENCES repositories(id) 
ON DELETE CASCADE;

-- When contributor is deleted, preserve PR history but anonymize (SET NULL)
ALTER TABLE pull_requests 
ADD CONSTRAINT fk_pull_requests_author 
FOREIGN KEY (author_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- Optional assignee - set to NULL if contributor deleted
ALTER TABLE pull_requests 
ADD CONSTRAINT fk_pull_requests_assignee 
FOREIGN KEY (assignee_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- Optional merger - set to NULL if contributor deleted
ALTER TABLE pull_requests 
ADD CONSTRAINT fk_pull_requests_merged_by 
FOREIGN KEY (merged_by_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- REVIEWS TABLE
-- When PR is deleted, remove all related reviews (CASCADE)
ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_pull_request 
FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id) 
ON DELETE CASCADE;

-- When reviewer is deleted, preserve review history but anonymize (SET NULL)
ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_reviewer 
FOREIGN KEY (reviewer_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- COMMENTS TABLE
-- When PR is deleted, remove all related comments (CASCADE)
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_pull_request 
FOREIGN KEY (pull_request_id) REFERENCES pull_requests(id) 
ON DELETE CASCADE;

-- When commenter is deleted, preserve comment history but anonymize (SET NULL)
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_commenter 
FOREIGN KEY (commenter_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- When parent comment is deleted, set reply reference to NULL
ALTER TABLE comments 
ADD CONSTRAINT fk_comments_in_reply_to 
FOREIGN KEY (in_reply_to_id) REFERENCES comments(id) 
ON DELETE SET NULL;

-- CONTRIBUTOR ORGANIZATIONS TABLE
-- When contributor is deleted, remove their organization associations (CASCADE)
ALTER TABLE contributor_organizations 
ADD CONSTRAINT fk_contributor_organizations_contributor 
FOREIGN KEY (contributor_id) REFERENCES contributors(id) 
ON DELETE CASCADE;

-- When organization is deleted, remove all member associations (CASCADE)
ALTER TABLE contributor_organizations 
ADD CONSTRAINT fk_contributor_organizations_organization 
FOREIGN KEY (organization_id) REFERENCES organizations(id) 
ON DELETE CASCADE;

-- TRACKED REPOSITORIES TABLE
-- When repository is deleted, remove tracking record (CASCADE)
ALTER TABLE tracked_repositories 
ADD CONSTRAINT fk_tracked_repositories_repository 
FOREIGN KEY (repository_id) REFERENCES repositories(id) 
ON DELETE CASCADE;

-- MONTHLY RANKINGS TABLE
-- When contributor is deleted, preserve ranking history but anonymize (SET NULL)
ALTER TABLE monthly_rankings 
ADD CONSTRAINT fk_monthly_rankings_contributor 
FOREIGN KEY (contributor_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- When repository is deleted, remove repository-specific rankings (CASCADE)
ALTER TABLE monthly_rankings 
ADD CONSTRAINT fk_monthly_rankings_repository 
FOREIGN KEY (repository_id) REFERENCES repositories(id) 
ON DELETE CASCADE;

-- DAILY ACTIVITY SNAPSHOTS TABLE
-- When contributor is deleted, preserve activity history but anonymize (SET NULL)
ALTER TABLE daily_activity_snapshots 
ADD CONSTRAINT fk_daily_activity_snapshots_contributor 
FOREIGN KEY (contributor_id) REFERENCES contributors(id) 
ON DELETE SET NULL;

-- When repository is deleted, remove repository-specific activity (CASCADE)
ALTER TABLE daily_activity_snapshots 
ADD CONSTRAINT fk_daily_activity_snapshots_repository 
FOREIGN KEY (repository_id) REFERENCES repositories(id) 
ON DELETE CASCADE;

-- SYNC LOGS TABLE
-- When repository is deleted, keep sync logs but set repository to NULL (SET NULL)
ALTER TABLE sync_logs 
ADD CONSTRAINT fk_sync_logs_repository 
FOREIGN KEY (repository_id) REFERENCES repositories(id) 
ON DELETE SET NULL;

-- =====================================================
-- UPDATE VIEWS TO HANDLE NULL CONTRIBUTORS
-- =====================================================

-- Update contributor_stats view to handle anonymized contributors
DROP VIEW IF EXISTS contributor_stats;
CREATE VIEW contributor_stats AS
SELECT 
    c.id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.github_id,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT r.id) as total_reviews,
    COUNT(DISTINCT cm.id) as total_comments,
    COUNT(DISTINCT pr.repository_id) as repositories_contributed,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    c.first_seen_at,
    c.last_updated_at,
    c.is_active
FROM contributors c
LEFT JOIN pull_requests pr ON c.id = pr.author_id
LEFT JOIN reviews r ON c.id = r.reviewer_id
LEFT JOIN comments cm ON c.id = cm.commenter_id
WHERE c.is_active = TRUE AND c.is_bot = FALSE
GROUP BY c.id, c.username, c.display_name, c.avatar_url, c.github_id, c.first_seen_at, c.last_updated_at, c.is_active;

-- Update recent_activity view to handle anonymized contributors
DROP VIEW IF EXISTS recent_activity;
CREATE VIEW recent_activity AS
SELECT 
    'pull_request' as activity_type,
    pr.id,
    pr.title as description,
    pr.html_url as url,
    pr.author_id as contributor_id,
    COALESCE(c.username, '[deleted]') as username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    pr.created_at as activity_date,
    pr.state,
    pr.merged
FROM pull_requests pr
LEFT JOIN contributors c ON pr.author_id = c.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE pr.created_at >= NOW() - INTERVAL '30 days'
  AND (c.is_active = TRUE OR c.id IS NULL)
  AND (c.is_bot = FALSE OR c.id IS NULL)
  AND repo.is_active = TRUE

UNION ALL

SELECT 
    'review' as activity_type,
    r.id,
    'Review: ' || COALESCE(r.state, 'PENDING') as description,
    pr.html_url as url,
    r.reviewer_id as contributor_id,
    COALESCE(c.username, '[deleted]') as username,
    c.avatar_url,
    pr.repository_id,
    repo.full_name as repository_name,
    r.submitted_at as activity_date,
    r.state,
    NULL as merged
FROM reviews r
LEFT JOIN contributors c ON r.reviewer_id = c.id
JOIN pull_requests pr ON r.pull_request_id = pr.id
JOIN repositories repo ON pr.repository_id = repo.id
WHERE r.submitted_at >= NOW() - INTERVAL '30 days'
  AND (c.is_active = TRUE OR c.id IS NULL)
  AND (c.is_bot = FALSE OR c.id IS NULL)
  AND repo.is_active = TRUE

ORDER BY activity_date DESC;

-- =====================================================
-- ADD HELPFUL COMMENTS
-- =====================================================

COMMENT ON CONSTRAINT fk_pull_requests_author ON pull_requests IS 'SET NULL to preserve PR history when contributor is deleted';
COMMENT ON CONSTRAINT fk_pull_requests_repository ON pull_requests IS 'CASCADE to remove all PRs when repository is deleted';
COMMENT ON CONSTRAINT fk_reviews_reviewer ON reviews IS 'SET NULL to preserve review history when reviewer is deleted';
COMMENT ON CONSTRAINT fk_reviews_pull_request ON reviews IS 'CASCADE to remove reviews when PR is deleted';
COMMENT ON CONSTRAINT fk_comments_commenter ON comments IS 'SET NULL to preserve comment history when commenter is deleted';
COMMENT ON CONSTRAINT fk_comments_pull_request ON comments IS 'CASCADE to remove comments when PR is deleted';

-- =====================================================
-- MIGRATION COMPLETED
-- =====================================================

-- This migration implements the recommended cascade delete strategy:
-- 1. Preserve contribution history when users are deleted (SET NULL)
-- 2. Remove all related data when repositories are deleted (CASCADE)
-- 3. Remove dependent data when parent records are deleted (CASCADE)
-- 4. Updated views to handle anonymized contributors gracefully

COMMIT;