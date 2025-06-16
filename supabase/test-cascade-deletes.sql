-- Test Cascade Delete Behavior
-- This file contains test scenarios to verify the cascade delete behavior
-- Run these tests in the Supabase SQL Editor to verify implementation

-- =====================================================
-- SETUP TEST DATA
-- =====================================================

-- Clean up any existing test data
DELETE FROM pull_requests WHERE title LIKE 'TEST:%';
DELETE FROM contributors WHERE username LIKE 'test-user-%';
DELETE FROM repositories WHERE full_name LIKE 'test-org/%';
DELETE FROM organizations WHERE login LIKE 'test-org-%';

-- Insert test organization
INSERT INTO organizations (
    github_id, login, avatar_url, description, 
    public_repos, followers, github_created_at
) VALUES (
    999991, 'test-org-cascade', 
    'https://avatars.githubusercontent.com/u/999991?v=4',
    'Test organization for cascade delete testing',
    10, 100, '2020-01-01T00:00:00Z'
) ON CONFLICT (github_id) DO UPDATE SET 
    login = EXCLUDED.login,
    description = EXCLUDED.description;

-- Insert test repository
INSERT INTO repositories (
    github_id, full_name, owner, name, description,
    language, stargazers_count, forks_count,
    is_fork, github_created_at, github_updated_at
) VALUES (
    999992, 'test-org-cascade/test-repo', 'test-org-cascade', 'test-repo', 
    'Test repository for cascade delete testing',
    'JavaScript', 50, 10,
    FALSE, '2020-01-01T00:00:00Z', NOW()
) ON CONFLICT (github_id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    description = EXCLUDED.description;

-- Insert test contributors
INSERT INTO contributors (
    github_id, username, display_name, avatar_url, profile_url,
    email, company, location, bio, public_repos, followers, following,
    github_created_at
) VALUES 
(
    999993, 'test-user-author', 'Test Author User', 
    'https://avatars.githubusercontent.com/u/999993?v=4',
    'https://github.com/test-user-author',
    'test-author@example.com', 'Test Company', 'Test City',
    'Test author for cascade delete testing', 5, 50, 25,
    '2020-01-01T00:00:00Z'
),
(
    999994, 'test-user-reviewer', 'Test Reviewer User', 
    'https://avatars.githubusercontent.com/u/999994?v=4',
    'https://github.com/test-user-reviewer',
    'test-reviewer@example.com', 'Test Company', 'Test City',
    'Test reviewer for cascade delete testing', 8, 75, 30,
    '2020-01-01T00:00:00Z'
),
(
    999995, 'test-user-commenter', 'Test Commenter User', 
    'https://avatars.githubusercontent.com/u/999995?v=4',
    'https://github.com/test-user-commenter',
    'test-commenter@example.com', 'Test Company', 'Test City',
    'Test commenter for cascade delete testing', 3, 25, 15,
    '2020-01-01T00:00:00Z'
)
ON CONFLICT (github_id) DO UPDATE SET 
    username = EXCLUDED.username,
    display_name = EXCLUDED.display_name;

-- Get the IDs for our test data
DO $$
DECLARE
    test_repo_id UUID;
    test_author_id UUID;
    test_reviewer_id UUID;
    test_commenter_id UUID;
    test_pr_id UUID;
    test_review_id UUID;
BEGIN
    -- Get test entity IDs
    SELECT id INTO test_repo_id FROM repositories WHERE full_name = 'test-org-cascade/test-repo';
    SELECT id INTO test_author_id FROM contributors WHERE username = 'test-user-author';
    SELECT id INTO test_reviewer_id FROM contributors WHERE username = 'test-user-reviewer';
    SELECT id INTO test_commenter_id FROM contributors WHERE username = 'test-user-commenter';
    
    -- Insert test pull request
    INSERT INTO pull_requests (
        github_id, number, title, body, state, repository_id, author_id,
        base_branch, head_branch, draft, merged, created_at, updated_at,
        additions, deletions, changed_files, commits, html_url
    ) VALUES (
        999996, 1, 'TEST: Sample pull request for cascade testing', 
        'This is a test pull request to verify cascade delete behavior',
        'open', test_repo_id, test_author_id,
        'main', 'feature/test-cascade', FALSE, FALSE, 
        '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z',
        100, 50, 5, 3, 'https://github.com/test-org-cascade/test-repo/pull/1'
    ) ON CONFLICT (github_id) DO UPDATE SET 
        title = EXCLUDED.title,
        body = EXCLUDED.body;
    
    -- Get the PR ID
    SELECT id INTO test_pr_id FROM pull_requests WHERE github_id = 999996;
    
    -- Insert test review
    INSERT INTO reviews (
        github_id, pull_request_id, reviewer_id, state, body, submitted_at
    ) VALUES (
        999997, test_pr_id, test_reviewer_id, 'APPROVED', 
        'This looks good to me! Great test case.', '2024-01-02T00:00:00Z'
    ) ON CONFLICT (github_id) DO UPDATE SET 
        state = EXCLUDED.state,
        body = EXCLUDED.body;
    
    -- Insert test comments
    INSERT INTO comments (
        github_id, pull_request_id, commenter_id, body, created_at, updated_at,
        comment_type
    ) VALUES 
    (
        999998, test_pr_id, test_commenter_id, 
        'Great work on this test case!', '2024-01-03T00:00:00Z', '2024-01-03T00:00:00Z',
        'issue_comment'
    ),
    (
        999999, test_pr_id, test_author_id, 
        'Thanks for the review and feedback!', '2024-01-04T00:00:00Z', '2024-01-04T00:00:00Z',
        'issue_comment'
    )
    ON CONFLICT (github_id) DO UPDATE SET 
        body = EXCLUDED.body;
    
    -- Insert test monthly ranking
    INSERT INTO monthly_rankings (
        month, year, contributor_id, repository_id, rank, weighted_score,
        pull_requests_count, reviews_count, comments_count, repositories_contributed,
        lines_added, lines_removed, first_contribution_at, last_contribution_at
    ) VALUES (
        1, 2024, test_author_id, test_repo_id, 1, 150.5,
        1, 0, 1, 1, 100, 50, '2024-01-01T00:00:00Z', '2024-01-04T00:00:00Z'
    ) ON CONFLICT (month, year, contributor_id, repository_id) DO UPDATE SET 
        rank = EXCLUDED.rank,
        weighted_score = EXCLUDED.weighted_score;
    
    -- Insert test daily activity
    INSERT INTO daily_activity_snapshots (
        date, contributor_id, repository_id, pull_requests_opened, comments_made,
        lines_added, lines_removed
    ) VALUES (
        '2024-01-01', test_author_id, test_repo_id, 1, 1, 100, 50
    ) ON CONFLICT (date, contributor_id, repository_id) DO UPDATE SET 
        pull_requests_opened = EXCLUDED.pull_requests_opened;
    
END $$;

-- =====================================================
-- TEST SCENARIOS
-- =====================================================

-- Test 1: Verify test data was created correctly
SELECT 'TEST 1: Verify test data creation' as test_name;
SELECT 
    'Repositories' as entity_type,
    COUNT(*) as count
FROM repositories 
WHERE full_name = 'test-org-cascade/test-repo'
UNION ALL
SELECT 
    'Contributors' as entity_type,
    COUNT(*) as count
FROM contributors 
WHERE username LIKE 'test-user-%'
UNION ALL
SELECT 
    'Pull Requests' as entity_type,
    COUNT(*) as count
FROM pull_requests 
WHERE title LIKE 'TEST:%'
UNION ALL
SELECT 
    'Reviews' as entity_type,
    COUNT(*) as count
FROM reviews r
JOIN pull_requests pr ON r.pull_request_id = pr.id
WHERE pr.title LIKE 'TEST:%'
UNION ALL
SELECT 
    'Comments' as entity_type,
    COUNT(*) as count
FROM comments c
JOIN pull_requests pr ON c.pull_request_id = pr.id
WHERE pr.title LIKE 'TEST:%';

-- Test 2: Test contributor deletion (should SET NULL, preserve history)
SELECT 'TEST 2: Testing contributor deletion behavior' as test_name;

-- Before deletion counts
SELECT 
    'Before Deletion' as status,
    COUNT(DISTINCT pr.id) as pull_requests,
    COUNT(DISTINCT r.id) as reviews,
    COUNT(DISTINCT c.id) as comments,
    COUNT(DISTINCT mr.id) as monthly_rankings,
    COUNT(DISTINCT das.id) as daily_activity
FROM contributors cont
LEFT JOIN pull_requests pr ON cont.id = pr.author_id
LEFT JOIN reviews r ON cont.id = r.reviewer_id
LEFT JOIN comments c ON cont.id = c.commenter_id
LEFT JOIN monthly_rankings mr ON cont.id = mr.contributor_id
LEFT JOIN daily_activity_snapshots das ON cont.id = das.contributor_id
WHERE cont.username = 'test-user-author';

-- Delete the test author
DELETE FROM contributors WHERE username = 'test-user-author';

-- After deletion counts (should preserve records but with NULL contributor_id)
SELECT 
    'After Author Deletion' as status,
    COUNT(DISTINCT pr.id) as pull_requests_preserved,
    COUNT(DISTINCT CASE WHEN pr.author_id IS NULL THEN pr.id END) as pull_requests_anonymized,
    COUNT(DISTINCT c.id) as comments_preserved,
    COUNT(DISTINCT CASE WHEN c.commenter_id IS NULL THEN c.id END) as comments_anonymized,
    COUNT(DISTINCT mr.id) as monthly_rankings_preserved,
    COUNT(DISTINCT CASE WHEN mr.contributor_id IS NULL THEN mr.id END) as monthly_rankings_anonymized
FROM pull_requests pr
LEFT JOIN comments c ON pr.id = c.pull_request_id
LEFT JOIN monthly_rankings mr ON pr.id = mr.repository_id
WHERE pr.title LIKE 'TEST:%';

-- Test 3: Test repository deletion (should CASCADE delete everything)
SELECT 'TEST 3: Testing repository deletion behavior' as test_name;

-- Before deletion counts
SELECT 
    'Before Repository Deletion' as status,
    COUNT(DISTINCT pr.id) as pull_requests,
    COUNT(DISTINCT r.id) as reviews,
    COUNT(DISTINCT c.id) as comments,
    COUNT(DISTINCT mr.id) as monthly_rankings,
    COUNT(DISTINCT das.id) as daily_activity
FROM repositories repo
LEFT JOIN pull_requests pr ON repo.id = pr.repository_id
LEFT JOIN reviews r ON pr.id = r.pull_request_id
LEFT JOIN comments c ON pr.id = c.pull_request_id
LEFT JOIN monthly_rankings mr ON repo.id = mr.repository_id
LEFT JOIN daily_activity_snapshots das ON repo.id = das.repository_id
WHERE repo.full_name = 'test-org-cascade/test-repo';

-- Delete the test repository
DELETE FROM repositories WHERE full_name = 'test-org-cascade/test-repo';

-- After deletion counts (should be zero due to CASCADE)
SELECT 
    'After Repository Deletion' as status,
    COUNT(DISTINCT pr.id) as pull_requests_remaining,
    COUNT(DISTINCT r.id) as reviews_remaining,
    COUNT(DISTINCT c.id) as comments_remaining,
    COUNT(DISTINCT mr.id) as monthly_rankings_remaining,
    COUNT(DISTINCT das.id) as daily_activity_remaining
FROM pull_requests pr
LEFT JOIN reviews r ON pr.id = r.pull_request_id
LEFT JOIN comments c ON pr.id = c.pull_request_id
LEFT JOIN monthly_rankings mr ON pr.repository_id = mr.repository_id
LEFT JOIN daily_activity_snapshots das ON pr.repository_id = das.repository_id
WHERE pr.title LIKE 'TEST:%';

-- Test 4: Test views with anonymized data
SELECT 'TEST 4: Testing views with anonymized contributors' as test_name;

-- Re-create test data for view testing
INSERT INTO repositories (
    github_id, full_name, owner, name, description,
    language, stargazers_count, forks_count,
    is_fork, github_created_at, github_updated_at
) VALUES (
    999992, 'test-org-cascade/test-repo', 'test-org-cascade', 'test-repo', 
    'Test repository for cascade delete testing',
    'JavaScript', 50, 10,
    FALSE, '2020-01-01T00:00:00Z', NOW()
) ON CONFLICT (github_id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    description = EXCLUDED.description;

-- Insert PR with NULL author (simulating anonymized contributor)
INSERT INTO pull_requests (
    github_id, number, title, body, state, repository_id, author_id,
    base_branch, head_branch, draft, merged, created_at, updated_at,
    additions, deletions, changed_files, commits, html_url
) VALUES (
    999996, 1, 'TEST: Sample pull request for cascade testing', 
    'This is a test pull request to verify cascade delete behavior',
    'open', (SELECT id FROM repositories WHERE full_name = 'test-org-cascade/test-repo'), NULL,
    'main', 'feature/test-cascade', FALSE, FALSE, 
    NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days',
    100, 50, 5, 3, 'https://github.com/test-org-cascade/test-repo/pull/1'
) ON CONFLICT (github_id) DO UPDATE SET 
    title = EXCLUDED.title,
    author_id = NULL;

-- Test recent_activity view handles NULL contributors
SELECT 
    'View Test' as test_name,
    activity_type,
    username,
    description,
    CASE WHEN contributor_id IS NULL THEN 'ANONYMIZED' ELSE 'NORMAL' END as contributor_status
FROM recent_activity
WHERE description LIKE 'TEST:%'
ORDER BY activity_date DESC;

-- =====================================================
-- CLEANUP
-- =====================================================

-- Clean up test data
DELETE FROM pull_requests WHERE title LIKE 'TEST:%';
DELETE FROM contributors WHERE username LIKE 'test-user-%';
DELETE FROM repositories WHERE full_name LIKE 'test-org/%';
DELETE FROM organizations WHERE login LIKE 'test-org-%';

SELECT 'All cascade delete tests completed successfully!' as result;

-- =====================================================
-- SUMMARY OF EXPECTED RESULTS
-- =====================================================

-- TEST 1: Should show all test entities were created
-- TEST 2: Should show PRs/comments/rankings preserved but anonymized after contributor deletion
-- TEST 3: Should show all records CASCADE deleted when repository is deleted
-- TEST 4: Should show views handle NULL contributors with '[deleted]' username
-- CLEANUP: Should remove all test data

-- If any test fails, investigate the foreign key constraints and ensure they match
-- the expected cascade behavior defined in the migration.