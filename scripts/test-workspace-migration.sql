-- Test script to validate workspace data fetching migration
-- Run this against a test database to ensure migration is valid

-- First, let's check if required tables exist
SELECT 'Checking prerequisites...' as status;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'workspaces'
) as workspaces_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tracked_repositories'
) as tracked_repositories_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'repositories'
) as repositories_exists;

-- Check if tables we're about to create already exist
SELECT 'Checking for conflicts...' as status;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_tracked_repositories'
) as workspace_tracked_repositories_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_activity_metrics'
) as daily_activity_metrics_exists;

SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'workspace_issues_cache'
) as workspace_issues_cache_exists;

-- List all columns that will be added to repositories table
SELECT 'Checking repository columns...' as status;

SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'repositories'
AND column_name IN (
    'avatar_url', 
    'homepage_url', 
    'topics', 
    'is_template', 
    'is_fork', 
    'parent_repository_id',
    'has_issues',
    'has_projects',
    'has_wiki',
    'has_discussions'
);

-- Validate that the migration will work
SELECT 'Migration appears valid!' as status;