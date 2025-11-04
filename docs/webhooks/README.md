# Webhook Documentation

This folder contains documentation for webhook systems, integrations, and improvements.

## Contents

### System Improvements

- **[improvements-sept-2025.md](./improvements-sept-2025.md)** - September 2025 webhook system improvements addressing security, reliability, and code quality concerns

## Purpose

This directory documents:
- Webhook architecture and design
- Integration patterns
- Security measures
- Event handling
- Error recovery
- Performance optimizations

## Webhook System Overview

### Purpose
The webhook system processes events from external services (primarily GitHub) to keep repository data synchronized in real-time.

### Architecture
```
GitHub → Fly.io Handler → Event Router → Service Handlers → Database
```

### Key Components

#### Event Router
- Manages event debouncing
- Implements rate limiting
- Routes events to appropriate handlers
- Tracks event statistics

#### Check Run Manager
- Creates and updates GitHub check runs
- Handles annotations and output
- Manages check run lifecycle

#### Similarity Updater
- Updates PR similarity scores
- Calculates contributor matches
- Invalidates cache when needed

## Webhook Events

### GitHub Events
Supported event types:
- `pull_request` - PR opened, closed, edited
- `pull_request_review` - Reviews submitted
- `issues` - Issues opened, closed, edited
- `push` - Commits pushed
- `repository` - Repository changes
- `star` - Stars added/removed
- `fork` - Repository forked

### Event Processing

#### Debouncing
Events are debounced to prevent duplicate processing:
- Window: 30 seconds
- Per event ID
- Automatic cleanup after processing

#### Rate Limiting
- Tracks events per repository
- Implements cooldown periods
- Queues events during high load
- Retry logic for failed events

## Security

### Environment Variables
All sensitive data uses environment variables:
- No hardcoded API keys
- Configuration via `.env.example`
- Runtime validation
- Internal user filtering

### Webhook Verification
- Signature validation (GitHub)
- Event source verification
- Payload validation
- Authentication checks

## Reliability Improvements

### Memory Leak Prevention
Try-catch-finally blocks ensure cleanup:
```typescript
try {
  await processEvent(event);
} catch (error) {
  console.error('Error:', error);
} finally {
  // Always cleanup resources
  cleanup();
}
```

### Safe Null Handling
Explicit checks for undefined values:
```typescript
annotations: params.output.annotations
  ? params.output.annotations.slice(0, 50)
  : undefined
```

### Error Recovery
- Automatic retry with exponential backoff
- Error logging with context
- Graceful degradation
- User-friendly error messages

## Test Coverage

### Event Router Tests
- Event debouncing behavior
- Rate limiting logic
- Error handling
- State management
- Timer cancellation

### Check Run Manager Tests
- Check run creation/updates
- Annotation handling
- Output formatting
- GitHub API integration

## Performance Optimizations

### Event Batching
- Groups related events
- Reduces database calls
- Minimizes API requests

### Cache Management
- Strategic cache invalidation
- Proper invalidation order
- Cache warming strategies

### Database Optimization
- Efficient queries
- Connection pooling
- Index optimization

## Monitoring

### Metrics
- Event processing rate
- Error rates by event type
- Debouncing effectiveness
- Rate limit hits
- Processing latency

### Logging
- Structured logging
- Event IDs for tracing
- Error context
- Performance timing

## Best Practices

1. **Always validate payloads** with Zod schemas
2. **Use environment variables** for configuration
3. **Implement proper error handling** with cleanup
4. **Log meaningful context** for debugging
5. **Test edge cases** (null, undefined, oversized data)
6. **Monitor webhook health** continuously

## Troubleshooting

### Webhook Not Receiving Events
1. Verify webhook URL in GitHub settings
2. Check signature validation
3. Review firewall rules
4. Test with webhook delivery log

### Events Not Processing
1. Check event router logs
2. Verify database connectivity
3. Review rate limit status
4. Check for debouncing delays

### High Error Rates
1. Review error logs for patterns
2. Check external service status
3. Verify API credentials
4. Review rate limits

## Configuration

### GitHub Webhook Setup
1. Go to repository settings
2. Add webhook URL
3. Select events to receive
4. Set secret for signature validation
5. Configure content type (JSON)

### Fly.io Deployment
```bash
fly deploy --config fly.toml
```

### Environment Variables
```bash
GITHUB_WEBHOOK_SECRET=xxx
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Related Documentation

- [Infrastructure](../infrastructure/) - Infrastructure setup
- [Integrations](../integrations/) - Third-party integrations
- [Architecture](../architecture/) - System architecture
- [API](../api/) - API documentation
