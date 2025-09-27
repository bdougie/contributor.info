-- Migration: Add support for issue comments
-- Description: Modifies the comments table to support both PR comments and standalone issue comments
-- Issue: #742
-- Date: 2025-01-20

-- Note: The schema changes (issue_id column, nullable pull_request_id, and check constraint)
-- may have already been applied in production. This migration is idempotent.

-- Step 1: Add issue_id column to comments table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='comments' AND column_name='issue_id') THEN
        ALTER TABLE comments
        ADD COLUMN issue_id UUID REFERENCES issues(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 2: Make pull_request_id nullable (if not already)
ALTER TABLE comments
ALTER COLUMN pull_request_id DROP NOT NULL;

-- Step 3: Add check constraint to ensure either pull_request_id OR issue_id is present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
                   WHERE conname = 'comments_pr_or_issue_check') THEN
        ALTER TABLE comments
        ADD CONSTRAINT comments_pr_or_issue_check
        CHECK (
            (pull_request_id IS NOT NULL AND issue_id IS NULL) OR
            (pull_request_id IS NULL AND issue_id IS NOT NULL)
        );
    END IF;
END $$;

-- Step 4: Add indexes for better query performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_comments_issue_id ON comments(issue_id) WHERE issue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_pull_request_id ON comments(pull_request_id) WHERE pull_request_id IS NOT NULL;

-- Step 5: Update comment to reflect new functionality
COMMENT ON TABLE comments IS 'Stores comments on pull requests and standalone issues';
COMMENT ON COLUMN comments.pull_request_id IS 'Reference to pull_request (null for issue comments)';
COMMENT ON COLUMN comments.issue_id IS 'Reference to issue (null for PR comments)';

-- Step 6: Create a view to easily query issue comments
CREATE OR REPLACE VIEW issue_comments AS
SELECT
    c.id,
    c.github_id,
    c.issue_id,
    c.commenter_id,
    c.body,
    c.created_at,
    c.updated_at,
    c.in_reply_to_id,
    i.number as issue_number,
    i.repository_id,
    i.title as issue_title,
    i.state as issue_state,
    cont.username as commenter_username,
    cont.display_name as commenter_display_name,
    cont.avatar_url as commenter_avatar_url
FROM comments c
JOIN issues i ON c.issue_id = i.id
JOIN contributors cont ON c.commenter_id = cont.id
WHERE c.issue_id IS NOT NULL;

-- Step 7: Create a view to easily query PR comments (for backward compatibility)
CREATE OR REPLACE VIEW pr_comments AS
SELECT
    c.id,
    c.github_id,
    c.pull_request_id,
    c.commenter_id,
    c.body,
    c.created_at,
    c.updated_at,
    c.comment_type,
    c.in_reply_to_id,
    c.position,
    c.original_position,
    c.diff_hunk,
    c.path,
    c.commit_id,
    pr.number as pr_number,
    pr.repository_id,
    pr.title as pr_title,
    pr.state as pr_state,
    cont.username as commenter_username,
    cont.display_name as commenter_display_name,
    cont.avatar_url as commenter_avatar_url
FROM comments c
JOIN pull_requests pr ON c.pull_request_id = pr.id
JOIN contributors cont ON c.commenter_id = cont.id
WHERE c.pull_request_id IS NOT NULL;

-- Step 8: Grant appropriate permissions on new views
GRANT SELECT ON issue_comments TO anon, authenticated;
GRANT SELECT ON pr_comments TO anon, authenticated;

-- Step 9: Add RLS policies for the views (inherit from base table)
-- Views automatically respect the base table's RLS policies

-- Step 10: Update existing views to handle both PR and issue comments
-- The contributor_stats view should count both types of comments
DROP VIEW IF EXISTS contributor_stats CASCADE;
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
    COUNT(DISTINCT cm.id) as total_comments,  -- This now includes both PR and issue comments
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
LEFT JOIN comments cm ON c.id = cm.commenter_id  -- This will now include issue comments
WHERE c.is_active = TRUE AND c.is_bot = FALSE
GROUP BY c.id, c.username, c.display_name, c.avatar_url, c.github_id, c.first_seen_at, c.last_updated_at, c.is_active;

-- The repository_stats view should differentiate between PR and issue comments
DROP VIEW IF EXISTS repository_stats CASCADE;
CREATE VIEW repository_stats AS
SELECT
    r.id,
    r.full_name,
    r.owner,
    r.name,
    r.description,
    r.language,
    r.stargazers_count,
    r.forks_count,
    COUNT(DISTINCT pr.id) as total_pull_requests,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.state = 'closed' AND pr.merged = TRUE) as merged_pull_requests,
    COUNT(DISTINCT pr.author_id) as unique_contributors,
    COUNT(DISTINCT rv.id) as total_reviews,
    COUNT(DISTINCT cm.id) FILTER (WHERE cm.pull_request_id IS NOT NULL) as total_pr_comments,
    COUNT(DISTINCT cm.id) FILTER (WHERE cm.issue_id IS NOT NULL) as total_issue_comments,
    COUNT(DISTINCT i.id) as total_issues,
    SUM(pr.additions) as total_lines_added,
    SUM(pr.deletions) as total_lines_removed,
    MIN(pr.created_at) as first_contribution,
    MAX(pr.created_at) as last_contribution,
    r.github_created_at,
    r.first_tracked_at,
    r.last_updated_at,
    r.is_active
FROM repositories r
LEFT JOIN pull_requests pr ON r.id = pr.repository_id
LEFT JOIN reviews rv ON pr.id = rv.pull_request_id
LEFT JOIN comments cm ON (pr.id = cm.pull_request_id OR r.id = (SELECT repository_id FROM issues WHERE id = cm.issue_id))
LEFT JOIN issues i ON r.id = i.repository_id
WHERE r.is_active = TRUE
GROUP BY r.id, r.full_name, r.owner, r.name, r.description, r.language,
         r.stargazers_count, r.forks_count, r.github_created_at,
         r.first_tracked_at, r.last_updated_at, r.is_active;

-- Grant permissions on recreated views
GRANT SELECT ON contributor_stats TO anon, authenticated;
GRANT SELECT ON repository_stats TO anon, authenticated;

-- Migration validation query (to be run manually if needed):
-- SELECT
--     'PR Comments' as type,
--     COUNT(*) as count
-- FROM comments
-- WHERE pull_request_id IS NOT NULL
-- UNION ALL
-- SELECT
--     'Issue Comments' as type,
--     COUNT(*) as count
-- FROM comments
-- WHERE issue_id IS NOT NULL;