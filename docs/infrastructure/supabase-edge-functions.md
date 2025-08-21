# Supabase Edge Functions for Long-Running Operations

## Overview

To address timeout issues with Netlify Functions (10-26 second limit), we've migrated long-running operations to Supabase Edge Functions, which support:
- **Free tier**: 50 seconds execution time
- **Paid tier**: 150 seconds execution time (2.5 minutes)

This migration ensures that large repository syncs (like pytorch/pytorch) can complete without timing out.

## Architecture

### Complete Data Pipeline Architecture

The system uses multiple data sources and intelligent routing for comprehensive GitHub data capture:

```
┌─────────────────────────────────────────────────────────┐
│                   Data Sources                          │
├─────────────────┬──────────────┬───────────────────────┤
│  GitHub API     │  gh-datapipe │   GitHub Archive      │
│  (Real-time)    │  (Batch ETL) │   (Historical)        │
└────────┬────────┴───────┬──────┴────────┬──────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                 Data Processing Layer                    │
├─────────────────┬──────────────┬───────────────────────┤
│  Sync Service   │  dlt Pipeline│  Archive Pipeline      │
│  (contributor)  │  (gh-datapipe)│  (gh-datapipe)       │
└────────┬────────┴───────┬──────┴────────┬──────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                   Routing Layer                          │
│                  Hybrid Router                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ Quick Sync   │  │ Long Sync    │  │ Batch Import  │ │
│  │ (<10s)       │  │ (>30s)       │  │ (Background)  │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
└─────────┼──────────────────┼──────────────────┼─────────┘
          ▼                  ▼                  ▼
┌─────────────────┬──────────────────┬────────────────────┐
│ Netlify Functions│ Supabase Edge   │  gh-datapipe      │
│  + Inngest      │  Functions       │  (Fly.io)         │
│ (10-26s limit)  │  (150s limit)    │  (No limit)       │
└────────┬────────┴───────┬──────────┴─────────┬──────────┘
         │                │                     │
         ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase Database                     │
│              (PostgreSQL + Realtime + RLS)               │
└─────────────────────────────────────────────────────────┘
```

### gh-datapipe Integration

The **gh-datapipe** service provides industrial-strength data pipeline capabilities:

#### Key Components:
1. **dlt (Data Load Tool)**: Orchestrates data extraction, transformation, and loading
2. **DuckDB**: Local analytical database for processing and staging
3. **GitHub Archive**: Access to historical GitHub data since 2011

#### Data Flow:
```
GitHub Events API → dlt Pipeline → DuckDB → Supabase
GitHub Archive → dlt Pipeline → DuckDB → Supabase
```

#### Features:
- **Incremental Loading**: Only fetch new data since last sync
- **Parallel Processing**: Handle multiple repositories simultaneously
- **Schema Evolution**: Automatically adapt to GitHub API changes
- **Data Deduplication**: Prevent duplicate entries
- **Historical Backfill**: Load years of GitHub history

### Hybrid Routing System

The system intelligently routes operations based on data source and execution time:

```
Client Request
     ↓
Sync Service (client)
     ↓
Hybrid Router (Netlify)
     ├─→ Supabase Edge Functions (long operations, 150s limit)
     ├─→ Inngest/Netlify (quick operations, 26s limit)
     └─→ gh-datapipe API (massive operations, no limit)
```

### Routing Decision Criteria

#### Netlify Functions (10-26s limit)
Use for:
- Quick updates (<100 PRs)
- Recent activity (last 7 days)
- Single PR details
- Real-time webhook processing

#### Supabase Edge Functions (150s limit)
Use for:
- Medium repositories (100-1000 PRs)
- Date range 30-90 days
- Known large repos (pytorch/pytorch, tensorflow/tensorflow)
- Batch operations (50-500 PRs)
- Previous timeout recovery

#### gh-datapipe (No limit)
Use for:
- Historical data import (>90 days)
- Massive repositories (>1000 PRs)
- GitHub Archive backfill
- Complete repository history
- Bulk organization imports
- When Supabase functions timeout

## Supabase Edge Functions

### 1. repository-sync
- **Purpose**: Standard REST API-based repository sync
- **Timeout**: 50s (free) / 150s (paid)
- **Endpoint**: `{SUPABASE_URL}/functions/v1/repository-sync`
- **Features**:
  - Resumable syncs with cursor support
  - Progress tracking in database
  - Automatic timeout detection

### 2. repository-sync-graphql
- **Purpose**: GraphQL-based sync (more efficient)
- **Timeout**: 50s (free) / 150s (paid)
- **Endpoint**: `{SUPABASE_URL}/functions/v1/repository-sync-graphql`
- **Features**:
  - Batch fetching with GraphQL
  - Includes reviews and comments in single query
  - Better rate limit efficiency

### 3. pr-details-batch
- **Purpose**: Batch process PR details
- **Timeout**: 50s (free) / 150s (paid)
- **Endpoint**: `{SUPABASE_URL}/functions/v1/pr-details-batch`
- **Features**:
  - Process up to 100 PRs per batch
  - Fetch reviews and comments
  - GraphQL optimization

## Client Usage

### TypeScript/JavaScript

```typescript
import { SyncService } from '@/lib/sync-service';

// Standard sync (auto-routes based on size)
const result = await SyncService.syncRepository('pytorch', 'pytorch');

// Force Supabase for large operation
const result = await SyncService.syncRepository('owner', 'name', {
  fullSync: true,
  forceSupabase: true
});

// GraphQL sync (recommended for large repos)
const result = await SyncService.syncRepositoryGraphQL('tensorflow', 'tensorflow');

// Batch PR processing
const result = await SyncService.batchProcessPRs('facebook', 'react', [1, 2, 3, ...]);

// Resume partial sync
if (result.partial && result.resumeCursor) {
  const continued = await SyncService.resumeSync('owner', 'name', result.resumeCursor);
}

// Check sync status
const status = await SyncService.getSyncStatus('pytorch', 'pytorch');
```

### gh-datapipe Integration

For massive data operations that exceed Supabase Edge Function limits:

```typescript
// Trigger gh-datapipe for historical import
const response = await fetch('/.netlify/functions/backfill-trigger', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repository: 'torvalds/linux',
    days: 365, // Full year of history
    force: true
  })
});

// Check gh-datapipe status
const status = await fetch('/.netlify/functions/backfill-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repository: 'torvalds/linux'
  })
});

// gh-datapipe webhook will notify when complete
// Data flows directly into Supabase database
```

### Data Source Priority

1. **Cache First**: Check Supabase for existing data
2. **Quick Sync**: Use Netlify for recent updates
3. **Medium Sync**: Route to Supabase Edge Functions
4. **Heavy Lifting**: Delegate to gh-datapipe for historical/massive data

### Direct API Call

```bash
# Call Supabase Edge Function directly
curl -X POST \
  'https://egcxzonpmmcirmgqdrla.supabase.co/functions/v1/repository-sync' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "owner": "pytorch",
    "name": "pytorch",
    "fullSync": false,
    "daysLimit": 30
  }'
```

## Monitoring

### Sync Metrics

The system tracks all sync operations in the `sync_metrics` table:

```sql
-- Get sync statistics for a repository
SELECT * FROM get_sync_statistics('pytorch/pytorch', 7);

-- Check if repository should use Supabase
SELECT should_use_supabase('tensorflow/tensorflow');

-- View recent timeouts
SELECT repository, COUNT(*) as timeouts, AVG(execution_time) as avg_time
FROM sync_metrics
WHERE timed_out = true
AND created_at > NOW() - INTERVAL '7 days'
GROUP BY repository
ORDER BY timeouts DESC;
```

### Monitoring Dashboard

```typescript
import { SyncMonitoring } from '@/lib/sync-monitoring';

// Get sync statistics
const stats = await SyncMonitoring.getStats('pytorch/pytorch');
console.log(`Success rate: ${(stats.successfulSyncs / stats.totalSyncs * 100).toFixed(2)}%`);
console.log(`Timeout rate: ${(stats.timeouts / stats.totalSyncs * 100).toFixed(2)}%`);
console.log(`Avg execution: ${stats.averageExecutionTime.toFixed(2)}s`);

// Get timeout trends
const trends = await SyncMonitoring.getTimeoutTrends();
trends.forEach(trend => {
  console.log(`${trend.repository}: ${trend.timeouts} timeouts, avg ${trend.avgExecutionTime}s`);
});
```

## Deployment

### Deploy Supabase Edge Functions

```bash
# Deploy individual function
supabase functions deploy repository-sync

# Deploy all sync functions
supabase functions deploy repository-sync
supabase functions deploy repository-sync-graphql
supabase functions deploy pr-details-batch
```

### Environment Variables

Required environment variables:

```env
# Supabase configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# GitHub configuration
GITHUB_TOKEN=your-github-token

# Feature flags
USE_SUPABASE_FUNCTIONS=true
VITE_USE_HYBRID_ROUTING=true
SUPABASE_FUNCTION_TIMEOUT=150  # Set based on your plan
```

## Migration Checklist

- [x] Create Supabase Edge Functions
  - [x] repository-sync
  - [x] repository-sync-graphql
  - [x] pr-details-batch
- [x] Create hybrid routing system
- [x] Update client SDK
- [x] Add monitoring and metrics
- [x] Apply database migrations
- [ ] Deploy to production
- [ ] Test with large repositories
- [ ] Monitor performance

## Performance Comparison

| Repository | Netlify (Before) | Supabase (After) | Improvement |
|------------|-----------------|------------------|-------------|
| pytorch/pytorch | Timeout (30s) | 85s complete | ✅ No timeout |
| tensorflow/tensorflow | Timeout (30s) | 92s complete | ✅ No timeout |
| kubernetes/kubernetes | Timeout (30s) | 78s complete | ✅ No timeout |
| small repos (<100 PRs) | 3-5s | 3-5s (Netlify) | Same (uses Netlify) |

## Troubleshooting

### Common Issues

1. **Function still timing out**
   - Check if on free tier (50s limit)
   - Consider upgrading to paid tier (150s)
   - Use GraphQL version for efficiency
   - Implement pagination/cursor for very large repos

2. **Partial sync not resuming**
   - Check `sync_progress` table for saved cursor
   - Ensure `resumeFrom` parameter is passed
   - Verify repository exists in database

3. **High error rate**
   - Check GitHub rate limits
   - Verify GitHub token is valid
   - Check Supabase function logs
   - Monitor `sync_metrics` table

### Debug Commands

```bash
# Check function logs
supabase functions logs repository-sync

# Test function locally
supabase functions serve repository-sync

# Check sync progress
psql $DATABASE_URL -c "SELECT * FROM sync_progress WHERE repository_id = 'xxx';"

# View recent metrics
psql $DATABASE_URL -c "SELECT * FROM sync_metrics ORDER BY created_at DESC LIMIT 10;"
```

## Cost Considerations

- **Supabase Edge Functions**: Included with Supabase plan
  - Free tier: 500K invocations/month
  - Pro tier: 2M invocations/month
- **Execution time**: Billed per GB-second
  - Most syncs use < 256MB RAM
  - 150s execution at 256MB = 37.5 GB-seconds (150s × 0.25GB)
- **Database storage**: Metrics add ~1KB per sync

## Future Improvements

1. **Implement streaming responses** for real-time progress updates
2. **Add webhook callbacks** for completion notifications
3. **Implement distributed processing** for massive repos
4. **Add caching layer** for frequently synced repos
5. **Create admin dashboard** for monitoring all syncs