-- Mark the contributor.info repository as having the GitHub App installed
-- This is for repositories that had the app installed before the tracking system was added

-- Insert a record for bdougie/contributor.info
INSERT INTO github_app_installations (
  installation_id,
  owner,
  repo,
  status,
  installed_at,
  installed_by,
  app_id,
  account_type,
  account_id,
  account_login,
  target_type,
  permissions,
  events,
  created_at,
  updated_at
) VALUES (
  123456789, -- You can update this with the actual installation ID if known
  'bdougie',
  'contributor.info',
  'active',
  NOW(),
  'bdougie',
  'contributor-info',
  'User',
  1234567, -- Your GitHub user ID (update if known)
  'bdougie',
  'User',
  '{"contents": "read", "pull_requests": "write", "issues": "read", "metadata": "read"}',
  '["pull_request", "issues", "issue_comment"]',
  NOW(),
  NOW()
) ON CONFLICT (owner, repo) 
DO UPDATE SET 
  status = 'active',
  updated_at = NOW();

-- You can add more repositories here if needed
-- For example:
-- INSERT INTO github_app_installations (...) VALUES (...) ON CONFLICT (owner, repo) DO UPDATE SET ...;