-- Local-safe version of 20240616000001_add_validation_constraints.sql
-- Generated: 2025-08-27T02:47:08.034Z
-- This migration has been modified to work without auth, roles, and extensions
-- Original migration may have different behavior in production

-- Transaction wrapper for safety
BEGIN;

-- Enhanced Input Validation Constraints
-- This migration adds comprehensive database-level validation constraints
-- to complement the application-level Zod validation schemas

-- =====================================================
-- CONTRIBUTORS TABLE CONSTRAINTS
-- =====================================================

-- GitHub username validation (1-39 chars, alphanumeric + hyphens)
ALTER TABLE contributors 
ADD CONSTRAINT contributors_username_length 
CHECK (length(username) >= 1 AND length(username) <= 39);

ALTER TABLE contributors 
ADD CONSTRAINT contributors_username_format 
CHECK (username ~ '^[a-zA-Z0-9-]+$' AND username !~ '^-' AND username !~ '-$');

-- Display name length limit
ALTER TABLE contributors 
ADD CONSTRAINT contributors_display_name_length 
CHECK (display_name IS NULL OR length(display_name) <= 255);

-- Avatar URL format validation
ALTER TABLE contributors 
ADD CONSTRAINT contributors_avatar_url_format 
CHECK (avatar_url IS NULL OR avatar_url ~ '^https?://');

-- Email format validation
ALTER TABLE contributors 
ADD CONSTRAINT contributors_email_format 
CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Company and location length limits
ALTER TABLE contributors 
ADD CONSTRAINT contributors_company_length 
CHECK (company IS NULL OR length(company) <= 255);

ALTER TABLE contributors 
ADD CONSTRAINT contributors_location_length 
CHECK (location IS NULL OR length(location) <= 255);

-- Bio length limit
ALTER TABLE contributors 
ADD CONSTRAINT contributors_bio_length 
CHECK (bio IS NULL OR length(bio) <= 1000);

-- Blog URL format validation
ALTER TABLE contributors 
ADD CONSTRAINT contributors_blog_format 
CHECK (blog IS NULL OR blog ~ '^https?://');

-- Non-negative counts
ALTER TABLE contributors 
ADD CONSTRAINT contributors_public_repos_non_negative 
CHECK (public_repos >= 0);

ALTER TABLE contributors 
ADD CONSTRAINT contributors_public_gists_non_negative 
CHECK (public_gists >= 0);

ALTER TABLE contributors 
ADD CONSTRAINT contributors_followers_non_negative 
CHECK (followers >= 0);

ALTER TABLE contributors 
ADD CONSTRAINT contributors_following_non_negative 
CHECK (following >= 0);

-- Date consistency
ALTER TABLE contributors 
ADD CONSTRAINT contributors_date_consistency 
CHECK (github_created_at IS NULL OR github_created_at <= NOW());

-- =====================================================
-- ORGANIZATIONS TABLE CONSTRAINTS
-- =====================================================

-- Organization login validation (similar to username)
ALTER TABLE organizations 
ADD CONSTRAINT organizations_login_length 
CHECK (length(login) >= 1 AND length(login) <= 39);

ALTER TABLE organizations 
ADD CONSTRAINT organizations_login_format 
CHECK (login ~ '^[a-zA-Z0-9-]+$' AND login !~ '^-' AND login !~ '-$');

-- Description length limit
ALTER TABLE organizations 
ADD CONSTRAINT organizations_description_length 
CHECK (description IS NULL OR length(description) <= 1000);

-- Company and location length limits
ALTER TABLE organizations 
ADD CONSTRAINT organizations_company_length 
CHECK (company IS NULL OR length(company) <= 255);

ALTER TABLE organizations 
ADD CONSTRAINT organizations_location_length 
CHECK (location IS NULL OR length(location) <= 255);

-- Email format validation
ALTER TABLE organizations 
ADD CONSTRAINT organizations_email_format 
CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- Non-negative counts
ALTER TABLE organizations 
ADD CONSTRAINT organizations_public_repos_non_negative 
CHECK (public_repos >= 0);

ALTER TABLE organizations 
ADD CONSTRAINT organizations_followers_non_negative 
CHECK (followers >= 0);

-- =====================================================
-- REPOSITORIES TABLE CONSTRAINTS
-- =====================================================

-- Repository name format validation
ALTER TABLE repositories 
ADD CONSTRAINT repositories_name_format 
CHECK (name ~ '^[a-zA-Z0-9._-]+$' AND length(name) >= 1 AND length(name) <= 100);

-- Full name format validation (owner/repo)
ALTER TABLE repositories 
ADD CONSTRAINT repositories_full_name_format 
CHECK (full_name ~ '^[a-zA-Z0-9-]+/[a-zA-Z0-9._-]+$');

-- Owner name validation
ALTER TABLE repositories 
ADD CONSTRAINT repositories_owner_format 
CHECK (owner ~ '^[a-zA-Z0-9-]+$' AND length(owner) >= 1 AND length(owner) <= 39);

-- Description length limit
ALTER TABLE repositories 
ADD CONSTRAINT repositories_description_length 
CHECK (description IS NULL OR length(description) <= 1000);

-- Homepage URL format validation
ALTER TABLE repositories 
ADD CONSTRAINT repositories_homepage_format 
CHECK (homepage IS NULL OR homepage ~ '^https?://');

-- Language name length limit
ALTER TABLE repositories 
ADD CONSTRAINT repositories_language_length 
CHECK (language IS NULL OR length(language) <= 50);

-- Non-negative counts
ALTER TABLE repositories 
ADD CONSTRAINT repositories_stargazers_non_negative 
CHECK (stargazers_count >= 0);

ALTER TABLE repositories 
ADD CONSTRAINT repositories_watchers_non_negative 
CHECK (watchers_count >= 0);

ALTER TABLE repositories 
ADD CONSTRAINT repositories_forks_non_negative 
CHECK (forks_count >= 0);

ALTER TABLE repositories 
ADD CONSTRAINT repositories_issues_non_negative 
CHECK (open_issues_count >= 0);

ALTER TABLE repositories 
ADD CONSTRAINT repositories_size_non_negative 
CHECK (size >= 0);

-- Default branch name validation
ALTER TABLE repositories 
ADD CONSTRAINT repositories_default_branch_length 
CHECK (length(default_branch) >= 1 AND length(default_branch) <= 255);

-- License identifier length limit
ALTER TABLE repositories 
ADD CONSTRAINT repositories_license_length 
CHECK (license IS NULL OR length(license) <= 50);

-- Topics array validation (each topic max 50 chars)
ALTER TABLE repositories 
ADD CONSTRAINT repositories_topics_length 
CHECK (
  topics IS NULL OR 
  (array_length(topics, 1) IS NULL OR array_length(topics, 1) <= 20) AND
  NOT EXISTS (
    SELECT 1 FROM unnest(topics) AS topic 
    WHERE length(topic) > 50 OR length(topic) = 0
  )
);

-- Date consistency
ALTER TABLE repositories 
ADD CONSTRAINT repositories_date_consistency 
CHECK (
  (github_created_at IS NULL OR github_created_at <= NOW()) AND
  (github_updated_at IS NULL OR github_updated_at <= NOW()) AND
  (github_pushed_at IS NULL OR github_pushed_at <= NOW()) AND
  (github_created_at IS NULL OR github_updated_at IS NULL OR github_created_at <= github_updated_at)
);

-- =====================================================
-- PULL REQUESTS TABLE CONSTRAINTS
-- =====================================================

-- PR number must be positive
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_number_positive 
CHECK (number > 0);

-- Title length validation
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_title_length 
CHECK (length(title) >= 1 AND length(title) <= 500);

-- Body length validation
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_body_length 
CHECK (body IS NULL OR length(body) <= 10000);

-- Branch name length validation
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_base_branch_length 
CHECK (length(base_branch) >= 1 AND length(base_branch) <= 255);

ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_head_branch_length 
CHECK (length(head_branch) >= 1 AND length(head_branch) <= 255);

-- Mergeable state length limit
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_mergeable_state_length 
CHECK (mergeable_state IS NULL OR length(mergeable_state) <= 50);

-- Non-negative counts
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_additions_non_negative 
CHECK (additions >= 0);

ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_deletions_non_negative 
CHECK (deletions >= 0);

ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_changed_files_non_negative 
CHECK (changed_files >= 0);

ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_commits_non_negative 
CHECK (commits >= 0);

-- URL format validation
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_html_url_format 
CHECK (html_url IS NULL OR html_url ~ '^https?://');

ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_diff_url_format 
CHECK (diff_url IS NULL OR diff_url ~ '^https?://');

ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_patch_url_format 
CHECK (patch_url IS NULL OR patch_url ~ '^https?://');

-- Date consistency validation
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_date_consistency 
CHECK (
  created_at <= updated_at AND
  (closed_at IS NULL OR closed_at >= created_at) AND
  (merged_at IS NULL OR merged_at >= created_at) AND
  (merged_at IS NULL OR closed_at IS NULL OR merged_at <= closed_at)
);

-- Merged PR validation
ALTER TABLE pull_requests 
ADD CONSTRAINT pull_requests_merged_validation 
CHECK (
  (merged = FALSE OR merged_at IS NOT NULL) AND
  (state = 'open' OR closed_at IS NOT NULL)
);

-- =====================================================
-- REVIEWS TABLE CONSTRAINTS
-- =====================================================

-- Review body length validation
ALTER TABLE reviews 
ADD CONSTRAINT reviews_body_length 
CHECK (body IS NULL OR length(body) <= 10000);

-- Commit ID length validation (Git SHA-1 is 40 chars)
ALTER TABLE reviews 
ADD CONSTRAINT reviews_commit_id_length 
CHECK (commit_id IS NULL OR length(commit_id) <= 40);

-- Date consistency
ALTER TABLE reviews 
ADD CONSTRAINT reviews_date_consistency 
CHECK (submitted_at <= NOW());

-- =====================================================
-- COMMENTS TABLE CONSTRAINTS
-- =====================================================

-- Comment body validation
ALTER TABLE comments 
ADD CONSTRAINT comments_body_length 
CHECK (length(body) >= 1 AND length(body) <= 10000);

-- Position validation (must be positive if set)
ALTER TABLE comments 
ADD CONSTRAINT comments_position_positive 
CHECK (position IS NULL OR position > 0);

ALTER TABLE comments 
ADD CONSTRAINT comments_original_position_positive 
CHECK (original_position IS NULL OR original_position > 0);

-- Diff hunk length validation
ALTER TABLE comments 
ADD CONSTRAINT comments_diff_hunk_length 
CHECK (diff_hunk IS NULL OR length(diff_hunk) <= 1000);

-- File path length validation
ALTER TABLE comments 
ADD CONSTRAINT comments_path_length 
CHECK (path IS NULL OR length(path) <= 500);

-- Commit ID length validation
ALTER TABLE comments 
ADD CONSTRAINT comments_commit_id_length 
CHECK (commit_id IS NULL OR length(commit_id) <= 40);

-- Date consistency
ALTER TABLE comments 
ADD CONSTRAINT comments_date_consistency 
CHECK (created_at <= updated_at);

-- Review comment specific constraints
ALTER TABLE comments 
ADD CONSTRAINT comments_review_comment_validation 
CHECK (
  comment_type = 'issue_comment' OR 
  (comment_type = 'review_comment' AND position IS NOT NULL AND path IS NOT NULL)
);

-- =====================================================
-- MONTHLY RANKINGS TABLE CONSTRAINTS
-- =====================================================

-- Month validation (1-12)
ALTER TABLE monthly_rankings 
ADD CONSTRAINT monthly_rankings_month_valid 
CHECK (month >= 1 AND month <= 12);

-- Year validation (reasonable range)
ALTER TABLE monthly_rankings 
ADD CONSTRAINT monthly_rankings_year_valid 
CHECK (year >= 2020 AND year <= 2100);

-- Rank must be positive
ALTER TABLE monthly_rankings 
ADD CONSTRAINT monthly_rankings_rank_positive 
CHECK (rank > 0);

-- Weighted score must be non-negative
ALTER TABLE monthly_rankings 
ADD CONSTRAINT monthly_rankings_score_non_negative 
CHECK (weighted_score >= 0);

-- All count fields must be non-negative
ALTER TABLE monthly_rankings 
ADD CONSTRAINT monthly_rankings_counts_non_negative 
CHECK (
  pull_requests_count >= 0 AND
  reviews_count >= 0 AND
  comments_count >= 0 AND
  repositories_contributed >= 0 AND
  lines_added >= 0 AND
  lines_removed >= 0
);

-- Date consistency
ALTER TABLE monthly_rankings 
ADD CONSTRAINT monthly_rankings_date_consistency 
CHECK (
  first_contribution_at IS NULL OR 
  last_contribution_at IS NULL OR 
  first_contribution_at <= last_contribution_at
);

-- =====================================================
-- DAILY ACTIVITY SNAPSHOTS TABLE CONSTRAINTS
-- =====================================================

-- All count fields must be non-negative
ALTER TABLE daily_activity_snapshots 
ADD CONSTRAINT daily_activity_counts_non_negative 
CHECK (
  pull_requests_opened >= 0 AND
  pull_requests_merged >= 0 AND
  pull_requests_closed >= 0 AND
  reviews_submitted >= 0 AND
  comments_made >= 0 AND
  lines_added >= 0 AND
  lines_removed >= 0
);

-- Date validation (not in future)
ALTER TABLE daily_activity_snapshots 
ADD CONSTRAINT daily_activity_date_valid 
CHECK (date <= CURRENT_DATE);

-- =====================================================
-- SYNC LOGS TABLE CONSTRAINTS
-- =====================================================

-- All count fields must be non-negative
ALTER TABLE sync_logs 
ADD CONSTRAINT sync_logs_counts_non_negative 
CHECK (
  records_processed >= 0 AND
  records_inserted >= 0 AND
  records_updated >= 0 AND
  records_failed >= 0 AND
  github_api_calls_used >= 0 AND
  (rate_limit_remaining IS NULL OR rate_limit_remaining >= 0)
);

-- Error message length validation
ALTER TABLE sync_logs 
ADD CONSTRAINT sync_logs_error_message_length 
CHECK (error_message IS NULL OR length(error_message) <= 2000);

-- Date consistency
ALTER TABLE sync_logs 
ADD CONSTRAINT sync_logs_date_consistency 
CHECK (
  started_at <= NOW() AND
  (completed_at IS NULL OR completed_at >= started_at)
);

-- Status-specific validation
ALTER TABLE sync_logs 
ADD CONSTRAINT sync_logs_status_validation 
CHECK (
  (status = 'started' AND completed_at IS NULL) OR
  (status IN ('completed', 'failed', 'cancelled') AND completed_at IS NOT NULL)
);

-- Failed syncs must have error message
ALTER TABLE sync_logs 
ADD CONSTRAINT sync_logs_failed_error_required 
CHECK (status != 'failed' OR error_message IS NOT NULL);

-- =====================================================
-- CONTRIBUTOR ORGANIZATIONS TABLE CONSTRAINTS
-- =====================================================

-- Role length validation
ALTER TABLE contributor_organizations 
ADD CONSTRAINT contributor_orgs_role_length 
CHECK (role IS NULL OR length(role) <= 50);

-- Join date validation
ALTER TABLE contributor_organizations 
ADD CONSTRAINT contributor_orgs_join_date_valid 
CHECK (joined_at IS NULL OR joined_at <= NOW());

-- =====================================================
-- TRACKED REPOSITORIES TABLE CONSTRAINTS
-- =====================================================

-- Sync frequency validation (at least 1 hour)
ALTER TABLE tracked_repositories 
ADD CONSTRAINT tracked_repos_sync_frequency_valid 
CHECK (sync_frequency_hours >= 1);

-- Last sync date validation
ALTER TABLE tracked_repositories 
ADD CONSTRAINT tracked_repos_last_sync_valid 
CHECK (last_sync_at IS NULL OR last_sync_at <= NOW());

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON CONSTRAINT contributors_username_format ON contributors 
IS 'Ensures GitHub username contains only valid characters and format';

COMMENT ON CONSTRAINT repositories_full_name_format ON repositories 
IS 'Ensures repository full name follows GitHub owner/repo format';

COMMENT ON CONSTRAINT pull_requests_merged_validation ON pull_requests 
IS 'Ensures merged PRs have merged_at timestamp and closed PRs have closed_at';

COMMENT ON CONSTRAINT reviews_date_consistency ON reviews 
IS 'Ensures review submission date is not in the future';

COMMENT ON CONSTRAINT monthly_rankings_counts_non_negative ON monthly_rankings 
IS 'Ensures all activity counts are non-negative values';

COMMENT ON CONSTRAINT sync_logs_status_validation ON sync_logs 
IS 'Ensures completed/failed/cancelled syncs have completion timestamp';

-- Migration completed successfully
-- These constraints provide database-level validation that complements
-- the application-level Zod schemas for comprehensive data integrity

COMMIT;
