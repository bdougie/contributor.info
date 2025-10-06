# Workspace Discussions

## Overview

The workspace discussions feature displays GitHub Discussions from all repositories in a workspace, providing a unified view of community conversations, Q&A, and announcements across projects.

## Architecture

### Core Components

1. **WorkspaceDiscussionsTable Component**
   - Location: `src/components/features/workspace/WorkspaceDiscussionsTable.tsx`
   - Displays discussions with filtering, sorting, and search
   - Aggregates discussions from all workspace repositories
   - Supports answered/unanswered filtering and category navigation

2. **Database Schema**
   - Uses `discussions` table from migration #985
   - Joins with `repositories` table for context
   - Author data stored directly in discussions table

3. **UI Integration**
   - Discussions tab in workspace pages (between Issues and Contributors)
   - Responsive 4x2 grid layout for workspace tabs
   - Real-time search and filtering

## Database Schema

### discussions Table

```sql
CREATE TABLE discussions (
    id VARCHAR PRIMARY KEY,              -- GraphQL node ID (e.g., "D_kwDOOaQzwc4AgPdF")
    github_id BIGINT NOT NULL,           -- Discussion number (unique per repo)
    repository_id UUID REFERENCES repositories(id),
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,

    -- Category
    category_id VARCHAR,
    category_name VARCHAR,
    category_description TEXT,
    category_emoji VARCHAR,

    -- Author
    author_id BIGINT,                    -- GitHub user ID
    author_login VARCHAR,                -- GitHub username (stored directly)

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    -- Answer status
    is_answered BOOLEAN,
    answer_id VARCHAR,
    answer_chosen_at TIMESTAMPTZ,
    answer_chosen_by VARCHAR,

    -- Metrics
    upvote_count INTEGER,
    comment_count INTEGER,

    -- Metadata
    url VARCHAR NOT NULL,
    locked BOOLEAN,
    synced_at TIMESTAMPTZ
);
```

**Key Design Decisions:**
- `id` stores GraphQL node ID (string) for unique identification
- `github_id` stores discussion number for compatibility
- `author_login` stored directly (no join to contributors table needed)
- `author_id` is GitHub user ID (bigint), not contributor UUID

## Component Features

### WorkspaceDiscussionsTable

**Location:** `src/components/features/workspace/WorkspaceDiscussionsTable.tsx`

**Features:**
- Real-time search by discussion title
- Sort by: Newest, Most Upvoted, Most Commented
- Filter by: All, Answered, Unanswered
- Category filtering (dynamic based on available categories)
- Repository badges showing source repo
- Answer status indicators
- Upvote and comment counts
- Links to GitHub discussions

**Props:**
```typescript
interface WorkspaceDiscussionsTableProps {
  repositories: Array<{
    id: string;
    name: string;
    owner: string;
    full_name: string;
  }>;
  selectedRepositories: string[];
  timeRange?: string;
  onRefresh?: () => void;
}
```

**Data Fetching:**
```typescript
const { data, error } = await supabase
  .from('discussions')
  .select(`
    *,
    repositories (
      name,
      owner,
      full_name
    )
  `)
  .in('repository_id', repoIds)
  .order('updated_at', { ascending: false })
  .limit(200);
```

## Data Backfilling

### Backfill Script

**Location:** `scripts/data-sync/backfill-discussions.mjs`

Fetches discussions from GitHub GraphQL API and inserts them into the database.

**Usage:**
```bash
# Backfill discussions for a repository
GITHUB_TOKEN=your_token node scripts/data-sync/backfill-discussions.mjs \
  --repository-id=<uuid> \
  --repository-name=owner/repo

# Limit number of discussions
GITHUB_TOKEN=your_token node scripts/data-sync/backfill-discussions.mjs \
  --repository-id=<uuid> \
  --repository-name=owner/repo \
  --max-items=50
```

**Parameters:**
- `--repository-id` (required): UUID of repository in database
- `--repository-name` (required): GitHub repository in format `owner/repo`
- `--max-items` (optional): Maximum discussions to fetch (default: 100)

**Environment Variables:**
```bash
GITHUB_TOKEN=ghp_...              # GitHub personal access token
VITE_GITHUB_TOKEN=ghp_...         # Alternative token location
VITE_SUPABASE_URL=https://...     # Supabase project URL
SUPABASE_TOKEN=...                # Supabase service role key
VITE_SUPABASE_ANON_KEY=...        # Alternative Supabase key
```

**Required GitHub Token Scopes:**
- `public_repo` (for public repositories)
- `repo` (for private repositories)
- `read:discussion` (recommended but not strictly required for public repos)

### GraphQL Query

The script uses GitHub's GraphQL API to fetch discussion data:

```graphql
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
    discussions(first: 50, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        number
        title
        body
        url
        createdAt
        updatedAt
        locked
        author {
          login
          ... on User {
            databaseId
          }
        }
        category {
          id
          name
          description
          emoji
        }
        answer {
          id
          createdAt
          author {
            login
          }
        }
        upvoteCount
        comments {
          totalCount
        }
      }
    }
  }
}
```

### Finding Repository ID

To get the repository UUID for backfilling:

```sql
SELECT id, full_name
FROM repositories
WHERE full_name = 'owner/repo';
```

Or use the workspace UI to find repository IDs.

## UI Integration

### Workspace Page

**Location:** `src/pages/workspace-page.tsx`

The Discussions tab is integrated into workspace pages:

```tsx
<TabsList className="grid w-full grid-cols-4 lg:flex lg:w-auto gap-2">
  <TabsTrigger value="prs">PRs</TabsTrigger>
  <TabsTrigger value="issues">Issues</TabsTrigger>
  <TabsTrigger value="discussions">
    <MessageSquare className="h-4 w-4" />
    <span className="hidden sm:inline">Discussions</span>
  </TabsTrigger>
  <TabsTrigger value="contributors">Contributors</TabsTrigger>
</TabsList>

<TabsContent value="discussions">
  <WorkspaceDiscussionsTable
    repositories={repositories}
    selectedRepositories={selectedRepositories}
    timeRange={timeRange}
  />
</TabsContent>
```

### Empty States

The component handles three empty states:
1. **Active Filters**: "Try adjusting your filters or search terms."
2. **No Discussions**: "No discussions in workspace repositories yet."
3. **Filtered Out**: "No discussions match your criteria."

## GitHub App Permissions

For automatic syncing via webhooks, ensure the GitHub App has:
- **Discussions** permission: Read-only (minimum)

The GitHub App can be configured at:
https://github.com/settings/apps/contributor-info

## Testing

### Manual Testing

1. **View Discussions:**
   - Navigate to workspace page
   - Click Discussions tab
   - Verify discussions load correctly

2. **Filter Testing:**
   - Search by title
   - Filter by answered/unanswered
   - Filter by category
   - Sort by newest/upvotes/comments

3. **Repository Selection:**
   - Select specific repositories
   - Verify only those discussions show
   - Clear selection to see all

### Backfill Testing

```bash
# Test with dry run
GITHUB_TOKEN=your_token node scripts/data-sync/backfill-discussions.mjs \
  --repository-id=uuid \
  --repository-name=owner/repo \
  --max-items=5

# Verify in database
SELECT id, number, title, category_name, is_answered
FROM discussions
WHERE repository_id = 'uuid'
ORDER BY created_at DESC;
```

## Monitoring

### Query Performance

Check discussion query performance:

```sql
EXPLAIN ANALYZE
SELECT d.*, r.full_name
FROM discussions d
LEFT JOIN repositories r ON d.repository_id = r.id
WHERE d.repository_id = ANY($1::uuid[])
ORDER BY d.updated_at DESC
LIMIT 200;
```

### Discussion Counts by Repository

```sql
SELECT
  r.full_name,
  COUNT(d.id) as discussion_count,
  COUNT(d.id) FILTER (WHERE d.is_answered) as answered_count,
  COUNT(DISTINCT d.category_name) as category_count
FROM repositories r
LEFT JOIN discussions d ON d.repository_id = r.id
GROUP BY r.id, r.full_name
ORDER BY discussion_count DESC;
```

### Recent Activity

```sql
SELECT
  d.title,
  d.category_name,
  d.author_login,
  d.upvote_count,
  d.comment_count,
  d.is_answered,
  d.created_at,
  r.full_name
FROM discussions d
JOIN repositories r ON d.repository_id = r.id
ORDER BY d.created_at DESC
LIMIT 10;
```

## Troubleshooting

### Common Issues

1. **"Failed to load discussions" Error**
   - Check Supabase query in browser console
   - Verify repository_id exists in discussions table
   - Ensure repositories table has matching records

2. **No Discussions Showing**
   - Verify discussions exist in database for workspace repos
   - Check repository selection filters
   - Run backfill script to populate data

3. **Backfill Script Errors**
   - **"Bad credentials"**: GitHub token is invalid or expired
   - **"Rate limit exceeded"**: Wait for rate limit reset or use authenticated token
   - **Invalid repository format**: Use `owner/repo` format
   - **Type mismatch**: Ensure script uses `id` for GraphQL node ID, `github_id` for number

### Debug Queries

```sql
-- Check discussions by repository
SELECT
  r.full_name,
  COUNT(d.id) as count
FROM repositories r
LEFT JOIN discussions d ON r.id = d.repository_id
WHERE r.id IN (
  SELECT repository_id
  FROM workspace_repositories
  WHERE workspace_id = 'your-workspace-id'
)
GROUP BY r.id, r.full_name;

-- Find orphaned discussions (no repository)
SELECT COUNT(*)
FROM discussions
WHERE repository_id IS NULL
   OR repository_id NOT IN (SELECT id FROM repositories);

-- Check author data quality
SELECT
  author_login,
  author_id,
  COUNT(*) as discussion_count
FROM discussions
GROUP BY author_login, author_id
ORDER BY discussion_count DESC;
```

## Performance Considerations

1. **Query Limits**: Component limits to 200 discussions per workspace
2. **Client-side Filtering**: Filtering/sorting done in React (not database)
3. **No Pagination**: Currently shows all results up to limit
4. **Index Requirements**: Ensure indexes on `repository_id` and `updated_at`

### Recommended Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_discussions_repository_updated
ON discussions(repository_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_discussions_category
ON discussions(category_name)
WHERE category_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_discussions_answered
ON discussions(is_answered)
WHERE is_answered = true;
```

## Future Enhancements

- [ ] Discussion comments synchronization
- [ ] Real-time updates via webhooks
- [ ] Pagination for large discussion lists
- [ ] Advanced search (body content, author)
- [ ] Discussion creation from workspace UI
- [ ] Notification system for new discussions
- [ ] Analytics on discussion engagement
- [ ] Export discussions to CSV/JSON

## Related Documentation

- [Workspace Data Fetching](/docs/features/workspace-data-fetching.md)
- [GitHub Discussions Schema Migration](/supabase/migrations/20250531000000_github_discussions_support.sql)
- [GitHub GraphQL API - Discussions](https://docs.github.com/en/graphql/reference/objects#discussion)
- [Issue #986: Discussions Webhook UI](https://github.com/bdougie/contributor.info/issues/986)
- [PR #988: Add Discussions Tab](https://github.com/bdougie/contributor.info/pull/988)
