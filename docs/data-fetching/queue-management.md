# Queue Management System

## Overview

The Queue Management System provides a robust, scalable solution for processing repository data capture jobs across multiple processors (Inngest and GitHub Actions). It includes prioritization, monitoring, and automatic recovery mechanisms.

## Architecture

### Core Components

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Hybrid Queue      │────▶│  Prioritization  │────▶│   Processors    │
│     Manager         │     │     Service      │     │                 │
└─────────────────────┘     └──────────────────┘     │  - Inngest      │
         │                           │                │  - GitHub       │
         │                           │                │    Actions      │
         ▼                           ▼                └─────────────────┘
┌─────────────────────┐     ┌──────────────────┐            │
│   Job Status        │     │   Auto-Retry     │            │
│    Reporter         │     │    Service       │◀───────────┘
└─────────────────────┘     └──────────────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
            ┌──────────────────┐
            │    Monitoring    │
            │    Dashboard     │
            └──────────────────┘
```

## Queue Prioritization

### Priority Scoring Algorithm

The system calculates a priority score (0-100) for each job based on:

1. **Repository Priority (40% weight)**
   - High: 40 points
   - Medium: 20 points
   - Low: 10 points

2. **Repository Size (30% weight)**
   - Small: 30 points (faster to process)
   - Medium: 20 points
   - Large: 15 points
   - XL: 10 points (resource-intensive)

3. **Trigger Source (20% weight)**
   - Manual: 20 points (user-initiated)
   - Automatic: 10 points
   - Scheduled: 5 points

4. **Activity Level (10% weight)**
   - Very Active (>500 PRs/month): 10 points
   - Active (>100 PRs/month): 5 points

### Queue Rebalancing

The system automatically rebalances queues when load imbalance is detected:

```typescript
if (inngestPending / githubActionsPending > 3) {
  // Move medium-sized jobs from Inngest to GitHub Actions
}
```

## Job Status Lifecycle

### Status Flow

```
pending → processing → completed
                   ↓
                failed → retry_pending → processing
                   ↓
            permanent_failure
```

### Status Reporting

Each job maintains comprehensive metadata:
- Creation timestamp
- Start/completion times
- Progress tracking
- Error details
- Retry history
- Performance metrics

## Auto-Retry Mechanism

### Retry Configuration

```typescript
{
  maxRetries: 3,
  retryDelayMs: 60000,      // 1 minute base
  backoffMultiplier: 2      // Exponential backoff
}
```

### Retry Schedule

- 1st retry: 1 minute after failure
- 2nd retry: 2 minutes after 1st retry
- 3rd retry: 4 minutes after 2nd retry

### Permanent Failures

Jobs are marked as permanently failed when encountering:
- Repository not found
- Invalid repository format
- Unauthorized access
- Rate limit exceeded
- Repository is private/archived

## Processor Selection

### Routing Logic

```typescript
// Inngest (Real-time processor)
- Recent data (<24 hours)
- Small PR batches (<10 PRs)
- Manual triggers with small datasets
- Small/Medium repositories

// GitHub Actions (Bulk processor)
- Historical data (>24 hours)
- Large batches (>50 items)
- Scheduled jobs
- Large/XL repositories
```

### Processor Capabilities

| Feature | Inngest | GitHub Actions |
|---------|---------|----------------|
| Max Items | 50 | 1000 |
| Timeout | 5 min | 30 min |
| Concurrency | High | Medium |
| Cost | Higher | Lower |
| Best For | Real-time | Bulk/Historical |

## Monitoring and Health Checks

### Health Check Schedule

A scheduled function runs every 5 minutes to:
1. Update job statuses
2. Process retry queue
3. Rebalance processor loads
4. Calculate health metrics

### Key Metrics

- **Queue Depth**: Number of pending jobs per processor
- **Processing Rate**: Jobs completed per minute
- **Failure Rate**: Percentage of failed jobs
- **Retry Success Rate**: Percentage of successful retries
- **Average Duration**: Time to complete jobs by type

### Monitoring Dashboard

Available at `/dev/capture-monitor`, displays:
- Real-time queue statistics
- Active job progress
- Recent job history
- Processor health status

## Database Schema

### progressive_capture_jobs

```sql
CREATE TABLE progressive_capture_jobs (
  id UUID PRIMARY KEY,
  job_type VARCHAR(50),
  repository_id UUID,
  processor_type VARCHAR(20),
  status VARCHAR(20),
  time_range_days INTEGER,
  workflow_run_id BIGINT,
  metadata JSONB,
  error TEXT,
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);
```

### progressive_capture_progress

```sql
CREATE TABLE progressive_capture_progress (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES progressive_capture_jobs(id),
  total_items INTEGER,
  processed_items INTEGER,
  failed_items INTEGER,
  current_item TEXT,
  errors JSONB,
  updated_at TIMESTAMP
);
```

## API Integration

### Queue Event Endpoint

`POST /.netlify/functions/queue-event`

```json
{
  "eventName": "capture/repository.sync.graphql",
  "data": {
    "repositoryId": "uuid",
    "repositoryName": "owner/repo",
    "maxItems": 100,
    "priority": "high"
  }
}
```

### Health Check Endpoint

`GET /.netlify/functions/queue-health-check`

Returns current queue statistics and health metrics.

## Error Handling

### Error Categories

1. **Transient Errors** (Retryable)
   - Network timeouts
   - Temporary API unavailability
   - Rate limit (with backoff)

2. **Permanent Errors** (Non-retryable)
   - Authentication failures
   - Repository not found
   - Invalid input data

3. **System Errors** (Alert required)
   - Database connection failures
   - Processor unavailability
   - Configuration errors

### Error Recovery

- Automatic retries for transient errors
- Dead letter queue for permanent failures
- Alert generation for system errors
- Graceful degradation when possible

## Performance Optimization

### Batch Processing

- Group similar jobs for efficiency
- Minimize API calls through batching
- Reuse connections and contexts

### Caching Strategy

- Cache repository metadata
- Store partial results during processing
- Implement progressive data updates

### Resource Management

- Memory limits per job type
- CPU throttling for background jobs
- Concurrent job limits per processor

## Security Considerations

### Access Control

- Service role for database operations
- Scoped GitHub tokens per job
- Audit logging for all operations

### Data Protection

- Encrypt sensitive job metadata
- Sanitize error messages
- Implement rate limiting

## Troubleshooting

### Common Issues

1. **Jobs Stuck in Processing**
   - Check processor health
   - Review job logs
   - Manual status update if needed

2. **High Failure Rate**
   - Check API rate limits
   - Verify authentication tokens
   - Review error patterns

3. **Queue Backup**
   - Increase processor capacity
   - Adjust priority weights
   - Manual rebalancing

### Debug Tools

- Queue inspection commands
- Job replay functionality
- Performance profiling
- Error analysis reports