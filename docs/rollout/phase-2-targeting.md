# Phase 2: Repository Targeting Implementation

## Overview

Phase 2 builds upon the rollout infrastructure to implement sophisticated repository targeting capabilities. This phase focuses on intelligent repository categorization, whitelist-based controls, manual override mechanisms, and comprehensive rollback procedures.

## ✅ Completed Components

### 1. Repository Categorization System

**File**: `src/lib/progressive-capture/repository-categorization.ts`

#### Automatic Classification Algorithm

The system automatically categorizes repositories based on activity metrics:

```typescript
// Categorization Logic (from database function)
IF star_count = 0 AND contributor_count <= 2 AND pr_count <= 10 THEN
  category := 'test';
  priority := 100; -- Highest priority for testing
ELSIF star_count <= 50 AND contributor_count <= 10 AND pr_count <= 100 THEN
  category := 'small';
  priority := 80;
ELSIF star_count <= 500 AND contributor_count <= 50 AND pr_count <= 1000 THEN
  category := 'medium';
  priority := 60;
ELSIF star_count <= 5000 AND contributor_count <= 200 AND pr_count <= 10000 THEN
  category := 'large';
  priority := 40;
ELSE
  category := 'enterprise';
  priority := 20; -- Lowest priority for enterprise repos
END IF;
```

#### Repository Categories

| Category | Star Count | Contributors | PRs | Priority | Use Case |
|----------|------------|--------------|-----|----------|----------|
| **test** | 0 | ≤ 2 | ≤ 10 | 100 | Safe testing, initial rollout |
| **small** | ≤ 50 | ≤ 10 | ≤ 100 | 80 | Low-risk production validation |
| **medium** | ≤ 500 | ≤ 50 | ≤ 1,000 | 60 | Standard production repositories |
| **large** | ≤ 5,000 | ≤ 200 | ≤ 10,000 | 40 | High-activity repositories |
| **enterprise** | > 5,000 | > 200 | > 10,000 | 20 | Critical enterprise repositories |

#### Repository Categorization Manager

```typescript
export class RepositoryCategorizationManager {
  // Bulk operations
  async categorizeAll(): Promise<void>
  async getCategoryStats(): Promise<RepositoryCategoryStats[]>
  
  // Individual repository management
  async categorizeRepository(repositoryId: string): Promise<string | null>
  async getRepositoriesByCategory(category: string): Promise<any[]>
  
  // Test repository management
  async markAsTestRepository(repositoryId: string): Promise<boolean>
  async unmarkAsTestRepository(repositoryId: string): Promise<boolean>
  
  // Rollout-ready repository selection
  async getTestRepositories(): Promise<any[]>
  async getRolloutReadyRepositories(limit: number): Promise<any[]>
}
```

#### Activity Score Calculation

```typescript
monthly_activity_score = LEAST(100, star_count + contributor_count + (pr_count / 10))
```

This score helps prioritize repositories within categories for gradual rollout progression.

### 2. Whitelist-Based Rollout Controls

#### Whitelist Management

The rollout system supports sophisticated whitelist controls through the `rollout_configuration` table:

```sql
-- target_repositories: Array of repository IDs for explicit inclusion
-- excluded_repositories: Array of repository IDs for explicit exclusion
-- rollout_strategy: 'percentage' | 'whitelist' | 'repository_size'
```

#### Rollout Strategies

**1. Percentage-Based Rollout**
```typescript
rollout_strategy = 'percentage'
// Uses hash-based deterministic selection
is_eligible := (hashtext(repo_id::TEXT) % 100) < rollout_percentage;
```

**2. Whitelist-Based Rollout**
```typescript
rollout_strategy = 'whitelist'
// Only repositories in target_repositories are eligible
// Excludes any repositories in excluded_repositories
```

**3. Repository Size-Based Rollout**
```typescript
rollout_strategy = 'repository_size'
// Gradual rollout by category:
// 10% → test repositories only
// 25% → test + small repositories  
// 50% → test + small + medium repositories
// 75% → test + small + medium + large repositories
// 100% → all categories
```

#### Whitelist Operations

```typescript
// Add repositories to whitelist
await hybridRolloutManager.addToWhitelist(['repo-id-1', 'repo-id-2'], 'Adding critical repositories for testing');

// Remove repositories from whitelist  
await hybridRolloutManager.removeFromWhitelist(['repo-id-3'], 'Removing due to issues');

// Check current whitelist
const config = await hybridRolloutManager.getRolloutConfiguration();
console.log('Whitelisted repositories:', config.target_repositories);
console.log('Excluded repositories:', config.excluded_repositories);
```

### 3. Manual Override Mechanisms

**File**: `src/lib/progressive-capture/rollout-console.ts`

#### Global Console Interface

The rollout console provides a comprehensive interface for manual control:

```typescript
// Available as global `rollout` object in browser console
declare global {
  interface Window {
    rollout: RolloutConsole;
  }
}
```

#### Core Override Functions

**Status and Monitoring**
```typescript
await rollout.status()        // Current rollout status
await rollout.stats()         // Detailed statistics  
await rollout.categories()    // Repository category breakdown
await rollout.checkHealth()   // Health check and auto-rollback trigger
```

**Rollout Controls**
```typescript
await rollout.setRollout(percentage)     // Set rollout percentage (0-100)
await rollout.emergencyStop(reason?)     // Immediate emergency stop
await rollout.resume()                   // Resume after emergency stop  
```

**Whitelist Management**
```typescript
await rollout.addToWhitelist([repositoryIds])      // Add repositories
await rollout.removeFromWhitelist([repositoryIds]) // Remove repositories
await rollout.showWhitelist()                      // Display current whitelist
```

**Repository Management**
```typescript
await rollout.categorizeAll()           // Categorize all repositories
await rollout.markAsTest(repositoryId)  // Mark as test repository
await rollout.unmarkAsTest(repositoryId) // Unmark as test repository
```

#### Manual Override Examples

```typescript
// Emergency response - immediate stop
await rollout.emergencyStop('High error rate detected in production');

// Gradual rollout progression
await rollout.setRollout(10);  // Start with 10% test repositories
// Monitor for issues...
await rollout.setRollout(25);  // Expand to small repositories
// Continue monitoring...
await rollout.setRollout(50);  // Include medium repositories

// Targeted testing
await rollout.addToWhitelist(['microsoft/vscode', 'facebook/react']);
await rollout.setRollout(0); // Set strategy to whitelist-only

// Repository management
await rollout.markAsTest('myorg/test-repo');
await rollout.categorizeAll(); // Refresh all categorizations
```

### 4. Rollback Procedures

#### Automatic Rollback System

**Health-Based Rollback**
```typescript
async checkAndTriggerAutoRollback(): Promise<boolean> {
  const stats = await this.getRolloutStats();
  const config = await this.getRolloutConfiguration();
  
  // Trigger rollback if error rate exceeds threshold
  if (stats.error_rate > config.max_error_rate && stats.active_jobs > 10) {
    await this.updateRolloutPercentage(0, 'auto_rollback', 
      `Error rate ${stats.error_rate}% exceeded threshold ${config.max_error_rate}%`);
    return true;
  }
  
  return false;
}
```

**Rollback Triggers**
- Error rate > `max_error_rate` (default 5%)
- Minimum job volume (10+) to avoid false positives
- Auto-rollback enabled in configuration
- Sufficient monitoring window data

#### Manual Rollback Procedures

**Console-Based Rollback**
```typescript
// Immediate rollback to 0%
await rollout.rollbackToZero();

// Partial rollback to specific percentage
await rollout.rollbackToPercentage(25);

// Emergency stop with reason
await rollout.emergencyStop('Critical production issue detected');
```

**Database-Based Rollback**
```sql
-- Emergency rollback via SQL
UPDATE rollout_configuration 
SET rollout_percentage = 0, 
    emergency_stop = true,
    updated_at = NOW() 
WHERE feature_name = 'hybrid_progressive_capture';

-- Log the rollback action
INSERT INTO rollout_history (rollout_config_id, action, previous_percentage, new_percentage, reason, triggered_by)
VALUES (config_id, 'emergency_rollback', 50, 0, 'Manual emergency rollback', 'manual');
```

#### Rollback Validation

**Verification Steps**
1. **Configuration Check**: Verify rollout percentage is set to target value
2. **Job Routing**: Confirm new jobs route to Inngest (fallback mode)
3. **Metrics Update**: Validate metrics reflect the rollback
4. **History Logging**: Ensure rollback is logged in audit trail

**Rollback Recovery Time**
- **Console rollback**: < 30 seconds
- **Database rollback**: < 1 minute  
- **Environment variable rollback**: < 5 minutes (requires deployment)
- **Full system validation**: < 5 minutes

### 5. Enhanced Eligibility Logic

#### Repository Eligibility Algorithm

```typescript
async isRepositoryEligible(repositoryId: string): Promise<boolean> {
  // 1. Environment override check
  if (this.emergencyStopOverride) return false;
  
  // 2. Get active rollout configuration
  const config = await this.getRolloutConfiguration();
  if (!config || config.emergency_stop) return false;
  
  // 3. Check explicit exclusion
  if (config.excluded_repositories.includes(repositoryId)) return false;
  
  // 4. Check explicit inclusion (whitelist)
  if (config.target_repositories.includes(repositoryId)) return true;
  
  // 5. Apply strategy-based logic
  return await this.applyRolloutStrategy(config, repositoryId);
}
```

#### Strategy Application

```typescript
async applyRolloutStrategy(config: RolloutConfiguration, repositoryId: string): Promise<boolean> {
  switch (config.rollout_strategy) {
    case 'whitelist':
      // Only whitelisted repositories
      return config.target_repositories.includes(repositoryId);
      
    case 'percentage':
      // Hash-based percentage selection
      return (this.hashCode(repositoryId) % 100) < config.rollout_percentage;
      
    case 'repository_size':
      // Category-based gradual rollout
      const category = await this.getRepositoryCategory(repositoryId);
      return this.isCategoryEligible(category, config.rollout_percentage);
      
    default:
      return false;
  }
}
```

## Targeting Strategies

### 1. Safe Rollout Progression

**Phase A: Test Repositories (0-10%)**
- Target: Repositories with minimal production impact
- Selection: `is_test_repository = true` OR category = 'test'
- Duration: 1-2 days for validation
- Validation: Error rates, processing times, basic functionality

**Phase B: Small Repositories (10-25%)**  
- Target: Low-activity production repositories
- Selection: category IN ('test', 'small')
- Duration: 3-5 days for broader validation
- Validation: Cost savings, performance improvements, edge cases

**Phase C: Medium Repositories (25-50%)**
- Target: Standard production workloads
- Selection: category IN ('test', 'small', 'medium')  
- Duration: 1 week for scale validation
- Validation: System stability, resource utilization, user impact

**Phase D: Large Repositories (50-75%)**
- Target: High-activity repositories
- Selection: category IN ('test', 'small', 'medium', 'large')
- Duration: 1-2 weeks for full validation
- Validation: Performance at scale, cost optimization, reliability

**Phase E: Enterprise Repositories (75-100%)**
- Target: Critical enterprise workloads
- Selection: All categories
- Duration: 2-4 weeks for complete rollout
- Validation: Enterprise requirements, SLA compliance, full system validation

### 2. Targeted Testing Strategies

**Critical Repository Testing**
```typescript
// Add specific high-value repositories for targeted testing
await rollout.addToWhitelist([
  'microsoft/vscode',
  'facebook/react', 
  'vercel/next.js'
]);
await rollout.setRollout(0); // Use whitelist-only mode
```

**Organization-Based Rollout**
```typescript
// Target specific organizations
const orgRepositories = await getRepositoriesByOrganization('my-company');
await rollout.addToWhitelist(orgRepositories.map(r => r.id));
```

**Category-Specific Testing**
```sql
-- Target only test repositories
UPDATE rollout_configuration 
SET rollout_strategy = 'repository_size', rollout_percentage = 10;

-- Expand to small repositories  
UPDATE rollout_configuration 
SET rollout_percentage = 25;
```

## Monitoring and Validation

### 1. Repository Participation Metrics

```typescript
interface RepositoryMetrics {
  totalRepositories: number;
  categorizedRepositories: number;
  categoryDistribution: Record<string, number>;
  activeRepositories: number;
  repositoryParticipationRate: number;
  testRepositories: number;
}
```

### 2. Category-Based Analysis

```typescript
// Get category statistics
const stats = await repositoryCategorizer.getCategoryStats();
/*
[
  { category: 'small', count: 150, total_star_count: 2500, ... },
  { category: 'medium', count: 75, total_star_count: 15000, ... },
  { category: 'large', count: 25, total_star_count: 50000, ... }
]
*/

// Get repositories by category
const testRepos = await repositoryCategorizer.getRepositoriesByCategory('test');
const rolloutReady = await repositoryCategorizer.getRolloutReadyRepositories(50);
```

### 3. Rollout Health Validation

**Key Health Indicators**
- Repository participation rate (target: >10% of eligible repositories)
- Category distribution balance (avoid over-concentration in any category)
- Test repository availability (minimum 5-10 test repositories)
- Error rate by category (validate category-specific performance)

## Operational Procedures

### 1. Rollout Initiation

```bash
# 1. Verify system health
await rollout.checkHealth()

# 2. Categorize repositories  
await rollout.categorizeAll()

# 3. Review category distribution
await rollout.categories()

# 4. Start with test repositories
await rollout.setRollout(10)

# 5. Monitor for 24-48 hours
await rollout.stats()
```

### 2. Rollout Progression

```bash
# Monitor current status
await rollout.status()

# Check health before progression
await rollout.checkHealth()

# Gradual increase
await rollout.setRollout(25)  # Add small repositories
await rollout.setRollout(50)  # Add medium repositories  
await rollout.setRollout(75)  # Add large repositories
await rollout.setRollout(100) # Full rollout
```

### 3. Issue Response

```bash
# Immediate response to issues
await rollout.emergencyStop('Production issues detected')

# Partial rollback
await rollout.rollbackToPercentage(25)

# Exclude problematic repositories
await rollout.removeFromWhitelist(['problematic-repo-id'])

# Resume after resolution
await rollout.resume()
```

## Configuration Examples

### 1. Development Testing

```typescript
// Set up for development testing
await rollout.markAsTest('my-org/test-repo-1');
await rollout.markAsTest('my-org/test-repo-2');
await rollout.setRollout(10); // Test repositories only
```

### 2. Staged Production Rollout

```sql
-- Stage 1: Test repositories only (10%)
UPDATE rollout_configuration 
SET rollout_strategy = 'repository_size', rollout_percentage = 10;

-- Stage 2: Include small repositories (25%)  
UPDATE rollout_configuration 
SET rollout_percentage = 25;

-- Stage 3: Include medium repositories (50%)
UPDATE rollout_configuration 
SET rollout_percentage = 50;
```

### 3. Selective Rollout

```typescript
// Whitelist-based selective rollout
await rollout.addToWhitelist([
  'critical-org/important-repo',
  'test-org/validation-repo',
  'trusted-org/stable-repo'
]);

// Set to whitelist-only mode
const { error } = await supabase
  .from('rollout_configuration')
  .update({ rollout_strategy: 'whitelist' })
  .eq('feature_name', 'hybrid_progressive_capture');
```

## Files Modified/Created

### ✅ Repository Management
- `src/lib/progressive-capture/repository-categorization.ts`
- `src/lib/progressive-capture/rollout-console.ts`

### ✅ Enhanced Rollout Logic
- `src/lib/progressive-capture/rollout-manager.ts` (whitelist and override methods)
- `src/lib/progressive-capture/hybrid-queue-manager.ts` (eligibility integration)

### ✅ Database Functions
- `categorize_repository(repo_id UUID)` - Automatic categorization
- `is_repository_eligible_for_rollout(repo_id UUID, feature_name TEXT)` - Eligibility checking

## Success Criteria ✅

- [x] **Repository categorization**: Automatic classification with manual override capability
- [x] **Whitelist controls**: Add/remove repositories with audit trail
- [x] **Manual overrides**: Console interface for operational control  
- [x] **Rollback procedures**: Automatic and manual rollback with validation
- [x] **Targeting strategies**: Multiple rollout strategies (percentage, whitelist, category-based)
- [x] **Safety mechanisms**: Emergency stop, error threshold monitoring
- [x] **Operational tools**: Complete console interface for daily operations

## Next Steps (Phase 3)

1. **Performance Monitoring**: Real-time dashboard and alerting system
2. **Advanced Safety**: Circuit breaker patterns and predictive rollback
3. **Automated Workflows**: GitHub Actions integration for monitoring and rollback
4. **Cost Optimization**: Dynamic routing based on cost and performance analysis

Phase 2 provides sophisticated targeting capabilities while maintaining the safety and control mechanisms established in Phase 1. The system is now ready for granular, controlled rollout with comprehensive monitoring and rapid response capabilities.