# Contributor.info Database Schema Documentation

Last Updated: 2025-08-09

## Overview

The Contributor.info database tracks GitHub repositories and their associated data including pull requests, issues, reviews, comments, and contributor information.

## Tracked Repositories

Currently tracking **49 repositories** across various organizations. See `tracked-repositories.txt` for the complete list.

## Database Tables

### Core Tables

#### 1. `repositories`
Stores information about tracked GitHub repositories.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| github_id | bigint | GitHub repository ID |
| full_name | text | Full repository name (owner/repo) |
| owner | text | Repository owner |
| name | text | Repository name |
| description | text | Repository description |
| homepage | text | Repository homepage URL |
| language | text | Primary programming language |
| stargazers_count | integer | Number of stars |
| watchers_count | integer | Number of watchers |
| forks_count | integer | Number of forks |
| open_issues_count | integer | Number of open issues |
| default_branch | text | Default branch name |
| is_fork | boolean | Whether repository is a fork |
| is_archived | boolean | Whether repository is archived |
| is_private | boolean | Whether repository is private |
| topics | array | Repository topics |
| license | text | License information |
| github_created_at | timestamp | When created on GitHub |
| first_tracked_at | timestamp | When first tracked |
| last_updated_at | timestamp | Last update time |

#### 2. `contributors`
Stores GitHub user information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| github_id | bigint | GitHub user ID |
| username | text | GitHub username |
| display_name | text | Display name |
| avatar_url | text | Avatar URL |
| profile_url | text | Profile URL |
| email | text | Email address |
| company | text | Company |
| location | text | Location |
| bio | text | Bio |
| blog | text | Blog URL |
| public_repos | integer | Number of public repos |
| followers | integer | Number of followers |
| following | integer | Number following |
| is_bot | boolean | Whether user is a bot |
| github_created_at | timestamp | When created on GitHub |

#### 3. `pull_requests`
Stores pull request data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| github_id | bigint | GitHub PR ID |
| repository_id | uuid | Foreign key to repositories |
| number | integer | PR number |
| title | text | PR title |
| body | text | PR description |
| state | text | PR state (open/closed/merged) |
| author_id | uuid | Foreign key to contributors |
| base_branch | text | Base branch |
| head_branch | text | Head branch |
| draft | boolean | Whether PR is draft |
| merged | boolean | Whether PR was merged |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |
| merged_at | timestamp | Merge time |
| closed_at | timestamp | Close time |
| additions | integer | Lines added |
| deletions | integer | Lines deleted |
| changed_files | integer | Number of files changed |
| commits | integer | Number of commits |

#### 4. `issues`
Stores GitHub issues.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| github_id | bigint | GitHub issue ID |
| repository_id | uuid | Foreign key to repositories |
| number | integer | Issue number |
| title | text | Issue title |
| body | text | Issue description |
| state | text | Issue state |
| author_id | uuid | Foreign key to contributors |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |
| closed_at | timestamp | Close time |
| labels | jsonb | Issue labels |
| assignees | jsonb | Assigned users |
| comments_count | integer | Number of comments |

#### 5. `reviews`
Stores PR review data.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| github_id | bigint | GitHub review ID |
| pull_request_id | uuid | Foreign key to pull_requests |
| author_id | uuid | Review author (foreign key to contributors) |
| reviewer_id | uuid | Legacy reviewer field |
| state | text | Review state (approved/changes_requested/commented) |
| body | text | Review comment |
| submitted_at | timestamp | Submission time |

#### 6. `comments`
Stores PR and issue comments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| github_id | bigint | GitHub comment ID |
| pull_request_id | uuid | Foreign key to pull_requests |
| commenter_id | uuid | Foreign key to contributors |
| body | text | Comment text |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update time |
| comment_type | text | Type of comment |

## Supporting Tables

- `commits` - Stores commit information
- `organizations` - GitHub organizations
- `github_events_cache` - Cached GitHub events (partitioned by month)
- `github_sync_status` - Sync status tracking
- `progressive_capture_jobs` - Background job tracking
- `rate_limit_tracking` - GitHub API rate limit tracking
- `sync_logs` - Synchronization logs
- `spam_detections` - Spam detection records
- `rollout_configuration` - Feature rollout configuration

## Current Data Statistics

| Repository | Stars | Forks | PRs | Issues | Reviews | Comments |
|------------|-------|-------|-----|--------|---------|----------|
| pytorch/pytorch | - | - | 12,723 | 0 | 0 | 0 |
| continuedev/continue | 27,357 | 3,053 | 772 | 0 | 19 | 34 |
| kubernetes/kubernetes | 115,859 | 40,762 | 718 | 0 | 0 | 0 |
| argoproj/argo-cd | 19,876 | 6,098 | 639 | 0 | 0 | 0 |
| better-auth/better-auth | 15,485 | 1,089 | 500 | 0 | 0 | 0 |
| microsoft/vscode | 173,921 | 33,333 | 400 | 0 | 0 | 0 |
| etcd-io/etcd | 49,693 | 10,094 | 366 | 0 | 0 | 0 |
| vercel/next.js | 132,578 | 28,620 | 300 | 0 | 0 | 0 |
| vitejs/vite | 73,793 | 6,887 | 299 | 0 | 0 | 0 |
| supabase/supabase | - | - | 297 | 0 | 0 | 0 |

### Data Coverage Summary

- **Total Repositories**: 49
- **Total Pull Requests**: ~19,000+
- **Total Reviews**: 19 (limited data)
- **Total Comments**: ~900+
- **Repositories with Star Data**: 11
- **Repositories with Fork Data**: 11
- **Repositories with Issue Data**: 0 (not yet synced)

## Notes

1. **Data Sync Status**: 
   - Pull requests are being actively synced
   - Issues are not currently being synced (0 issues across all repos)
   - Reviews and comments have limited coverage
   - Star/fork counts are available for major repositories

2. **Duplicate Entry**: 
   - Both `supabase/supabase` and `Supabase/supabase` exist (case difference)

3. **Test Repositories**:
   - `test-org/test-repo` and `testuser/spam-test-repo` appear to be test entries

## Database Access

The database is hosted on Supabase with the project ID: `egcxzonpmmcirmgqdrla`

### Environment Variables

```bash
VITE_SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_TOKEN=<your-service-role-key>
```

## Related Files

- `/tracked-repositories.txt` - List of all tracked repositories
- `/supabase/migrations/` - Database migration files
- `/supabase/IMPLEMENTATION_GUIDE.md` - Setup documentation
- `/supabase/QUICK_REFERENCE.md` - Common queries and commands