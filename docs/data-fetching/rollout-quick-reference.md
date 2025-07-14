# Hybrid Rollout Quick Reference

## Current Status
- **Rollout**: 25% (as of January 2025)
- **Strategy**: repository_size
- **Status**: ✅ Active

## Console Commands

### Check Status
```javascript
rollout.status()          // Current configuration
rollout.stats()           // Performance metrics
rollout.categories()      // Repository distribution
rollout.checkHealth()     // System health check
```

### Manage Rollout
```javascript
rollout.setRollout(25)    // Set to 25%
rollout.emergencyStop()   // Stop immediately
rollout.resume()          // Resume after stop
```

### Monitor Performance
```javascript
rollout.showMetrics()     // Recent performance
rollout.monitorPhase4()   // Detailed monitoring
```

## Test Commands

### Local Testing
```bash
# Start all services
npm start

# Test local Inngest
node scripts/test-inngest-events.js
```

### Production Testing
```bash
# Test production events
node scripts/test-production-inngest.js

# Check authentication
node scripts/debug-inngest-auth.js
```

## Routing Rules

| Data Type | Processor | Criteria |
|-----------|-----------|----------|
| Recent PRs | Inngest | < 24 hours old |
| Small batches | Inngest | ≤ 10 PRs |
| Manual triggers | Inngest | User-initiated |
| Historical data | GitHub Actions | > 24 hours old |
| Large batches | GitHub Actions | > 50 items |
| Bulk syncs | GitHub Actions | Scheduled jobs |

## Key Metrics

### Success Targets
- Error rate: < 5%
- Success rate: > 85%
- Processing time: < 30s (Inngest)

### Monitor At
- Inngest: https://app.inngest.com/env/production/runs
- GitHub Actions: `bdougie/jobs` repository
- Database: `rollout_metrics` table

## Rollout Progression

1. **10%** ✅ - Initial testing (completed)
2. **25%** ✅ - Current phase
3. **50%** - After 1 week stable
4. **75%** - After validation
5. **100%** - Full rollout

## Emergency Contacts

- **Inngest Issues**: Check https://app.inngest.com
- **GitHub Actions**: Check workflow runs
- **Database**: Query `rollout_configuration`

## Common Tasks

### Increase Rollout
```javascript
// Check metrics first
rollout.stats()

// If healthy, increase
rollout.setRollout(50)
```

### Debug Issues
```bash
# Inngest not working?
node scripts/diagnose-inngest.js

# Check rollout eligibility
node scripts/check-repository-eligibility.js [repo-id]
```

### Emergency Stop
```javascript
// Stop all hybrid routing
rollout.emergencyStop('Reason here')

// Check status
rollout.status()

// Resume when fixed
rollout.resume()
```