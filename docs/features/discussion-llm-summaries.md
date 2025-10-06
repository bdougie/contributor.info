# Discussion LLM Summaries

## Overview

AI-generated summaries for GitHub Discussions replace truncated markdown previews with concise, readable summaries generated using LLM services (GPT-4, Claude, etc.).

## Problem Statement

**Before**: Discussion previews showed truncated markdown content that:
- Cut off mid-sentence or mid-formatting
- Displayed raw markdown syntax instead of readable text
- Didn't provide meaningful context about the discussion
- Created poor visual experience in cards/tables

**After**: AI-generated summaries that:
- Capture the key question/topic being discussed
- Provide 1-2 sentence readable previews
- Use plain text (no markdown formatting issues)
- Cache in database to avoid repeated API calls

## Architecture

### Components

1. **LLM Service** (`src/lib/llm/llm-service.ts`)
   - `generateDiscussionSummary()` - Main entry point
   - Uses gpt-4o-mini model for cost efficiency
   - 150 character limit for summaries
   - 24-hour cache TTL
   - PostHog tracking for observability

2. **React Hook** (`src/hooks/use-discussion-summary.ts`)
   - `useDiscussionSummary()` - Client-side hook for fetching summaries
   - Requires authentication (PLG motion + cost control)
   - Race condition protection
   - Auto-cleanup on unmount

3. **Service Layer** (`src/services/discussion-summary.service.ts`)
   - `generateDiscussionSummary()` - Generate and store single summary
   - `batchGenerateDiscussionSummaries()` - Batch processing for backfill
   - `generateSummariesForRepository()` - Repository-level generation
   - `updateDiscussionSummary()` - Webhook integration point

4. **UI Integration** (`src/components/features/workspace/WorkspaceDiscussionsTable.tsx`)
   - Displays summary if available, falls back to truncated body
   - No loading states - summaries appear when ready

### Database Schema

```sql
-- Migration: add_discussion_summary_column
ALTER TABLE discussions
ADD COLUMN IF NOT EXISTS summary TEXT;

CREATE INDEX IF NOT EXISTS idx_discussions_summary
ON discussions(summary)
WHERE summary IS NOT NULL;

COMMENT ON COLUMN discussions.summary IS
'AI-generated summary of discussion content (1-2 sentences, plain text)';
```

## Implementation Details

### Summary Generation Flow

1. **Client Request** (via hook)
   ```typescript
   const { summary, loading } = useDiscussionSummary({
     id: discussion.id,
     title: discussion.title,
     body: discussion.body,
   });
   ```

2. **LLM Service** (generates summary)
   - Checks cache first (24-hour TTL)
   - Builds prompt from title + body (first 500 chars)
   - Calls gpt-4o-mini with 150 token limit
   - Returns plain text summary

3. **Database Storage** (persistence)
   - Summary stored in `discussions.summary` column
   - Indexed for fast queries
   - Used as fallback on subsequent loads

### Prompt Engineering

The LLM prompt is designed to:
- Capture the MAIN QUESTION or TOPIC
- Highlight KEY POINTS raised
- Use PLAIN TEXT (no markdown)
- Stay under 150 characters
- Focus on WHAT is discussed, not who/when

Example good summary:
```
"How to implement authentication with OAuth2 and handle token refresh for API requests"
```

Example bad summary:
```
"This discussion asks about implementing OAuth2 authentication and various token-related issues"
```

### Cost Management

1. **Caching Strategy**
   - 24-hour cache TTL (discussions are stable)
   - Database persistence (avoid regeneration)
   - Client-side cache via hook

2. **Rate Limiting**
   - 100ms delay between batch requests
   - Authentication required (limits usage)
   - PostHog tracking for monitoring

3. **Model Selection**
   - Uses gpt-4o-mini (cost-effective)
   - 150 token limit (minimal cost)
   - Fallback to title truncation if LLM fails

## Usage

### Client-Side (React Hook)

```typescript
import { useDiscussionSummary } from '@/hooks/use-discussion-summary';

function DiscussionCard({ discussion }) {
  const { summary, loading, requiresAuth } = useDiscussionSummary(discussion);

  if (requiresAuth) {
    return <div>Login required to see AI summaries</div>;
  }

  return (
    <div>
      <h3>{discussion.title}</h3>
      {loading ? (
        <Skeleton className="h-4 w-3/4" />
      ) : (
        summary && <p className="text-muted-foreground">{summary}</p>
      )}
    </div>
  );
}
```

### Server-Side (Batch Processing)

```typescript
import { generateSummariesForRepository } from '@/services/discussion-summary.service';

// Backfill summaries for a repository
const results = await generateSummariesForRepository(
  'repo-uuid',
  (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  }
);

console.log(`Generated ${results.filter(r => r.success).length} summaries`);
```

### Webhook Integration (Future)

When discussion webhooks are implemented:

```typescript
import { updateDiscussionSummary } from '@/services/discussion-summary.service';

// In webhook handler
async function handleDiscussionUpdated(event) {
  const { discussion } = event;

  await updateDiscussionSummary(discussion.id, {
    title: discussion.title,
    body: discussion.body,
  });
}
```

## Testing

### Unit Tests

1. **LLM Service Tests** (`src/lib/llm/__tests__/llm-service.test.ts`)
   - Summary generation
   - Cache behavior
   - Fallback handling
   - PostHog tracking

2. **Hook Tests** (`src/hooks/__tests__/use-discussion-summary.test.ts`)
   - Authentication requirements
   - Race condition protection
   - Error handling
   - Loading states

3. **Service Tests** (`src/services/__tests__/discussion-summary.service.test.ts`)
   - Batch processing
   - Database persistence
   - Error recovery

### Integration Testing

```bash
# Run all summary-related tests
npm test -- discussion-summary

# Test with real LLM service (requires API key)
OPENAI_API_KEY=xxx npm test -- use-discussion-summary
```

## Monitoring

### PostHog Analytics

Track summary generation with:
- Feature: `discussion-summary`
- User ID (if authenticated)
- Trace ID for debugging
- Token usage and costs

### Performance Metrics

- Cache hit rate (target: >80%)
- Generation latency (target: <2s)
- Fallback rate (target: <5%)
- Cost per summary (target: <$0.001)

## Future Enhancements

### Phase 2: Webhook Integration
- Generate summaries automatically when discussions are created/updated
- Use Inngest for background processing
- Retry logic for failures

### Phase 3: Multi-Language Support
- Detect discussion language
- Generate summaries in appropriate language
- Support for non-English discussions

### Phase 4: Semantic Search
- Use summaries for discussion search
- Improve relevance with AI-generated metadata
- Tag extraction from summaries

## Related Issues

- #992 - Use LLM Service to Generate Discussion Summaries
- #988 - GitHub Discussions tab to workspace pages
- #985 - Discussions database schema

## Migration Notes

### Backfilling Existing Discussions

```bash
# Using the service
node scripts/backfill-discussion-summaries.mjs --repository-id=<uuid>

# Or via admin UI (future)
# Navigate to Admin > Discussions > Generate Summaries
```

### Database Migration

The migration has been applied to add the `summary` column:
- Migration: `add_discussion_summary_column`
- Applied: 2025-01-06
- Backwards compatible: Yes (nullable column)
