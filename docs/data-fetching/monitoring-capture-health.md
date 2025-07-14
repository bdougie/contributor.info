# Monitoring Capture Health Guide

## Overview

This guide explains how to monitor the health of the data capture system, interpret metrics, and troubleshoot common issues.

## Accessing the Monitor

### Dashboard Location

Navigate to `/dev/capture-monitor` while logged in to access the Capture Health Monitor.

### Dashboard Components

#### 1. Queue Statistics

Three cards showing real-time statistics:

- **Inngest Queue**: Real-time processing for small/recent data
- **GitHub Actions Queue**: Bulk processing for large/historical data  
- **Total Overview**: Combined statistics across both processors

Each card displays:
- Pending jobs waiting to start
- Processing jobs currently running
- Completed jobs (last 24 hours)
- Failed jobs requiring attention

#### 2. Recent Jobs List

A real-time list of the last 20 capture jobs showing:
- Job type and repository
- Current status with visual indicators
- Progress bar for active jobs
- Processing duration
- Processor assignment

### Understanding Status Indicators

| Icon | Status | Meaning |
|------|--------|---------|
| 🟢 | Completed | Job finished successfully |
| 🔴 | Failed | Job encountered an error |
| 🔵 | Processing | Job is currently running |
| ⏰ | Pending | Job is queued and waiting |

## Key Metrics to Monitor

### Health Indicators

#### 1. Queue Depth
- **Healthy**: <50 pending jobs per processor
- **Warning**: 50-200 pending jobs
- **Critical**: >200 pending jobs

#### 2. Failure Rate
- **Healthy**: <10% failure rate
- **Warning**: 10-30% failure rate
- **Critical**: >30% failure rate

#### 3. Processing Time
- **Small repos**: <1 minute
- **Medium repos**: 1-5 minutes
- **Large repos**: 5-15 minutes
- **XL repos**: 15-30 minutes

### Performance Metrics

Monitor these metrics for system performance:

1. **Average Queue Time**: Time from job creation to processing start
2. **Average Processing Time**: Time from start to completion
3. **Throughput**: Jobs completed per hour
4. **Retry Success Rate**: Percentage of failed jobs that succeed on retry

## Common Scenarios

### Scenario 1: High Queue Depth

**Symptoms**: 
- Many pending jobs
- Slow processing times
- User complaints about delays

**Actions**:
1. Check processor health status
2. Review recent failure patterns
3. Consider manual queue rebalancing
4. Scale up processing capacity if needed

### Scenario 2: High Failure Rate

**Symptoms**:
- Many failed jobs in dashboard
- Retry queue growing
- Specific error patterns

**Actions**:
1. Check GitHub API rate limits
2. Verify authentication tokens
3. Review error messages for patterns
4. Check for service outages

### Scenario 3: Stuck Jobs

**Symptoms**:
- Jobs in "processing" for extended periods
- No progress updates
- Processor appears healthy

**Actions**:
1. Check processor logs
2. Verify database connectivity
3. Manual job status update if needed
4. Restart stuck processors

## Troubleshooting Steps

### 1. Check System Health

```bash
# Check Netlify Functions logs
netlify logs:function queue-health-check

# Check GitHub Actions runs
gh run list --limit 10

# Check database connectivity
npm run db:health-check
```

### 2. Investigate Failed Jobs

Look for patterns in failed jobs:
- Same repository failing repeatedly?
- Specific job types failing?
- Time-based failure patterns?

### 3. Review Error Messages

Common error patterns and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Rate limit exceeded" | GitHub API limit hit | Wait or use different token |
| "Repository not found" | Repo deleted/private | Mark as permanent failure |
| "Timeout" | Large dataset | Increase timeout or chunk data |
| "Authentication failed" | Invalid token | Update GitHub token |

### 4. Manual Interventions

When automatic systems fail:

1. **Force Retry**: Manually trigger retry for failed jobs
2. **Priority Override**: Boost priority for critical repositories
3. **Processor Switch**: Move jobs between processors
4. **Queue Flush**: Clear stuck or invalid jobs

## Performance Optimization

### Queue Optimization

1. **Adjust Priority Weights**
   - Increase weight for user-triggered jobs
   - Decrease weight for scheduled jobs during peak

2. **Rebalance Thresholds**
   - Lower threshold for faster rebalancing
   - Higher threshold for stability

3. **Batch Size Tuning**
   - Smaller batches for better responsiveness
   - Larger batches for efficiency

### Resource Allocation

1. **Processor Scaling**
   - Add concurrent workers for Inngest
   - Increase GitHub Actions runners

2. **Database Optimization**
   - Index frequently queried fields
   - Archive old job records
   - Vacuum tables regularly

## Alerting and Notifications

### Setting Up Alerts

Configure alerts for critical conditions:

1. **Queue Depth Alert**
   ```javascript
   if (stats.total.pending > 200) {
     sendAlert('High queue depth detected');
   }
   ```

2. **Failure Rate Alert**
   ```javascript
   if (failureRate > 0.3) {
     sendAlert('High failure rate detected');
   }
   ```

3. **Processor Health Alert**
   ```javascript
   if (processorOffline) {
     sendAlert('Processor offline');
   }
   ```

### Alert Channels

- Slack notifications for team awareness
- Email alerts for critical issues
- Dashboard warnings for operators
- Automated ticket creation for persistent issues

## Best Practices

### Daily Monitoring

1. Check dashboard each morning
2. Review overnight job failures
3. Clear any stuck jobs
4. Verify processor health

### Weekly Review

1. Analyze performance trends
2. Review retry statistics
3. Optimize slow-performing repos
4. Update priority configurations

### Monthly Maintenance

1. Archive old job records
2. Review and update alerts
3. Analyze cost metrics
4. Plan capacity adjustments

## Advanced Features

### Custom Queries

Access detailed metrics via Supabase:

```sql
-- Jobs by status last 24 hours
SELECT 
  processor_type,
  status,
  COUNT(*) as count
FROM progressive_capture_jobs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY processor_type, status;

-- Average processing time by repo size
SELECT 
  t.size,
  AVG(EXTRACT(EPOCH FROM (j.completed_at - j.started_at))) as avg_seconds
FROM progressive_capture_jobs j
JOIN tracked_repositories t ON j.repository_id = t.id
WHERE j.completed_at IS NOT NULL
GROUP BY t.size;
```

### Command-Line Monitoring Tools

The system includes several command-line tools for monitoring and maintenance:

#### 1. Monitor Stuck Jobs
```bash
node scripts/progressive-capture/monitor-stuck-jobs.js
```
- Shows all jobs stuck in "processing" state for >1 hour
- Displays job statistics for the last 24 hours
- Calculates error rates and success metrics

#### 2. Fix Stuck Jobs
```bash
node scripts/progressive-capture/fix-stuck-jobs.js
```
- Interactive tool to fix stuck jobs
- Options to mark stuck jobs as failed
- Creates monitoring records for tracking
- Cleans up orphaned progress records

#### 3. Test Job Completion
```bash
node scripts/progressive-capture/test-job-completion.js
```
- Tests the job completion pipeline
- Verifies progress tracking works correctly
- Useful for debugging job lifecycle issues

### Export Capabilities

Export monitoring data for analysis:
- CSV export of job history
- JSON export of current stats
- Metrics API for external monitoring