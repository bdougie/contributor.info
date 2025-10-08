# My Work Dashboard

## Overview

The My Work feature provides a personalized dashboard showing GitHub items that require user attention, including PRs awaiting review, assigned issues, and unanswered discussions. It includes AI-powered response suggestions using semantic similarity search.

## Features

### Data Types Displayed
- **Review-Requested PRs**: Open pull requests where the user is requested as a reviewer
- **Assigned Issues**: Open issues assigned to the user
- **Unanswered Discussions**: Workspace-wide discussions that need responses (for maintainers)

### UI Components

#### MyWorkCard Component
Located at `src/components/workspace/MyWorkCard.tsx`

Key features:
- Paginated list of work items (10 items per page)
- Filter toggles for each item type (PRs, Issues, Discussions)
- "Respond" button for AI-powered response suggestions
- User avatar and activity descriptions
- Links to GitHub items

#### ResponsePreviewModal
Located at `src/components/workspace/ResponsePreviewModal.tsx`

Provides:
- AI-generated response suggestions
- Display of similar items found via embeddings
- Copy-to-clipboard functionality
- Loading and error states

### Data Fetching

#### useMyWork Hook
Located at `src/hooks/useMyWork.ts`

Queries:
```typescript
// Review-requested PRs
const reviewRequestedPRs = await supabase
  .from('pull_requests')
  .select('*')
  .eq('state', 'open')
  .in('repository_id', repoIds);

// Filter client-side for PRs where user is in reviewer_data.requested_reviewers

// Assigned issues
const assignedIssues = await supabase
  .from('github_issues')
  .select('*')
  .eq('state', 'open')
  .contains('assignees', [{ login: githubLogin }])
  .in('repository_id', repoIds);

// Unanswered discussions (workspace-wide)
const discussions = await supabase
  .from('discussions')
  .select('*')
  .eq('is_answered', false)
  .in('repository_id', repoIds);
```

## AI-Powered Response Suggestions

### Similarity Search
The feature uses vector embeddings to find similar items when generating responses:

1. **Lazy Loading**: Similarity search module is dynamically imported only when "Respond" is clicked
2. **Embedding Generation**: Items are embedded using MiniLM-L6-v2 (384 dimensions)
3. **Vector Search**: Finds top 4 similar items using cosine similarity
4. **Response Generation**: Creates contextual response based on similar items

### Implementation Details

```typescript
// Dynamic import to avoid loading ML models on page init
const { findSimilarItems, generateResponseMessage } = await import(
  '@/services/similarity-search'
);

// Find similar items
const similar = await findSimilarItems(item, workspaceId);

// Generate AI response
const response = await generateResponseMessage(item, similar);
```

## Database Schema

### Required Columns

#### pull_requests table
- `id`, `repository_id`, `number`, `title`, `state`
- `author_login`, `author_avatar_url`
- `reviewer_data` (JSONB): Contains `requested_reviewers` array
- `created_at`, `updated_at`
- `embedding` (vector(384)): For similarity search

#### github_issues table
- `id`, `repository_id`, `number`, `title`, `state`
- `author_login`, `author_avatar_url`
- `assignees` (JSONB): Array of assignee objects with `login` field
- `created_at`, `updated_at`
- `embedding` (vector(384)): For similarity search

#### discussions table
- `id`, `repository_id`, `number`, `title`
- `author_login`, `author_avatar_url`
- `is_answered` (boolean)
- `created_at`, `updated_at`
- `embedding` (vector(384)): For similarity search

## Embedding Generation

### Background Process
Embeddings are generated asynchronously via Inngest functions:

1. **Trigger**: Items without embeddings are processed every 15-30 minutes
2. **Edge Function**: `supabase/functions/compute-embeddings/index.ts`
3. **Storage**: Embeddings stored as 384-dimensional vectors in pgvector

### Manual Trigger
```bash
# Trigger embedding generation for specific workspace
curl -X POST https://your-project.supabase.co/functions/v1/compute-embeddings \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId": "uuid-here"}'
```

## Configuration

### Environment Variables
```env
# Required for similarity search
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# For edge functions (embedding generation)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
INNGEST_SIGNING_KEY=your-inngest-key
INNGEST_EVENT_KEY=your-event-key
```

### Feature Flags
The My Work feature is always enabled but can be hidden via workspace settings.

## Troubleshooting

### Common Issues

#### No Data Displaying
- Verify user has a GitHub login in the contributors table
- Check that repositories are tracked in the workspace
- Ensure database queries use correct column names (`username` not `github_login`)

#### Embeddings Not Found
- Embeddings are generated in background (15-30 min delay)
- Check Inngest dashboard for compute-embeddings function status
- Verify SUPABASE_SERVICE_ROLE_KEY is set in edge functions

#### "No similar items found" Message
This is expected behavior when:
- Embeddings haven't been generated yet (new items)
- No semantically similar items exist
- User can still copy the suggested response manually

#### Authorization Errors
For edge functions:
- Ensure SUPABASE_SERVICE_ROLE_KEY is set
- Check INNGEST_SIGNING_KEY and INNGEST_EVENT_KEY
- Verify authorization headers are included in requests

## Performance Considerations

### Optimizations Implemented
1. **Lazy Loading**: ML models only loaded when needed
2. **Debounced Search**: 300ms debounce on similarity searches
3. **Client-side Filtering**: Reduces database queries for reviewer data
4. **Pagination**: Limits UI rendering to 10 items per page

### Known Limitations
- Client-side JSONB filtering for `reviewer_data` (could be optimized with Postgres operators)
- Embedding generation has 15-30 minute delay
- Large workspaces may have slower initial load times

## Testing

### Unit Tests
```bash
npm test src/hooks/__tests__/useMyWork.test.ts
npm test src/components/workspace/__tests__/MyWorkCard.test.tsx
```

### Storybook
```bash
npm run storybook
# Navigate to Workspace/MyWorkCard stories
```

### Manual Testing
1. Login with GitHub account
2. Navigate to workspace dashboard
3. Verify items appear in My Work section
4. Test filter toggles
5. Click "Respond" and verify modal appears
6. Copy response and verify clipboard functionality

## Future Enhancements

### Planned Improvements
1. **Real-time Updates**: WebSocket subscriptions for live updates
2. **Batch Actions**: Respond to multiple items at once
3. **Custom Filters**: Save filter preferences
4. **Notification Integration**: Email/Slack notifications for new items
5. **Mobile Optimization**: Better responsive design for mobile devices

### Database Optimizations
1. Add indexes for frequently queried columns
2. Implement server-side JSONB filtering for reviewer_data
3. Add materialized views for complex queries
4. Implement caching layer for frequently accessed data

## Related Documentation

- [Similarity Detection](./similarity-detection.md) - How semantic search works
- [Workspace Documentation](./workspace-data-fetching.md) - Workspace data architecture
- [Database Schema](../database-schema.md) - Complete database structure
- [Inngest Integration](../data-fetching/inngest-integration.md) - Background job processing