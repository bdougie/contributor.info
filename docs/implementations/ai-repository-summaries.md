# AI Repository Summaries Feature

## Overview

The AI Repository Summaries feature adds intelligent, contextual summaries to repository pages using OpenAI's GPT models and pgvector for semantic search. This feature automatically generates and caches descriptions that summarize recent repository activity and provide insights for potential contributors.

## Features

### 🤖 AI-Generated Summaries
- **Smart Analysis**: Uses OpenAI GPT-4o-mini to analyze repository metadata and recent pull requests
- **Contextual Insights**: Provides information about what the repository does, recent activity, and current focus areas
- **Cost-Effective**: Uses optimized models and token limits to minimize API costs

### 🗄️ pgvector Integration
- **Vector Embeddings**: Creates semantic embeddings using OpenAI's text-embedding-3-small model
- **Similarity Search**: Enables future similarity-based repository discovery
- **PostgreSQL Integration**: Uses Supabase's pgvector extension for efficient vector storage

### ⚡ Smart Caching
- **14-Day Cache**: Summaries are cached for 2 weeks to reduce API calls
- **Activity-Based Invalidation**: Uses hash of recent PR activity to detect when updates are needed
- **Database Persistence**: Cached in PostgreSQL for reliability across sessions

### 🎨 User Experience
- **Loading States**: Smooth skeleton loading during summary generation
- **Error Handling**: Graceful fallbacks when AI services are unavailable
- **Manual Refresh**: Users can manually regenerate summaries
- **Responsive Design**: Works seamlessly across device sizes

## Architecture

### Database Schema

```sql
-- Added to repositories table
ALTER TABLE repositories ADD COLUMN ai_summary TEXT;
ALTER TABLE repositories ADD COLUMN embedding VECTOR(1536); -- OpenAI embeddings
ALTER TABLE repositories ADD COLUMN summary_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE repositories ADD COLUMN recent_activity_hash TEXT;
```

### Edge Function

**Location**: `supabase/functions/repository-summary/index.ts`

**Functionality**:
- Analyzes repository data and recent pull requests
- Generates concise 2-3 sentence summaries
- Creates vector embeddings for semantic search
- Implements intelligent caching logic
- Handles rate limiting and error scenarios

**API Usage**:
```typescript
POST /functions/v1/repository-summary
{
  "repository": { /* repo data */ },
  "pullRequests": [ /* recent PRs */ ],
  "forceRegeneration": false
}
```

### Frontend Components

**Hook**: `src/hooks/use-repository-summary.ts`
- Manages summary fetching and caching
- Handles loading, error, and success states
- Provides refetch functionality

**Component**: `src/components/features/repository/repository-summary-card.tsx`
- Displays AI summary with proper styling
- Shows loading skeletons and error states
- Includes refresh button for manual updates

## Usage

### Basic Integration

The AI summary automatically appears on repository pages:

```tsx
<RepositorySummaryCard 
  owner="facebook" 
  repo="react" 
  pullRequests={recentPRs}
/>
```

### Manual Refresh

Users can manually regenerate summaries by clicking the refresh button, which calls the edge function with `forceRegeneration: true`.

## Configuration

### Environment Variables

Required for the edge function:
- `OPENAI_API_KEY`: OpenAI API key for GPT and embeddings
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database updates

### Model Selection

- **Summaries**: `gpt-4o-mini` (cost-effective, good quality)
- **Embeddings**: `text-embedding-3-small` (1536 dimensions)
- **Token Limits**: 300 tokens max for summaries

## Caching Strategy

### Cache Duration
- **Primary Cache**: 14 days from generation
- **Activity Hash**: Based on 10 most recent PRs
- **Invalidation**: Triggered by new PR activity or manual refresh

### Cache Logic
```typescript
function needsRegeneration(repo, activityHash) {
  // Check if summary is older than 14 days
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const generatedAt = new Date(repo.summary_generated_at);
  
  // Regenerate if old or activity changed
  return generatedAt < fourteenDaysAgo || 
         repo.recent_activity_hash !== activityHash;
}
```

## Cost Optimization

### Token Management
- **Concise Prompts**: Optimized prompts to minimize input tokens
- **Response Limits**: 300 token limit for summaries
- **Batch Processing**: Future consideration for bulk operations

### Model Selection
- Uses cost-effective models without sacrificing quality
- `gpt-4o-mini` provides good summaries at lower cost
- `text-embedding-3-small` offers best price/performance for embeddings

### Caching Benefits
- 14-day cache reduces API calls by ~95%
- Activity-based invalidation ensures freshness
- Database persistence eliminates redundant calls

## Error Handling

### Graceful Degradation
- Repository pages work normally without summaries
- Clear error messages when generation fails
- Retry buttons for temporary failures

### Common Errors
- **API Key Missing**: Clear configuration message
- **Rate Limits**: Automatic retry with exponential backoff
- **Network Issues**: Timeout handling and fallbacks
- **Repository Not Found**: Proper error messaging

## Performance

### Loading Strategy
- **Non-blocking**: Summary loads independently of main content
- **Progressive Enhancement**: Page works without AI features
- **Skeleton Loading**: Visual feedback during generation

### Database Impact
- **Minimal Overhead**: Vector storage adds ~6KB per repository
- **Efficient Indexes**: ivfflat index for vector similarity
- **Controlled Growth**: Only active repositories get summaries

## Future Enhancements

### Planned Features
1. **Admin Dashboard**: Cache management and regeneration controls
2. **Similar Repositories**: Use embeddings for recommendation engine
3. **Bulk Operations**: Process multiple repositories efficiently
4. **Analytics**: Track usage and effectiveness metrics

### Potential Improvements
- **Streaming**: Real-time summary generation
- **Personalization**: User-specific summary focus
- **Multiple Languages**: Support for non-English repositories
- **Trend Analysis**: Historical summary comparisons

## Testing

### Unit Tests
- Hook functionality with mocked dependencies
- Component rendering in different states
- Error handling scenarios

### Integration Tests
- End-to-end summary generation
- Cache invalidation logic
- Database persistence

### Manual Testing
```bash
# Run tests
npm test

# Test specific components
npm test -- --run src/hooks/__tests__/use-repository-summary.test.ts
npm test -- --run src/components/features/repository/__tests__/repository-summary-card.test.tsx
```

## Deployment

### Database Migration
1. Apply the pgvector migration: `20250103000000_add_ai_summaries_support.sql`
2. Verify vector extension is enabled
3. Check indexes are created properly

### Edge Function Deployment
1. Deploy `repository-summary` function to Supabase
2. Configure environment variables
3. Test with sample repository data

### Frontend Deployment
1. Build and deploy frontend with new components
2. Monitor for any runtime errors
3. Verify integration with existing features

## Monitoring

### Key Metrics
- **Generation Success Rate**: % of successful summary generations
- **Cache Hit Rate**: % of requests served from cache
- **API Cost**: Monthly OpenAI usage and costs
- **User Engagement**: Summary view and interaction rates

### Alerts
- High API error rates
- Cache performance degradation
- Unusual cost spikes
- Vector index performance issues

## Security

### Data Privacy
- No sensitive data sent to OpenAI
- Only public repository information used
- User data remains in Supabase

### API Security
- Secure API key management
- Rate limiting on edge functions
- Input validation and sanitization

### Access Control
- Leverages existing Supabase RLS policies
- Admin-only cache management functions
- Proper error handling to prevent data leaks