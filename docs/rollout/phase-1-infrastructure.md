# Phase 1: Rollout Infrastructure Implementation

## Overview

Phase 1 establishes the core infrastructure for safely rolling out the hybrid progressive capture system. This phase implements the foundational components needed to control, monitor, and manage the gradual deployment of the hybrid queue system.

## ✅ Completed Components

### 1. Database Schema (`rollout_configuration` tables)

#### Core Tables

**`rollout_configuration`** - Main rollout control table
```sql
CREATE TABLE rollout_configuration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name VARCHAR(100) NOT NULL,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  is_active BOOLEAN DEFAULT false,
  target_repositories TEXT[] DEFAULT '{}',
  excluded_repositories TEXT[] DEFAULT '{}',
  rollout_strategy VARCHAR(50) DEFAULT 'percentage',
  max_error_rate DECIMAL(5,2) DEFAULT 5.0,
  monitoring_window_hours INTEGER DEFAULT 24,
  auto_rollback_enabled BOOLEAN DEFAULT true,
  emergency_stop BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`repository_categories`** - Automatic repository classification
```sql
CREATE TABLE repository_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  category VARCHAR(20) NOT NULL, -- 'test', 'small', 'medium', 'large', 'enterprise'
  priority_level INTEGER DEFAULT 0, -- 0-100, higher = higher priority for rollout
  is_test_repository BOOLEAN DEFAULT false,
  star_count INTEGER DEFAULT 0,
  contributor_count INTEGER DEFAULT 0,
  pr_count INTEGER DEFAULT 0,
  monthly_activity_score INTEGER DEFAULT 0,
  last_categorized_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(repository_id)
);
```

**`rollout_metrics`** - Performance monitoring
```sql
CREATE TABLE rollout_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE,
  processor_type VARCHAR(20) NOT NULL, -- 'inngest' or 'github_actions'
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  total_jobs INTEGER DEFAULT 0,
  average_processing_time DECIMAL(10,2),
  last_error_message TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  metrics_window_start TIMESTAMP WITH TIME ZONE,
  metrics_window_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**`rollout_history`** - Audit trail
```sql
CREATE TABLE rollout_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rollout_config_id UUID REFERENCES rollout_configuration(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'rollback', 'emergency_stop'
  previous_percentage INTEGER,
  new_percentage INTEGER,
  reason TEXT,
  triggered_by VARCHAR(100), -- 'manual', 'auto_rollback', 'schedule'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Database Functions

**`categorize_repository(repo_id UUID)`** - Automatic repository categorization
- Analyzes star count, contributor count, and PR volume
- Assigns appropriate category and priority level
- Updates existing categorization automatically

**`is_repository_eligible_for_rollout(repo_id UUID, feature_name TEXT)`** - Eligibility checking
- Checks rollout configuration and strategy
- Validates against whitelist/blacklist
- Applies percentage-based or category-based logic
- Returns boolean eligibility status

### 2. HybridRolloutManager Class

**File**: `src/lib/progressive-capture/rollout-manager.ts`

#### Core Functionality

```typescript
export class HybridRolloutManager {
  // Repository eligibility checking
  async isRepositoryEligible(repositoryId: string): Promise<boolean>
  
  // Repository categorization
  async categorizeRepository(repositoryId: string): Promise<RepositoryCategory | null>
  
  // Rollout configuration management
  async getRolloutConfiguration(): Promise<RolloutConfiguration | null>
  async updateRolloutPercentage(percentage: number, triggeredBy: string, reason?: string): Promise<boolean>
  
  // Emergency controls
  async emergencyStop(reason: string, triggeredBy: string): Promise<boolean>
  
  // Whitelist management
  async addToWhitelist(repositoryIds: string[], reason?: string): Promise<boolean>
  async removeFromWhitelist(repositoryIds: string[], reason?: string): Promise<boolean>
  
  // Metrics and monitoring
  async recordMetrics(repositoryId: string, processorType: 'inngest' | 'github_actions', success: boolean, processingTime?: number, errorMessage?: string): Promise<void>
  async getRolloutStats(): Promise<RolloutStats | null>
  async checkAndTriggerAutoRollback(): Promise<boolean>
}
```

#### Key Features

- **Environment Variable Override**: Emergency stop via `HYBRID_EMERGENCY_STOP=true`
- **Automatic Rollback**: Triggers when error rate exceeds threshold
- **Real-time Metrics**: Collects performance data for monitoring
- **Audit Trail**: Logs all configuration changes
- **Hash-based Selection**: Deterministic repository selection for percentage-based rollouts

### 3. Environment Variable Controls

**File**: `.env.example` (updated)

```bash
# Hybrid Progressive Capture Rollout Configuration
HYBRID_ROLLOUT_PERCENTAGE=0          # Override rollout percentage (0-100)
HYBRID_EMERGENCY_STOP=false          # Emergency stop override
HYBRID_ROLLOUT_STRATEGY=percentage   # Strategy: 'percentage', 'whitelist', 'repository_size'
HYBRID_AUTO_ROLLBACK=true           # Enable automatic rollback
HYBRID_MAX_ERROR_RATE=5.0           # Maximum error rate before rollback
```

#### Environment Variable Behavior

- **`HYBRID_EMERGENCY_STOP`**: Overrides database configuration for immediate stoppage
- **`HYBRID_ROLLOUT_PERCENTAGE`**: Development/testing override for rollout percentage
- **Database-First**: Environment variables supplement, don't replace database configuration
- **Production Safety**: Environment overrides are logged and audited

### 4. Percentage-Based Routing Logic

#### Routing Algorithm

```typescript
private determineProcessor(jobType: string, data: JobData): 'inngest' | 'github_actions' {
  // Rule 1: Recent data (< 24 hours) goes to Inngest
  if (data.timeRange && data.timeRange <= 1) {
    return 'inngest';
  }
  
  // Rule 2: Small specific PR batches go to Inngest  
  if (data.prNumbers && data.prNumbers.length <= 10) {
    return 'inngest';
  }
  
  // Rule 3: Manual triggers expect immediate feedback
  if (data.triggerSource === 'manual' && (!data.maxItems || data.maxItems <= 50)) {
    return 'inngest';
  }
  
  // Rule 4: Large historical data goes to GitHub Actions
  if (data.timeRange && data.timeRange > 1) {
    return 'github_actions';
  }
  
  // Rule 5: Large batch sizes go to GitHub Actions
  if (data.maxItems && data.maxItems > 50) {
    return 'github_actions';
  }
  
  // Rule 6: Scheduled jobs typically process bulk data
  if (data.triggerSource === 'scheduled') {
    return 'github_actions';
  }
  
  // Default: Inngest for immediate response
  return 'inngest';
}
```

#### Eligibility Integration

Before applying routing logic:
1. Check repository eligibility via `hybridRolloutManager.isRepositoryEligible()`
2. If not eligible → fallback to Inngest-only
3. If eligible → apply hybrid routing logic
4. Record metrics for monitoring

## Implementation Details

### 1. Initial Configuration

The system starts with:
- **0% rollout** (safe default)
- **Active configuration** ready for gradual increase
- **Auto-rollback enabled** with 5% error rate threshold
- **24-hour monitoring window** for health checks

### 2. Safety Mechanisms

#### Automatic Rollback
- Monitors error rate every health check
- Triggers when error rate > `max_error_rate` (default 5%)
- Requires minimum job volume (10+) to avoid false positives
- Updates rollout percentage to 0%
- Logs action in `rollout_history`

#### Emergency Stop
- Can be triggered via environment variable or database
- Immediately halts all hybrid routing
- Falls back to Inngest-only processing
- Requires manual intervention to resume

#### Graceful Degradation
- Fallback to Inngest if hybrid routing fails
- No user-visible impact during rollout issues
- Maintains system availability during rollback

### 3. Metrics Collection

#### Job-Level Metrics
```typescript
await hybridRolloutManager.recordMetrics(
  repositoryId,
  processorType,
  success,
  processingTime,
  errorMessage
);
```

#### Aggregated Statistics
- Success/failure rates by processor
- Average processing times
- Cost analysis and savings
- Repository participation rates
- Error categorization and trends

## Configuration Management

### Database Configuration (Primary)

```sql
-- View current rollout status
SELECT feature_name, rollout_percentage, rollout_strategy, 
       auto_rollback_enabled, emergency_stop 
FROM rollout_configuration 
WHERE feature_name = 'hybrid_progressive_capture' AND is_active = true;

-- Update rollout percentage
UPDATE rollout_configuration 
SET rollout_percentage = 10, updated_at = NOW() 
WHERE feature_name = 'hybrid_progressive_capture';

-- Emergency stop
UPDATE rollout_configuration 
SET emergency_stop = true, updated_at = NOW() 
WHERE feature_name = 'hybrid_progressive_capture';
```

### Environment Configuration (Override)

```bash
# Development testing
export HYBRID_ROLLOUT_PERCENTAGE=25
export HYBRID_EMERGENCY_STOP=false

# Emergency production stop
export HYBRID_EMERGENCY_STOP=true
```

## Monitoring and Health Checks

### Health Check Indicators

1. **Error Rate**: Primary health metric (< 5% threshold)
2. **Processing Time**: Monitor for performance degradation
3. **Queue Backlog**: Detect processor issues
4. **Repository Participation**: Validate rollout effectiveness

### Alert Thresholds

- **Critical**: Error rate > 10%, immediate rollback
- **Warning**: Error rate > 2.5%, monitor closely  
- **Info**: Rollout percentage changes, configuration updates

## Security and Permissions

### Database Security
- Row Level Security (RLS) enabled on all tables
- Public read access for monitoring
- Write access requires service role key
- Audit trail for all configuration changes

### Environment Security
- Environment variables for emergency override only
- Production deployment requires explicit configuration
- No sensitive data in environment variables
- Database configuration takes precedence

## Testing and Validation

### Unit Tests
- Repository eligibility logic
- Percentage-based selection algorithms
- Emergency stop functionality
- Metrics collection accuracy

### Integration Tests
- Database function correctness
- End-to-end rollout scenarios
- Fallback behavior validation
- Audit trail completeness

## Next Steps (Phase 2)

1. **Repository Targeting**: Enhanced categorization and targeting strategies
2. **Whitelist Controls**: Manual repository selection and override capabilities
3. **Manual Overrides**: Console tools for operational control
4. **Rollback Procedures**: Comprehensive rollback and recovery workflows

## Files Modified/Created

### ✅ Database Schema
- `supabase/migrations/20250710010000_add_rollout_configuration.sql`

### ✅ Core Infrastructure  
- `src/lib/progressive-capture/rollout-manager.ts`
- `src/lib/progressive-capture/hybrid-queue-manager.ts` (rollout integration)

### ✅ Environment Configuration
- `.env.example` (rollout variables added)

### ✅ Type Definitions
- Interfaces for `RolloutConfiguration`, `RepositoryCategory`, `RolloutMetrics`
- Type safety for all rollout operations

## Success Criteria ✅

- [x] **Database schema**: Complete with all required tables and functions
- [x] **Rollout manager**: Fully implemented with all core functionality  
- [x] **Environment controls**: Configured with safety overrides
- [x] **Percentage-based routing**: Integrated into hybrid queue manager
- [x] **Safety mechanisms**: Auto-rollback and emergency stop functional
- [x] **Metrics collection**: Real-time performance tracking implemented
- [x] **Audit trail**: Complete change history and action logging

## Production Readiness

Phase 1 infrastructure is **production-ready** with:
- ✅ 0% default rollout (no risk to existing systems)
- ✅ Comprehensive safety mechanisms  
- ✅ Real-time monitoring and alerting
- ✅ Immediate rollback capabilities (< 5 minutes)
- ✅ Complete audit trail and change history

The infrastructure provides a solid foundation for safe, gradual rollout of the hybrid progressive capture system.