# Hybrid Data Fetching Rollout Configuration

## Overview

The hybrid data fetching system intelligently routes data processing between Inngest (real-time) and GitHub Actions (bulk processing) to optimize for both performance and cost. This document covers the rollout configuration, management, and troubleshooting.

## Current Status

- **Rollout Percentage**: 25% (as of January 2025)
- **Strategy**: repository_size
- **Inngest**: ✅ Working (local and production)
- **GitHub Actions**: ✅ Ready for bulk processing

## System Architecture

```
┌─────────────────────┐
│   User Request      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Rollout Manager    │ ◄── 25% of repositories
│  (Eligibility Check)│
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌───────────┐ ┌──────────────┐
│  Inngest  │ │GitHub Actions│
│           │ │              │
│ Recent    │ │ Historical   │
│ Real-time │ │ Bulk         │
│ < 24hrs   │ │ > 24hrs      │
└───────────┘ └──────────────┘
```

## Rollout Configuration

### Database Schema

The rollout is controlled by the `rollout_configuration` table:

```sql
rollout_configuration {
  id: uuid
  feature_name: 'hybrid_progressive_capture'
  rollout_percentage: 25  -- Current rollout
  rollout_strategy: 'repository_size'
  is_active: true
  emergency_stop: false
  auto_rollback_enabled: true
  max_error_rate: 5.0
}
```

### Environment Variables

```bash
# Optional overrides (database config takes precedence)
HYBRID_ROLLOUT_PERCENTAGE=25
HYBRID_EMERGENCY_STOP=false
HYBRID_ROLLOUT_STRATEGY=repository_size
HYBRID_AUTO_ROLLBACK=true
HYBRID_MAX_ERROR_RATE=5.0
```

## Managing the Rollout

### Using the Rollout Console

The rollout console is available globally in the browser:

```javascript
// Check current status
rollout.status()

// View statistics
rollout.stats()

// Update rollout percentage
rollout.setRollout(50)  // Increase to 50%

// Emergency stop
rollout.emergencyStop('High error rate detected')

// Resume after emergency stop
rollout.resume()

// Monitor Phase 4 metrics
rollout.monitorPhase4()
```

### Using Scripts

```bash
# Update rollout percentage
node scripts/update-rollout.js

# Check Inngest status
node scripts/debug-inngest-auth.js

# Test production events
node scripts/test-production-inngest.js
```

## Routing Logic

The hybrid system routes based on these rules:

### Inngest (Real-time Processing)
- Recent data (< 24 hours)
- Small PR batches (≤ 10 PRs)
- Manual triggers expecting immediate feedback
- Critical priority items

### GitHub Actions (Bulk Processing)
- Historical data (> 24 hours)
- Large batches (> 50 items)
- Scheduled/background jobs
- Large repositories (> 1,000 PRs)

## Inngest Configuration

### Local Development

```bash
# Start all services
npm start

# This runs:
# - Vite on port 5174
# - Netlify dev (proxies to Vite)
# - Inngest dev connecting to inngest-local function
```

### Production Setup

1. **Environment Variables in Netlify**:
   ```
   INNGEST_PRODUCTION_EVENT_KEY = [from contributor-info app]
   INNGEST_PRODUCTION_SIGNING_KEY = [from contributor-info app]
   ```

2. **Registered Endpoint**:
   ```
   https://contributor.info/.netlify/functions/inngest-prod
   ```

3. **Functions Available**:
   - `prod-test-function` - Test connectivity
   - `capture-repository-sync-graphql` - Sync repository PRs
   - `classify-single-repository` - Classify repository size

## Troubleshooting

### Inngest Functions Not Triggering

1. **Check Local Setup**:
   ```bash
   # Run diagnostic
   node scripts/debug-inngest-local.js
   
   # Test events
   node scripts/test-inngest-events.js
   ```

2. **Verify Functions are Registered**:
   - Visit http://localhost:8288/functions (local)
   - Check Inngest dashboard for production

3. **Common Issues**:
   - Events created but functions don't run: Check event names match function triggers
   - Authentication failed: Verify signing keys match
   - Import errors: Check console for module errors

### Production Authentication Issues

1. **Check endpoint status**:
   ```bash
   curl https://contributor.info/.netlify/functions/inngest-prod
   ```

2. **Verify keys match**:
   - Inngest dashboard: https://app.inngest.com/env/production/manage/keys
   - Netlify env vars: https://app.netlify.com/sites/contributor-info/configuration/env

3. **Test production events**:
   ```bash
   node scripts/test-production-inngest.js
   ```

## Monitoring

### Rollout Metrics

Monitor success rates and performance:

```sql
-- Check recent metrics
SELECT 
  processor_type,
  SUM(success_count) as successes,
  SUM(error_count) as errors,
  AVG(average_processing_time) as avg_time,
  COUNT(DISTINCT repository_id) as repos_processed
FROM rollout_metrics
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY processor_type;
```

### Dashboard Access

- **Inngest**: https://app.inngest.com/env/production/runs
- **GitHub Actions**: Check `bdougie/jobs` repository
- **Capture Monitor**: https://contributor.info/dev/capture-monitor

### Auto-Rollback

The system automatically rolls back to 0% if:
- Error rate exceeds 5% (configurable)
- More than 10 jobs have been processed
- Monitoring window: Based on `monitoring_window_hours` setting

## Scaling the Rollout

### Recommended Progression

1. **Phase 1**: 10% - Initial testing (completed)
2. **Phase 2**: 25% - Current phase
3. **Phase 3**: 50% - After 1 week of stable operation
4. **Phase 4**: 75% - After performance validation
5. **Phase 5**: 100% - Full rollout

### Before Increasing

Check these metrics:
- Error rate < 5%
- Success rate > 85%
- No memory/timeout issues
- Cost savings validated

### To Increase Rollout

```javascript
// In browser console
rollout.setRollout(50)  // Increase to 50%

// Or via script
node scripts/update-rollout.js
```

## Cost Analysis

### Inngest Costs
- Real-time processing: ~$20-80/month for recent data
- Best for: Immediate updates, small batches

### GitHub Actions Costs
- Bulk processing: $0-12/month (usually within free tier)
- Best for: Historical data, large repositories

### Hybrid Savings
- Estimated 85-100% cost reduction for historical processing
- Maintains real-time performance for recent data

## Emergency Procedures

### Emergency Stop

```javascript
// Browser console
rollout.emergencyStop('Critical issue detected')

// This will:
// 1. Set emergency_stop = true
// 2. Route all traffic to Inngest only
// 3. Log the incident
```

### Resume Operations

```javascript
// After fixing the issue
rollout.resume()
```

### Manual Override

```bash
# Set environment variable
export HYBRID_EMERGENCY_STOP=true

# Or update database directly
UPDATE rollout_configuration 
SET emergency_stop = true 
WHERE feature_name = 'hybrid_progressive_capture';
```

## Related Documentation

- [Implementation Status](./implementation-status.md)
- [GitHub Actions Implementation](./github-actions-implementation.md)
- [Inngest Setup](./inngest-setup.md)
- [Queue Management](./queue-management.md)
- [Monitoring Guide](./monitoring-capture-health.md)