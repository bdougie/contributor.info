# Phase 6: Hybrid Progressive Capture Rollout

## 🎯 Overview

Phase 6 implements the gradual rollout of the hybrid progressive capture system to 10% of repositories with comprehensive safety controls, monitoring, and emergency procedures.

## 📋 Prerequisites

1. **Database Migration Applied**: The rollout configuration migration must be applied
2. **Supabase Credentials**: Updated credentials in environment variables
3. **Repository Categorization**: Repositories must be categorized for smart rollout

## 🚀 Quick Start

### 1. Apply Database Migration

```bash
# In the contributor.info directory
supabase db push
```

### 2. Run Phase 6 Implementation

```bash
# Apply rollout configuration and start 10% rollout
node scripts/rollout/phase6-implementation.js
```

### 3. Monitor Rollout Health

```bash
# Start continuous monitoring (every 15 minutes)
node scripts/rollout/monitor-phase6.js
```

### 4. Interactive Dashboard

```bash
# Launch interactive management dashboard
node scripts/rollout/rollout-dashboard.js
```

## 🎛️ Console Commands

The rollout system provides global console commands available in the browser:

```javascript
// Status and monitoring
rollout.status()                    // Show current rollout status
rollout.stats()                     // Show detailed statistics
rollout.categories()                // Show repository categories
rollout.checkHealth()               // Manual health check + auto-rollback

// Rollout control
rollout.setRollout(percentage)      // Update rollout percentage (0-100)
rollout.emergencyStop(reason?)      // Emergency stop rollout
rollout.resume()                    // Resume rollout after emergency stop

// Repository management
rollout.categorizeAll()             // Categorize all repositories
rollout.addToWhitelist([ids])       // Add repositories to whitelist
rollout.removeFromWhitelist([ids])  // Remove from whitelist
rollout.showWhitelist()             // Show current whitelist

// Safety controls
rollout.enableAutoRollback()        // Enable automatic rollback
rollout.disableAutoRollback()       // Disable automatic rollback
rollout.rollbackToPercentage(pct)   // Manual rollback to percentage
rollout.rollbackToZero()            // Emergency rollback to 0%
```

## 📊 Monitoring & Safety

### Auto-Rollback System

- **Trigger**: Error rate > 5% with minimum 10 jobs
- **Action**: Automatic rollback to 0%
- **Frequency**: Health checks every 15 minutes
- **Override**: Can be disabled via console

### Emergency Procedures

1. **Emergency Stop**: `rollout.emergencyStop("reason")`
2. **Manual Rollback**: `rollout.rollbackToZero()`
3. **Resume**: `rollout.resume()`

### Health Indicators

- ✅ **Error Rate**: < 5% (configurable threshold)
- ✅ **Success Rate**: > 95% (recommended)
- ✅ **Sample Size**: > 10 jobs (minimum for reliable metrics)

## 🗂️ Repository Categories

The system automatically categorizes repositories for smart rollout:

| Category | Criteria | Priority | Rollout Order |
|----------|----------|----------|---------------|
| **Test** | 0 stars, ≤2 contributors, ≤10 PRs | 100 | First |
| **Small** | ≤50 stars, ≤10 contributors, ≤100 PRs | 80 | Second |
| **Medium** | ≤500 stars, ≤50 contributors, ≤1K PRs | 60 | Third |
| **Large** | ≤5K stars, ≤200 contributors, ≤10K PRs | 40 | Fourth |
| **Enterprise** | >5K stars, >200 contributors, >10K PRs | 20 | Last |

## 🔄 Rollout Progression

### Phase 6: 10% Rollout (Current)
- **Target**: Test + Small repositories
- **Duration**: 24-48 hours monitoring
- **Success Criteria**: Error rate < 3%, Success rate > 95%

### Future Phases
- **Phase 7**: 25% (Test + Small + some Medium)
- **Phase 8**: 50% (Test + Small + Medium)
- **Phase 9**: 75% (Test + Small + Medium + Large)
- **Phase 10**: 100% (All repositories including Enterprise)

## 🛠️ Scripts Reference

### `phase6-implementation.js`
- **Purpose**: Complete Phase 6 setup and configuration
- **Features**: Database verification, repository categorization, rollout activation
- **Usage**: One-time setup script

### `monitor-phase6.js`
- **Purpose**: Continuous health monitoring with auto-rollback
- **Features**: Real-time error tracking, automatic rollback, health alerts
- **Usage**: Long-running monitoring process

### `rollout-dashboard.js`
- **Purpose**: Interactive CLI management interface
- **Features**: Status display, percentage management, emergency controls
- **Usage**: Interactive operations and troubleshooting

## 📈 Success Metrics

### Target Metrics
- **Cost Reduction**: 60-85% compared to Inngest-only
- **Error Rate**: < 5% across all processors
- **Success Rate**: > 95% for all job types
- **Processing Time**: < 2 minutes for recent data, 10-120 minutes for historical

### Monitoring Points
- **Real-time Processing**: Inngest performance for recent data
- **Bulk Processing**: GitHub Actions performance for historical data
- **Routing Effectiveness**: Proper job distribution between processors
- **User Experience**: Maintained immediate feedback for interactive operations

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check Supabase credentials in environment variables
   - Verify database migration has been applied

2. **High Error Rate**
   - Check processor health (Inngest dashboard, GitHub Actions logs)
   - Verify API rate limits are not exceeded
   - Review error messages in rollout_metrics table

3. **Auto-Rollback Triggered**
   - Investigate error patterns in logs
   - Check system resources and rate limits
   - Review rollout_history table for trigger details

### Recovery Procedures

1. **Emergency Stop Active**
   ```bash
   # Check status
   rollout.status()
   
   # Clear emergency stop when ready
   rollout.resume()
   
   # Start with lower percentage
   rollout.setRollout(5)
   ```

2. **High Error Rate**
   ```bash
   # Manual rollback
   rollout.rollbackToZero()
   
   # Investigate issues
   rollout.stats()
   
   # Resume when fixed
   rollout.setRollout(5)
   ```

## 🔍 Database Tables

### `rollout_configuration`
- Stores rollout settings and safety controls
- Single active configuration per feature

### `repository_categories`
- Automatic repository classification
- Priority-based rollout ordering

### `rollout_metrics`
- Job success/error tracking
- Performance monitoring data

### `rollout_history`
- Complete audit trail
- Rollout change tracking

## 🎯 Next Steps

1. **Monitor Phase 6**: Track 10% rollout for 24-48 hours
2. **Validate Metrics**: Ensure success criteria are met
3. **Expand Rollout**: Progress to 25% when stable
4. **Optimize Performance**: Fine-tune based on real-world data
5. **Full Deployment**: Complete rollout to 100% over 2-4 weeks

## 📚 Additional Resources

- **System Architecture**: `/docs/hybrid-progressive-capture-implementation.md`
- **Rollout Manager Guide**: `/docs/rollout/hybrid-rollout-manager.md`
- **Console Commands**: Available via `rollout.help()` in browser
- **Monitoring Dashboard**: Access via development server console

---

**Status**: Phase 6 Ready for Implementation  
**Last Updated**: July 2025  
**Next Phase**: Monitor 10% rollout → Expand to 25%