-- Development seed data for Contributor.info
-- This creates realistic test data for development and testing

-- Insert additional test repositories
INSERT INTO repositories (
    github_id, full_name, owner, name, description,
    language, stargazers_count, forks_count, open_issues_count,
    is_fork, github_created_at, github_updated_at
) VALUES 
(
    41898282, 'microsoft/vscode', 'microsoft', 'vscode', 
    'Visual Studio Code',
    'TypeScript', 162000, 28000, 6000,
    FALSE, '2015-09-03T19:19:00Z', NOW()
),
(
    2013367, 'django/django', 'django', 'django',
    'The Web framework for perfectionists with deadlines.',
    'Python', 78000, 31000, 200,
    FALSE, '2012-04-28T02:47:18Z', NOW()
),
(
    16563587, 'supabase/supabase', 'supabase', 'supabase',
    'The open source Firebase alternative.',
    'TypeScript', 71000, 6800, 400,
    FALSE, '2020-01-08T13:38:37Z', NOW()
),
(
    83222441, 'vercel/next.js', 'vercel', 'next.js',
    'The React Framework',
    'JavaScript', 124000, 26000, 2800,
    FALSE, '2016-10-05T00:44:10Z', NOW()
),
(
    10270250, 'facebook/react', 'facebook', 'react',
    'The library for web and native user interfaces.',
    'JavaScript', 227000, 46000, 1000,
    FALSE, '2013-05-24T16:15:54Z', NOW()
)
ON CONFLICT (github_id) DO NOTHING;

-- Insert test contributors
INSERT INTO contributors (
    github_id, username, display_name, avatar_url, profile_url,
    email, company, location, bio, public_repos, followers, following,
    github_created_at
) VALUES 
(
    1, 'mojombo', 'Tom Preston-Werner', 
    'https://avatars.githubusercontent.com/u/1?v=4',
    'https://github.com/mojombo',
    'tom@mojombo.com', 'GitHub', 'San Francisco',
    'Cofounder of GitHub', 62, 23000, 11,
    '2007-10-20T05:24:19Z'
),
(
    2, 'defunkt', 'Chris Wanstrath',
    'https://avatars.githubusercontent.com/u/2?v=4', 
    'https://github.com/defunkt',
    'chris@wanstrath.com', 'GitHub', 'San Francisco',
    'Cofounder of GitHub', 107, 21000, 210,
    '2007-10-20T05:24:19Z'
),
(
    3, 'pjhyett', 'PJ Hyett',
    'https://avatars.githubusercontent.com/u/3?v=4',
    'https://github.com/pjhyett', 
    'pjhyett@gmail.com', 'GitHub', 'San Francisco',
    'Cofounder of GitHub', 8, 6000, 30,
    '2007-10-20T05:24:19Z'
),
(
    4, 'wycats', 'Yehuda Katz',
    'https://avatars.githubusercontent.com/u/4?v=4',
    'https://github.com/wycats',
    'wycats@gmail.com', 'Tilde Inc.', 'Portland, OR',
    'Member of TC39, jQuery Core Team, Rust Core Team', 151, 15000, 173,
    '2008-01-07T17:35:06Z'
),
(
    6752317, 'gaearon', 'Dan Abramov',
    'https://avatars.githubusercontent.com/u/810438?v=4',
    'https://github.com/gaearon',
    'dan.abramov@me.com', 'Vercel', 'London, UK', 
    'Working on @vercel. Co-author of Redux and Create React App.', 227, 89000, 171,
    '2014-02-23T18:18:23Z'
),
(
    810438, 'sophiebits', 'Sophie Alpert',
    'https://avatars.githubusercontent.com/u/6752317?v=4',
    'https://github.com/sophiebits',
    'me@sophiebits.com', 'Sundial', 'San Francisco, CA',
    'Former React team lead', 67, 12000, 183,
    '2011-05-25T18:18:23Z'
),
(
    216296, 'addyosmani', 'Addy Osmani',
    'https://avatars.githubusercontent.com/u/110953?v=4',
    'https://github.com/addyosmani',
    'addyosmani@gmail.com', 'Google', 'Mountain View, CA',
    'Engineering Manager @ Google working on Chrome/Web Platform', 311, 42000, 2000,
    '2009-07-16T18:44:01Z'
),
(
    110953, 'tj', 'TJ Holowaychuk',
    'https://avatars.githubusercontent.com/u/25254?v=4',
    'https://github.com/tj',
    'tj@apex.sh', 'Apex', 'Victoria, BC',
    'Founder of Apex, Luna, and many open source projects', 548, 26000, 28,
    '2009-01-17T09:33:34Z'
),
(
    25254, 'sindresorhus', 'Sindre Sorhus',
    'https://avatars.githubusercontent.com/u/170270?v=4',
    'https://github.com/sindresorhus',
    'sindresorhus@gmail.com', 'Full-Time Open-Sourcerer', 'Oslo, Norway',
    'Full-Time Open-Sourcerer ·· Focusing on Swift and Node.js', 1200, 52000, 44,
    '2009-10-15T15:32:25Z'
),
(
    170270, 'kentcdodds', 'Kent C. Dodds',
    'https://avatars.githubusercontent.com/u/1500684?v=4',
    'https://github.com/kentcdodds',
    'kent@kentcdodds.com', 'KCD', 'Utah, USA',
    'Improving the world with quality software · Husband, Father, Latter-day Saint', 267, 38000, 156,
    '2012-01-18T05:17:37Z'
)
ON CONFLICT (github_id) DO NOTHING;

-- Add repositories to tracking
INSERT INTO tracked_repositories (repository_id, tracking_enabled, last_sync_at)
SELECT id, TRUE, NOW() - INTERVAL '1 hour'
FROM repositories 
WHERE full_name IN ('microsoft/vscode', 'django/django', 'supabase/supabase', 'vercel/next.js', 'facebook/react')
ON CONFLICT (repository_id) DO NOTHING;

-- Insert sample pull requests
INSERT INTO pull_requests (
    github_id, number, title, body, state, repository_id, author_id,
    base_branch, head_branch, draft, merged, created_at, updated_at, merged_at,
    additions, deletions, changed_files, commits, html_url
)
SELECT 
    1000000 + generate_series(1, 50) as github_id,
    generate_series(1, 50) as number,
    'Pull request #' || generate_series(1, 50) as title,
    'This is a sample pull request for testing purposes.' as body,
    CASE WHEN random() > 0.3 THEN 'closed' ELSE 'open' END as state,
    (SELECT id FROM repositories ORDER BY random() LIMIT 1) as repository_id,
    (SELECT id FROM contributors ORDER BY random() LIMIT 1) as author_id,
    'main' as base_branch,
    'feature/branch-' || generate_series(1, 50) as head_branch,
    random() > 0.8 as draft,
    random() > 0.6 as merged,
    NOW() - (random() * INTERVAL '90 days') as created_at,
    NOW() - (random() * INTERVAL '60 days') as updated_at,
    CASE WHEN random() > 0.4 THEN NOW() - (random() * INTERVAL '45 days') ELSE NULL END as merged_at,
    (random() * 1000)::integer as additions,
    (random() * 500)::integer as deletions,
    (random() * 20 + 1)::integer as changed_files,
    (random() * 10 + 1)::integer as commits,
    'https://github.com/example/repo/pull/' || generate_series(1, 50) as html_url;

-- Insert sample reviews and comments
INSERT INTO reviews (
    github_id, pull_request_id, reviewer_id, state, body, submitted_at
)
SELECT 
    2000000 + generate_series(1, 30) as github_id,
    (SELECT id FROM pull_requests ORDER BY random() LIMIT 1) as pull_request_id,
    (SELECT id FROM contributors ORDER BY random() LIMIT 1) as reviewer_id,
    (ARRAY['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED'])[floor(random() * 3 + 1)] as state,
    'Sample review comment for testing.' as body,
    NOW() - (random() * INTERVAL '60 days') as submitted_at
FROM generate_series(1, 30);

INSERT INTO comments (
    github_id, pull_request_id, commenter_id, body, created_at, updated_at, comment_type
)
SELECT 
    3000000 + generate_series(1, 100) as github_id,
    (SELECT id FROM pull_requests ORDER BY random() LIMIT 1) as pull_request_id,
    (SELECT id FROM contributors ORDER BY random() LIMIT 1) as commenter_id,
    'This is a sample comment for testing purposes.' as body,
    NOW() - (random() * INTERVAL '80 days') as created_at,
    NOW() - (random() * INTERVAL '70 days') as updated_at,
    (ARRAY['issue_comment', 'review_comment'])[floor(random() * 2 + 1)] as comment_type
FROM generate_series(1, 100);

-- Generate monthly rankings
INSERT INTO monthly_rankings (
    month, year, contributor_id, rank, weighted_score,
    pull_requests_count, reviews_count, comments_count, repositories_contributed,
    lines_added, lines_removed, first_contribution_at, last_contribution_at,
    is_winner, calculated_at
)
SELECT 
    month_num,
    2024 as year,
    c.id as contributor_id,
    ROW_NUMBER() OVER (PARTITION BY month_num ORDER BY random()) as rank,
    (random() * 1000 + 100)::numeric(10,4) as weighted_score,
    (random() * 20 + 1)::integer as pull_requests_count,
    (random() * 15 + 1)::integer as reviews_count,
    (random() * 30 + 5)::integer as comments_count,
    (random() * 5 + 1)::integer as repositories_contributed,
    (random() * 5000 + 100)::integer as lines_added,
    (random() * 2000 + 50)::integer as lines_removed,
    NOW() - INTERVAL '90 days' as first_contribution_at,
    NOW() - INTERVAL '1 day' as last_contribution_at,
    ROW_NUMBER() OVER (PARTITION BY month_num ORDER BY random()) = 1 as is_winner,
    NOW() as calculated_at
FROM 
    contributors c
    CROSS JOIN generate_series(1, 12) as month_num
WHERE c.github_id <= 10000000;

-- Create some organizations and contributor relationships
INSERT INTO organizations (
    github_id, login, avatar_url, description, company, location, email,
    public_repos, followers, github_created_at
) VALUES 
(
    1342004, 'google', 'https://avatars.githubusercontent.com/u/1342004?v=4',
    'Google', 'Google', 'Mountain View, CA', 'opensource@google.com',
    2500, 25000, '2012-01-18T19:30:00Z'
),
(
    6154722, 'microsoft', 'https://avatars.githubusercontent.com/u/6154722?v=4',
    'Microsoft', 'Microsoft', 'Redmond, WA', 'opensource@microsoft.com',
    3500, 35000, '2014-02-07T00:12:00Z'
),
(
    54212428, 'supabase', 'https://avatars.githubusercontent.com/u/54212428?v=4',
    'Supabase', 'Supabase', 'San Francisco, CA', 'hello@supabase.io',
    150, 8000, '2019-08-17T18:30:00Z'
),
(
    14985020, 'vercel', 'https://avatars.githubusercontent.com/u/14985020?v=4',
    'Vercel', 'Vercel', 'San Francisco, CA', 'support@vercel.com',
    200, 12000, '2015-10-02T21:00:00Z'
)
ON CONFLICT (github_id) DO NOTHING;

-- Link some contributors to organizations
INSERT INTO contributor_organizations (contributor_id, organization_id, role, is_public, joined_at)
SELECT 
    c.id as contributor_id,
    o.id as organization_id,
    'member' as role,
    TRUE as is_public,
    NOW() - (random() * INTERVAL '2 years') as joined_at
FROM contributors c
CROSS JOIN organizations o
WHERE random() > 0.7 -- Only create some relationships
ON CONFLICT (contributor_id, organization_id) DO NOTHING;

-- Insert some sync logs
INSERT INTO sync_logs (
    sync_type, repository_id, status, started_at, completed_at,
    records_processed, records_inserted, records_updated, records_failed,
    github_api_calls_used, rate_limit_remaining, metadata
)
VALUES 
(
    'full_sync', 
    (SELECT id FROM repositories WHERE full_name = 'facebook/react' LIMIT 1),
    'completed',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour 45 minutes',
    1250, 1200, 45, 5,
    800, 4200,
    '{"sync_version": "1.0", "github_api_version": "2022-11-28"}'
),
(
    'incremental_sync',
    (SELECT id FROM repositories WHERE full_name = 'microsoft/vscode' LIMIT 1), 
    'completed',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '45 minutes',
    150, 120, 25, 5,
    200, 4800,
    '{"sync_version": "1.0", "last_sync": "2024-06-13T10:00:00Z"}'
),
(
    'contributor_sync',
    NULL,
    'completed',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '15 minutes',
    500, 480, 15, 5,
    350, 4650,
    '{"sync_version": "1.0", "contributors_processed": 500}'
);

-- Generate daily activity snapshots for the last 30 days
INSERT INTO daily_activity_snapshots (
    date, contributor_id, repository_id,
    pull_requests_opened, pull_requests_merged, pull_requests_closed,
    reviews_submitted, comments_made, lines_added, lines_removed
)
SELECT 
    date_day,
    c.id as contributor_id,
    NULL as repository_id, -- global activity
    (random() * 3)::integer as pull_requests_opened,
    (random() * 2)::integer as pull_requests_merged,
    (random() * 2)::integer as pull_requests_closed,
    (random() * 5)::integer as reviews_submitted,
    (random() * 10)::integer as comments_made,
    (random() * 500)::integer as lines_added,
    (random() * 250)::integer as lines_removed
FROM 
    contributors c
    CROSS JOIN generate_series(NOW() - INTERVAL '30 days', NOW(), INTERVAL '1 day') as date_day
WHERE c.github_id <= 1000000 -- Only use main test contributors
AND random() > 0.7; -- Only create activity for some days

-- Update statistics for better query planning
ANALYZE;

-- Success message
SELECT 'Seed data has been successfully inserted!' as message,
       (SELECT COUNT(*) FROM contributors) as contributors_count,
       (SELECT COUNT(*) FROM repositories) as repositories_count,
       (SELECT COUNT(*) FROM pull_requests) as pull_requests_count,
       (SELECT COUNT(*) FROM reviews) as reviews_count,
       (SELECT COUNT(*) FROM comments) as comments_count,
       (SELECT COUNT(*) FROM monthly_rankings) as rankings_count;