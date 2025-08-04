# Health Check Scripts

Monitoring and validation scripts to ensure system health and catch issues before they impact users.

## 🏥 Overview

Health check scripts monitor:
- System component status
- Feature rollout health
- Repository tracking
- Infrastructure status

## 📋 Scripts

| Script | Purpose | Frequency |
|--------|---------|-----------|
| `check-rollout-health.js` | Monitor feature rollout status | Every deployment |
| `check-rollout-percentage.js` | Verify rollout configuration | Before changes |
| `check-repos.mjs` | Validate tracked repositories | Daily |
| `check-tracked-repos.mjs` | Repository tracking status | Weekly |
| `check-bucket-status.js` | Storage bucket health | Hourly |
| `check-inngest-registration.js` | Queue system health | After deployment |

## 💡 Usage Examples

### System Health Check
```bash
# Full system health check
node scripts/health-checks/check-rollout-health.js
node scripts/health-checks/check-bucket-status.js
node scripts/health-checks/check-inngest-registration.js

# Quick status
npm run health:check
```

### Repository Validation
```bash
# Check all tracked repositories
node scripts/health-checks/check-repos.mjs

# Verify specific organization
node scripts/health-checks/check-tracked-repos.mjs --org pytorch

# Find stale repositories
node scripts/health-checks/check-repos.mjs --stale-days 30
```

### Rollout Monitoring
```bash
# Current rollout status
node scripts/health-checks/check-rollout-percentage.js

# Rollout health with metrics
node scripts/health-checks/check-rollout-health.js --detailed
```

## 🚦 Health Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| ✅ GREEN | All systems operational | None |
| ⚠️ YELLOW | Minor issues detected | Monitor |
| 🔴 RED | Critical issues found | Immediate action |
| ⚫ UNKNOWN | Cannot determine status | Investigate |

## 📊 Health Metrics

### System Metrics
```javascript
{
  database: {
    connections: 45, // <80 = healthy
    queryTime: 45,  // <100ms = healthy
    errorRate: 0.1  // <1% = healthy
  },
  api: {
    responseTime: 230, // <500ms = healthy
    availability: 99.9, // >99% = healthy
    rateLimit: 4500    // >1000 = healthy
  },
  storage: {
    usage: 65,      // <90% = healthy
    availability: true,
    responseTime: 120  // <200ms = healthy
  }
}
```

### Repository Health
```javascript
{
  total: 150,
  active: 142,
  stale: 8,
  errors: 2,
  health: "YELLOW", // >95% active = GREEN
  recommendations: [
    "Refresh 8 stale repositories",
    "Fix 2 repositories with sync errors"
  ]
}
```

## 🔔 Alerting

### Alert Thresholds
```javascript
{
  critical: {
    errorRate: 5,        // >5% errors
    responseTime: 1000,  // >1s response
    availability: 95     // <95% uptime
  },
  warning: {
    errorRate: 2,        // >2% errors
    responseTime: 500,   // >500ms response
    staleRepos: 10       // >10% stale
  }
}
```

### Alert Actions
1. **Log**: Always log issues
2. **Notify**: Send alerts for warnings
3. **Page**: Critical issues page on-call
4. **Auto-fix**: Attempt self-healing

## 🏃 Automated Checks

### GitHub Actions
```yaml
- name: Health Checks
  run: |
    npm run health:system
    npm run health:repos
    npm run health:rollout
```

### Scheduled Checks
```javascript
// Every 5 minutes
*/5 * * * * node scripts/health-checks/check-bucket-status.js

// Every hour
0 * * * * node scripts/health-checks/check-rollout-health.js

// Daily at 2 AM
0 2 * * * node scripts/health-checks/check-repos.mjs
```

## 📈 Health Dashboards

### Status Page Output
```
System Health Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Database       ✅ Healthy (45ms avg)
API            ✅ Healthy (230ms avg)
Storage        ✅ Healthy (65% used)
Queue          ⚠️  Warning (high latency)
Repositories   ✅ Healthy (95% active)

Overall Status: ⚠️  YELLOW
Last Check: 2024-03-15 10:30:00
```

### Detailed Reports
```bash
# Generate health report
node scripts/health-checks/check-rollout-health.js --report > health-report.json

# View trends
node scripts/health-checks/check-rollout-health.js --trend 7d
```

## 🔧 Configuration

### Health Check Config
```javascript
// config/health-checks.js
export default {
  thresholds: {
    database: { maxConnections: 80, maxQueryTime: 100 },
    api: { maxResponseTime: 500, minAvailability: 99 },
    storage: { maxUsage: 90, maxResponseTime: 200 }
  },
  alerting: {
    enabled: true,
    channels: ["slack", "email"],
    cooldown: 300 // 5 minutes
  }
}
```

## 🚨 Common Issues

### Database Health
| Issue | Check | Fix |
|-------|-------|-----|
| High connections | `check-rollout-health.js` | Scale connection pool |
| Slow queries | `monitor-database-performance.js` | Add indexes |
| Lock conflicts | `check-rollout-health.js --locks` | Review transactions |

### Storage Health
| Issue | Check | Fix |
|-------|-------|-----|
| High usage | `check-bucket-status.js` | Clean old files |
| Slow uploads | `check-bucket-status.js --perf` | Check CDN |
| Access errors | `check-bucket-status.js --perms` | Fix policies |

## 🔄 Self-Healing

### Automated Fixes
Some checks can auto-remediate:
1. **Restart services**: On repeated failures
2. **Clear caches**: On performance issues
3. **Refresh tokens**: On auth failures
4. **Scale resources**: On high load

### Manual Intervention
Required for:
- Database migrations
- Security issues
- Data corruption
- Budget limits

## 📝 Health History

### Tracking
```bash
# View health history
node scripts/health-checks/check-rollout-health.js --history 30d

# Export metrics
node scripts/health-checks/check-rollout-health.js --export csv
```

### Trend Analysis
- Performance over time
- Error rate patterns
- Resource usage growth
- Availability metrics

## 🆘 Emergency Procedures

### Critical Failures
1. **Database Down**: Switch to read replica
2. **API Overload**: Enable rate limiting
3. **Storage Full**: Emergency cleanup
4. **Queue Stuck**: Flush and restart

### Recovery Steps
```bash
# Emergency health check
npm run health:emergency

# System recovery
npm run health:recover
```