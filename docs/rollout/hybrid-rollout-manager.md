# HybridRolloutManager - Complete Technical Guide

## 🎯 Overview

The HybridRolloutManager is the core system that enables safe, gradual deployment of the hybrid progressive capture system. It provides percentage-based rollouts, repository categorization, automatic safety mechanisms, and comprehensive monitoring.

## 🏗️ Architecture

### System Components
```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          HybridRolloutManager                                  │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      Rollout Configuration                             │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ Percentage      │  │ Whitelist       │  │ Repository Size │        │   │
│  │  │ Strategy        │  │ Strategy        │  │ Strategy        │        │   │
│  │  │ (0-100%)        │  │ (Manual Control)│  │ (Size-based)    │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    Repository Categorization                           │   │
│  │                                                                         │   │
│  │  test (priority: 100)     ←─ 0 stars, ≤2 contributors, ≤10 PRs        │   │
│  │  small (priority: 80)     ←─ ≤50 stars, ≤10 contributors, ≤100 PRs     │   │
│  │  medium (priority: 60)    ←─ ≤500 stars, ≤50 contributors, ≤1K PRs     │   │
│  │  large (priority: 40)     ←─ ≤5K stars, ≤200 contributors, ≤10K PRs    │   │
│  │  enterprise (priority: 20)←─ >5K stars, >200 contributors, >10K PRs    │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Safety Mechanisms                               │   │
│  │                                                                         │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │ Auto-Rollback   │  │ Emergency Stop  │  │ Error Monitoring│        │   │
│  │  │ • 5% error rate │  │ • Manual trigger│  │ • Real-time     │        │   │
│  │  │ • 24hr window   │  │ • Immediate halt│  │ • 15min checks  │        │   │
│  │  │ • Automatic     │  │ • Override all  │  │ • Threshold     │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      Metrics & Monitoring                              │   │
│  │                                                                         │   │
│  │  • Success/error rates by processor type                               │   │
│  │  • Processing times and throughput                                     │   │
│  │  • Repository-level performance tracking                               │   │
│  │  • Cost analysis and optimization recommendations                      │   │
│  │  • Rollout health score and trend analysis                             │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Database Layer                                    │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ rollout_        │  │ repository_     │  │ rollout_        │                │
│  │ configuration   │  │ categories      │  │ metrics         │                │
│  │                 │  │                 │  │                 │                │
│  │ • feature_name  │  │ • category      │  │ • success_count │                │
│  │ • percentage    │  │ • priority      │  │ • error_count   │                │
│  │ • strategy      │  │ • star_count    │  │ • avg_time      │                │
│  │ • max_error_rate│  │ • is_test       │  │ • processor_type│                │
│  │ • auto_rollback │  │ • activity_score│  │ • window_start  │                │
│  │ • emergency_stop│  │                 │  │ • window_end    │                │
│  │ • whitelist     │  │                 │  │                 │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                          rollout_history                               │   │
│  │                                                                         │   │
│  │  • action (created, updated, rollback, emergency_stop)                 │   │
│  │  • previous_percentage / new_percentage                                 │   │
│  │  • reason (manual, auto_rollback, schedule)                            │   │
│  │  • triggered_by (user, system, automation)                             │   │
│  │  • metadata (additional context and debugging info)                    │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🎛️ Rollout Strategies

### 1. Percentage-Based Rollout (Default)
**Use Case**: Gradual deployment to a percentage of all repositories

```typescript
// Configuration
{
  rollout_strategy: 'percentage',
  rollout_percentage: 10,  // 10% of repositories
  is_active: true
}

// Eligibility Logic
const isEligible = (hashtext(repository_id) % 100) < rollout_percentage;
```

**Benefits**:
- ✅ Fair distribution across all repository types
- ✅ Deterministic selection (same repos always selected)
- ✅ Easy to scale up gradually (10% → 25% → 50% → 100%)
- ✅ Predictable impact on system load

### 2. Whitelist Strategy
**Use Case**: Manual control for testing specific repositories

```typescript
// Configuration
{
  rollout_strategy: 'whitelist',
  target_repositories: ['repo-id-1', 'repo-id-2'],
  is_active: true
}

// Eligibility Logic
const isEligible = target_repositories.includes(repository_id);
```

**Benefits**:
- ✅ Precise control over which repositories are included
- ✅ Perfect for testing with known repositories
- ✅ Can be combined with percentage strategy
- ✅ Easy to add/remove specific repositories

### 3. Repository Size Strategy
**Use Case**: Progressive rollout starting with smallest repositories

```typescript
// Rollout progression by percentage:
// 10% = test repositories only
// 25% = test + small repositories  
// 50% = test + small + medium repositories
// 75% = test + small + medium + large repositories
// 100% = all repositories including enterprise
```

**Benefits**:
- ✅ Lowest risk (start with test repositories)
- ✅ Natural progression from simple to complex
- ✅ Allows validation at each tier before proceeding
- ✅ Easier to diagnose issues with smaller repositories

## 🛡️ Safety Mechanisms

### Auto-Rollback System
```typescript
// Triggers automatic rollback when:
const shouldRollback = (
  errorRate > maxErrorRate &&     // Default: 5%
  totalJobs > minimumSampleSize   // Default: 10 jobs
);

// Actions taken:
if (shouldRollback) {
  await updateRolloutPercentage(0, 'auto_rollback', reason);
  await logRollbackEvent();
  await notifyOperations();
}
```

**Configuration**:
- **Error Rate Threshold**: 5% (configurable)
- **Monitoring Window**: 24 hours (configurable) 
- **Minimum Sample Size**: 10 jobs (prevents false positives)
- **Check Frequency**: Every 15 minutes

### Emergency Stop
```typescript
// Manual emergency stop
await rollout.emergencyStop('High error rate detected');

// System-wide halt
{
  emergency_stop: true,
  rollout_percentage: 0,  // Effectively 0% rollout
  triggered_by: 'manual',
  reason: 'High error rate detected'
}
```

**Features**:
- ✅ Immediate halt of all rollout traffic
- ✅ Manual trigger via console or API
- ✅ Audit trail with reason and timestamp
- ✅ Easy to resume when issues are resolved

### Health Monitoring
```typescript
// Continuous health checks
const healthMetrics = {
  errorRate: calculateErrorRate(last24Hours),
  successRate: calculateSuccessRate(last24Hours),
  avgProcessingTime: calculateAvgTime(last24Hours),
  repositoriesAffected: countAffectedRepos(),
  processorDistribution: getProcessorStats()
};
```

**Monitoring Frequency**:
- 🔄 **Health Checks**: Every 15 minutes
- 📊 **Metrics Collection**: Every hour
- 📈 **Dashboard Updates**: Real-time
- 📋 **Daily Reports**: Automated generation

## 🎯 Repository Categorization

### Automatic Classification
```sql
-- Repository categorization function
CREATE OR REPLACE FUNCTION categorize_repository(repo_id UUID)
RETURNS TEXT AS $$
BEGIN
  IF star_count = 0 AND contributor_count <= 2 AND pr_count <= 10 THEN
    category := 'test';      -- Priority: 100 (highest)
    priority := 100;
  ELSIF star_count <= 50 AND contributor_count <= 10 AND pr_count <= 100 THEN
    category := 'small';     -- Priority: 80
    priority := 80;
  ELSIF star_count <= 500 AND contributor_count <= 50 AND pr_count <= 1000 THEN
    category := 'medium';    -- Priority: 60
    priority := 60;
  ELSIF star_count <= 5000 AND contributor_count <= 200 AND pr_count <= 10000 THEN
    category := 'large';     -- Priority: 40
    priority := 40;
  ELSE
    category := 'enterprise'; -- Priority: 20 (lowest)
    priority := 20;
  END IF;
  
  RETURN category;
END;
$$;
```

### Category Characteristics

#### 🧪 Test Repositories (Priority: 100)
- **Criteria**: 0 stars, ≤2 contributors, ≤10 PRs
- **Rollout Order**: First (highest priority)
- **Risk Level**: Minimal
- **Use Case**: Safe testing ground for new features

#### 📦 Small Repositories (Priority: 80)
- **Criteria**: ≤50 stars, ≤10 contributors, ≤100 PRs
- **Rollout Order**: Second
- **Risk Level**: Low
- **Use Case**: Real-world validation with limited impact

#### 🏢 Medium Repositories (Priority: 60)
- **Criteria**: ≤500 stars, ≤50 contributors, ≤1K PRs
- **Rollout Order**: Third
- **Risk Level**: Medium
- **Use Case**: Broader validation with moderate usage

#### 🏭 Large Repositories (Priority: 40)
- **Criteria**: ≤5K stars, ≤200 contributors, ≤10K PRs
- **Rollout Order**: Fourth
- **Risk Level**: High
- **Use Case**: High-volume validation

#### 🌐 Enterprise Repositories (Priority: 20)
- **Criteria**: >5K stars, >200 contributors, >10K PRs
- **Rollout Order**: Last (lowest priority)
- **Risk Level**: Critical
- **Use Case**: Full production deployment

## 📊 Database Schema

### Rollout Configuration Table
```sql
CREATE TABLE rollout_configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name VARCHAR(100) NOT NULL,                    -- 'hybrid_progressive_capture'
  rollout_percentage INTEGER DEFAULT 0,                  -- 0-100
  is_active BOOLEAN DEFAULT false,                       -- Enable/disable rollout
  target_repositories TEXT[] DEFAULT '{}',               -- Whitelist array
  excluded_repositories TEXT[] DEFAULT '{}',             -- Blacklist array
  rollout_strategy VARCHAR(50) DEFAULT 'percentage',     -- Strategy type
  max_error_rate DECIMAL(5,2) DEFAULT 5.0,              -- Auto-rollback threshold
  monitoring_window_hours INTEGER DEFAULT 24,            -- Metrics window
  auto_rollback_enabled BOOLEAN DEFAULT true,           -- Enable auto-rollback
  emergency_stop BOOLEAN DEFAULT false,                 -- Emergency halt
  metadata JSONB DEFAULT '{}',                          -- Additional config
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Repository Categories Table
```sql
CREATE TABLE repository_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL,                        -- Category name
  priority_level INTEGER DEFAULT 0,                     -- Rollout priority
  is_test_repository BOOLEAN DEFAULT false,             -- Test flag
  star_count INTEGER DEFAULT 0,                         -- Repository metrics
  contributor_count INTEGER DEFAULT 0,
  pr_count INTEGER DEFAULT 0,
  monthly_activity_score INTEGER DEFAULT 0,
  last_categorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repository_id)
);
```

### Rollout Metrics Table
```sql
CREATE TABLE rollout_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  processor_type VARCHAR(20) NOT NULL,                  -- 'inngest' | 'github_actions'
  success_count INTEGER DEFAULT 0,                      -- Successful jobs
  error_count INTEGER DEFAULT 0,                        -- Failed jobs
  total_jobs INTEGER DEFAULT 0,                         -- Total processed
  average_processing_time DECIMAL(10,2),                -- Average duration (seconds)
  last_error_message TEXT,                              -- Latest error
  last_error_at TIMESTAMP WITH TIME ZONE,               -- Error timestamp
  metrics_window_start TIMESTAMP WITH TIME ZONE,        -- Window start
  metrics_window_end TIMESTAMP WITH TIME ZONE,          -- Window end
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Rollout History Table (Audit Trail)
```sql
CREATE TABLE rollout_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,                          -- Action type
  previous_percentage INTEGER,                          -- Before value
  new_percentage INTEGER,                               -- After value
  reason TEXT,                                          -- Change reason
  triggered_by VARCHAR(100),                            -- Who/what triggered
  metadata JSONB DEFAULT '{}',                          -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 API Reference

### Core Methods

#### `isRepositoryEligible(repositoryId: string): Promise<boolean>`
Determines if a repository is eligible for hybrid rollout.

```typescript
// Usage
const eligible = await hybridRolloutManager.isRepositoryEligible('repo-123');
if (eligible) {
  // Use hybrid routing
  await hybridQueueManager.queueJob('pr-details', jobData);
} else {
  // Fallback to Inngest only
  await inngestManager.queueJob('pr-details', jobData);
}
```

#### `updateRolloutPercentage(percentage: number, triggeredBy?: string, reason?: string): Promise<boolean>`
Updates the rollout percentage with audit logging.

```typescript
// Manual rollout update
await hybridRolloutManager.updateRolloutPercentage(
  25, 
  'manual', 
  'Expanding to 25% after successful 10% rollout'
);

// Automatic rollback
await hybridRolloutManager.updateRolloutPercentage(
  0,
  'auto_rollback',
  'Error rate 8.5% exceeded threshold 5.0%'
);
```

#### `emergencyStop(reason: string, triggeredBy?: string): Promise<boolean>`
Immediately halts the rollout with emergency stop flag.

```typescript
// Emergency stop
await hybridRolloutManager.emergencyStop(
  'Critical error detected in GitHub Actions processor',
  'operations_team'
);
```

#### `getRolloutStats(): Promise<RolloutStats | null>`
Retrieves comprehensive rollout statistics.

```typescript
const stats = await hybridRolloutManager.getRolloutStats();
/*
{
  total_repositories: 1250,
  eligible_repositories: 125,     // 10% of total
  rollout_percentage: 10,
  error_rate: 2.3,               // Below 5% threshold
  success_rate: 97.7,
  active_jobs: 45,
  categories: {
    test: 15,
    small: 85,
    medium: 25,
    large: 0,
    enterprise: 0
  },
  processor_distribution: {
    inngest: 28,
    github_actions: 17
  }
}
*/
```

### Repository Management

#### `categorizeRepository(repositoryId: string): Promise<RepositoryCategory | null>`
Categorizes a single repository based on its metrics.

```typescript
const category = await hybridRolloutManager.categorizeRepository('repo-123');
/*
{
  id: 'cat-456',
  repository_id: 'repo-123',
  category: 'small',
  priority_level: 80,
  is_test_repository: false,
  star_count: 25,
  contributor_count: 8,
  pr_count: 67,
  monthly_activity_score: 45
}
*/
```

#### `addToWhitelist(repositoryIds: string[], reason?: string): Promise<boolean>`
Adds repositories to the whitelist for targeted rollout.

```typescript
await hybridRolloutManager.addToWhitelist(
  ['repo-123', 'repo-456'],
  'Adding test repositories for initial validation'
);
```

### Safety Controls

#### `checkAndTriggerAutoRollback(): Promise<boolean>`
Checks rollout health and triggers rollback if needed.

```typescript
// Called automatically every 15 minutes by health monitor
const rollbackTriggered = await hybridRolloutManager.checkAndTriggerAutoRollback();
if (rollbackTriggered) {
  console.log('Auto-rollback triggered due to high error rate');
  // Send alerts, notifications, etc.
}
```

#### `recordMetrics(repositoryId, processorType, success, processingTime?, errorMessage?): Promise<void>`
Records job metrics for rollout monitoring.

```typescript
// Record successful job
await hybridRolloutManager.recordMetrics(
  'repo-123',
  'inngest',
  true,
  45000  // 45 seconds
);

// Record failed job
await hybridRolloutManager.recordMetrics(
  'repo-456', 
  'github_actions',
  false,
  120000,  // 2 minutes before failure
  'Rate limit exceeded'
);
```

## 🎮 Console Interface

### Rollout Console Commands
All commands available globally as `rollout.*`:

```javascript
// Status and monitoring
rollout.status()                    // Show current rollout configuration
rollout.stats()                     // Display rollout statistics
rollout.categories()                // Show repository category breakdown
rollout.checkHealth()               // Manual health check + auto-rollback

// Rollout control
rollout.setRollout(percentage)      // Update rollout percentage
rollout.emergencyStop(reason?)      // Emergency halt
rollout.resume()                    // Resume after emergency stop

// Repository management  
rollout.categorizeAll()             // Categorize all repositories
rollout.markAsTest(repositoryId)    // Mark repository as test
rollout.unmarkAsTest(repositoryId)  // Remove test flag

// Whitelist management
rollout.addToWhitelist([ids])       // Add repositories to whitelist
rollout.removeFromWhitelist([ids])  // Remove from whitelist
rollout.showWhitelist()             // Display current whitelist

// Safety controls
rollout.enableAutoRollback()        // Enable automatic rollback
rollout.disableAutoRollback()       // Disable automatic rollback
rollout.rollbackToPercentage(pct)   // Manual rollback to percentage
rollout.rollbackToZero()            // Emergency rollback to 0%
```

### Example Usage Sessions

#### Initial Rollout Setup
```javascript
// 1. Categorize all repositories
await rollout.categorizeAll();

// 2. Check categories
await rollout.categories();
/*
📂 Repository Categories
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📁 TEST
   Count: 15
   Total Stars: 0
   Total Contributors: 25
   Total PRs: 89
   Avg Activity Score: 5.2

📁 SMALL  
   Count: 842
   Total Stars: 12,450
   Total Contributors: 3,240
   Total PRs: 45,678
   Avg Activity Score: 28.5
...
*/

// 3. Start with 10% rollout
await rollout.setRollout(10);
/*
✅ Rollout percentage updated to 10%
*/

// 4. Monitor status
await rollout.status();
/*
🚀 Hybrid Progressive Capture Rollout Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Feature: hybrid_progressive_capture
📈 Rollout Percentage: 10%
🎯 Strategy: percentage
🔄 Auto Rollback: Enabled
⚠️  Max Error Rate: 5%
🚨 Emergency Stop: Inactive
🕐 Monitoring Window: 24 hours
📝 Whitelist: 0 repositories
🚫 Blacklist: 0 repositories
🆕 Created: 2025-01-10 10:30:00
🔄 Updated: 2025-01-10 14:45:00
*/
```

#### Monitoring and Health Checks
```javascript
// Check rollout statistics
await rollout.stats();
/*
📊 Rollout Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 Total Repositories: 1250
✅ Eligible Repositories: 125
📈 Rollout Percentage: 10%
❌ Error Rate: 2.30%
✅ Success Rate: 97.70%
🔄 Active Jobs: 45

📂 Repository Categories:
   test: 15 repositories
   small: 85 repositories
   medium: 25 repositories
   large: 0 repositories
   enterprise: 0 repositories

⚡ Processor Distribution:
   inngest: 28 jobs
   github_actions: 17 jobs
*/

// Manual health check
await rollout.checkHealth();
/*
🏥 Rollout Health Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Rollout health is normal

📊 Rollout Statistics
... (stats display)
*/
```

#### Emergency Procedures
```javascript
// Emergency stop
await rollout.emergencyStop('High error rate detected in GitHub Actions');
/*
🚨 EMERGENCY STOP ACTIVATED
   Reason: High error rate detected in GitHub Actions
   All rollout traffic has been halted
*/

// Check status
await rollout.status();
/*
🚨 Emergency Stop: ACTIVE
*/

// Resume after fixing issues
await rollout.resume();
/*
✅ Rollout resumed
   Current rollout percentage: 10%
*/
```

## 📈 Operational Playbook

### Gradual Rollout Procedure

#### Phase 1: Test Repositories (0% → 10%)
```javascript
// 1. Ensure categorization is complete
await rollout.categorizeAll();

// 2. Manually add known test repositories to whitelist
await rollout.addToWhitelist(['test-repo-1', 'test-repo-2']);

// 3. Start with 10% rollout (will include test + some small repos)
await rollout.setRollout(10);

// 4. Monitor for 24-48 hours
// Check every few hours:
await rollout.checkHealth();
await rollout.stats();
```

#### Phase 2: Small Repositories (10% → 25%)
```javascript
// 1. Verify Phase 1 success
await rollout.stats();
// Ensure error rate < 3% and success rate > 95%

// 2. Expand rollout
await rollout.setRollout(25);

// 3. Monitor closely for first 8 hours
// Automated health checks will monitor, but check manually:
await rollout.checkHealth();
```

#### Phase 3: Medium Repositories (25% → 50%)
```javascript
// 1. Wait for 48-72 hours of stable operation at 25%
await rollout.stats();

// 2. Expand to include medium repositories
await rollout.setRollout(50);

// 3. Monitor performance impact
// Medium repos have higher volume, watch for:
// - Processing time increases
// - Rate limit impacts
// - Cost implications
```

#### Phase 4: Large Repositories (50% → 75%)
```javascript
// 1. Ensure 1 week of stable operation at 50%
await rollout.setRollout(75);

// 2. Monitor system resources
// Large repos may strain system capacity
// Watch for resource exhaustion
```

#### Phase 5: Full Rollout (75% → 100%)
```javascript
// 1. Final expansion after 2 weeks of stable operation
await rollout.setRollout(100);

// 2. Monitor enterprise repositories closely
// These are highest risk, highest impact
```

### Troubleshooting Guide

#### High Error Rate Alert
```javascript
// 1. Check current stats
await rollout.stats();

// 2. If error rate > 5%, investigate
await rollout.checkHealth(); // This may trigger auto-rollback

// 3. Manual rollback if needed
await rollout.rollbackToPercentage(10); // or 0 for complete halt

// 4. Check error patterns
// Review error logs in progressive_capture_jobs table
// Look for common failure patterns
```

#### Auto-Rollback Triggered
```javascript
// 1. Acknowledge the rollback
await rollout.status();
// Should show rollout_percentage: 0

// 2. Investigate root cause
// Check error logs, system health, rate limits

// 3. When ready to resume
await rollout.setRollout(5); // Start smaller than before
```

#### Emergency Stop Activation
```javascript
// 1. Immediate status check
await rollout.status();
// Should show emergency_stop: true

// 2. Investigate critical issue
// Review logs, check system health

// 3. Resume when safe
await rollout.resume();
await rollout.setRollout(5); // Conservative restart
```

### Monitoring Best Practices

#### Daily Operations
1. **Morning Check**: `rollout.stats()` to review overnight activity
2. **Midday Check**: `rollout.checkHealth()` for health verification  
3. **Evening Review**: Check dashboard for trends and patterns

#### Weekly Reviews
1. **Performance Analysis**: Review processing times and success rates
2. **Cost Analysis**: Compare actual vs projected costs
3. **Capacity Planning**: Monitor resource utilization trends

#### Monthly Optimization
1. **Category Review**: Update repository categorization
2. **Threshold Tuning**: Adjust error rate thresholds based on data
3. **Strategy Refinement**: Optimize rollout strategies based on learnings

## 🔐 Security & Compliance

### Access Controls
- **Console Access**: Available only to authenticated users in production
- **Database Access**: Row-level security (RLS) policies enforce permissions
- **API Access**: Requires valid authentication tokens
- **Emergency Procedures**: Accessible via multiple channels for reliability

### Audit Trail
- **All Changes Logged**: Complete audit trail in `rollout_history` table
- **Metadata Capture**: Extensive context for all rollout decisions
- **Traceability**: Link rollout changes to performance impacts
- **Compliance**: Meets audit requirements for gradual deployment practices

The HybridRolloutManager provides enterprise-grade rollout capabilities with comprehensive safety mechanisms, detailed monitoring, and operational flexibility for managing the hybrid progressive capture system deployment.