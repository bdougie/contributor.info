# Third-Party Integrations

This folder documents integrations with external services and APIs used by contributor.info.

## Contents

### GitHub Events Cache

- **[github-events-cache-integration.md](./github-events-cache-integration.md)** - Integration of GitHub events cache data into workspace analytics, providing real-time activity analytics with historical trends and velocity metrics

## Purpose

This directory documents:
- External service integrations
- API integrations
- Data synchronization strategies
- Authentication and authorization
- Rate limiting and quotas
- Error handling approaches

## Current Integrations

### GitHub API
Primary data source for:
- Repository information
- Contributor data
- Pull requests and issues
- Events and activity

### GitHub Events Cache
Provides:
- Star velocity metrics
- Fork trends
- Activity scores
- Timeline data for charting
- Unique contributor tracking

### Supabase
Backend services:
- Database (PostgreSQL)
- Authentication
- Edge Functions
- Real-time subscriptions

### PostHog
Analytics and feature flags:
- User behavior tracking
- Feature flag management
- A/B testing
- Session recording

### OpenAI
AI-powered features:
- Embeddings generation
- Repository summaries
- Semantic search

### Inngest
Background job processing:
- Scheduled tasks
- Event-driven workflows
- Retry logic
- Job monitoring

## Integration Patterns

### Authentication
- OAuth for GitHub
- API tokens for services
- Service role keys for backend

### Rate Limiting
- Exponential backoff
- Request queuing
- Token rotation
- Quota monitoring

### Error Handling
- Retry strategies
- Fallback mechanisms
- Graceful degradation
- User notification

## Data Flow

```
GitHub API → Events Cache → Database → React Components
```

### Enhanced Metrics Flow
1. GitHub API provides raw events
2. Events stored in `github_events_cache` table
3. SQL functions aggregate by workspace
4. React hooks fetch and cache
5. UI components display rich analytics

## Best Practices

1. **Always use exponential backoff** for external APIs
2. **Cache aggressively** to reduce API calls
3. **Handle rate limits gracefully** with user feedback
4. **Validate data** with Zod schemas
5. **Monitor integration health** with logging

## Configuration

### Required Environment Variables
- `GITHUB_TOKEN` - GitHub API access
- `OPENAI_API_KEY` - OpenAI API access
- `INNGEST_SIGNING_KEY` - Inngest authentication
- `POSTHOG_KEY` - PostHog analytics
- `SUPABASE_*` - Supabase configuration

### Optional Configuration
- Rate limit thresholds
- Cache durations
- Retry configurations
- Timeout values

## Monitoring

### Health Checks
- API availability
- Rate limit status
- Error rates
- Response times

### Alerts
- API quota exhaustion
- High error rates
- Slow response times
- Service outages

## Related Documentation

- [Architecture](../architecture/) - System architecture
- [API](../api/) - API documentation
- [Infrastructure](../infrastructure/) - Infrastructure setup
- [Edge Functions](../edge-functions/) - Edge function documentation
