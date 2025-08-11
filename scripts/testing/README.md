# Testing Scripts

Comprehensive testing utilities for edge cases, system validation, and hybrid processing verification.

## Overview

These scripts ensure the hybrid progressive capture system handles edge cases gracefully and maintains data integrity across all processing scenarios.

## Scripts

### `edge-case-tester.js`

**Purpose**: Test edge cases and error scenarios to ensure system resilience.

**When to use**:
- Before major releases
- After system configuration changes
- Weekly reliability testing
- Investigating production issues

**What it tests**:
- API rate limit handling
- Network failure recovery
- Data corruption scenarios
- Concurrent processing conflicts
- Large repository edge cases

**Usage**:
```bash
node scripts/testing/edge-case-tester.js
```

**Output**:
- Test results summary (passed/failed)
- Detailed failure analysis
- Recommendations for fixes
- System resilience score

### `hybrid-system-test.js`

**Purpose**: End-to-end testing of the hybrid Inngest + GitHub Actions system.

**When to use**:
- Validating hybrid processing integration
- Testing job routing between processors
- Verifying data consistency
- Performance baseline testing

**What it tests**:
- Job routing logic (recent vs historical data)
- Data consistency between processors
- Performance across both systems
- Error handling and recovery
- Cost optimization effectiveness

**Usage**:
```bash
node scripts/testing/hybrid-system-test.js
```

**Output**:
- Integration test results
- Performance benchmarks
- Data consistency validation
- Job routing verification

### `phase5-test-runner.js`

**Purpose**: Comprehensive testing for Phase 5 rollout features.

**When to use**:
- Before Phase 5 deployment
- Validating rollout readiness
- Testing new feature integration
- System regression testing

**What it tests**:
- Rollout configuration system
- Repository categorization
- Safety controls and auto-rollback
- Monitoring and alerting
- Performance under rollout conditions

**Usage**:
```bash
node scripts/testing/phase5-test-runner.js
```

**Output**:
- Phase 5 readiness assessment
- Feature test results
- Performance impact analysis
- Rollout safety validation

### `test-repository-sync-fix.mjs`

**Purpose**: Validate repository sync event data fix for "Repository not found: undefined" error.

**When to use**:
- After fixing event data issues
- Testing Inngest event parameter changes
- Validating queue data transformations
- Debugging repository sync failures

**What it tests**:
- Required event parameters (repositoryId, days, reason)
- Event data structure validation
- Repository existence verification
- API endpoint functionality (if available)

**Usage**:
```bash
node scripts/testing/test-repository-sync-fix.mjs

# With API endpoint testing
API_ENDPOINT=https://contributor.info/api node scripts/testing/test-repository-sync-fix.mjs
```

**Output**:
- Repository verification status
- Event data validation results
- API response (if endpoint provided)
- Test completion summary

## Test Categories

### Edge Case Testing
- **API Failures**: GitHub API timeouts, rate limits, authentication errors
- **Data Corruption**: Malformed responses, missing fields, invalid data
- **Concurrency Issues**: Multiple jobs processing same data
- **Resource Limits**: Memory exhaustion, disk space, processing timeouts
- **Network Problems**: Intermittent connectivity, DNS failures

### Integration Testing
- **Processor Routing**: Correct job assignment to Inngest vs GitHub Actions
- **Data Consistency**: No gaps or duplicates between processors
- **Error Recovery**: Graceful handling of failures
- **Performance**: Meeting speed and cost targets
- **User Experience**: Immediate feedback maintained

### Rollout Testing
- **Configuration Management**: Rollout percentage controls
- **Safety Systems**: Auto-rollback triggers and thresholds
- **Monitoring**: Health checks and alerting
- **Repository Categorization**: Proper risk-based rollout
- **Emergency Procedures**: Stop/resume functionality

## Testing Workflow

### Pre-Release Testing
```bash
# 1. Run edge case tests
node scripts/testing/edge-case-tester.js

# 2. Test hybrid system integration
node scripts/testing/hybrid-system-test.js

# 3. Validate rollout readiness
node scripts/testing/phase5-test-runner.js

# 4. Check data validation
node scripts/validation/data-gap-validator.js
```

### Production Health Testing
```bash
# 1. Monitor system edge cases
node scripts/testing/edge-case-tester.js

# 2. Verify hybrid performance
node scripts/testing/hybrid-system-test.js

# 3. Check rollout health
node scripts/rollout/monitor-phase6.js
```

### Issue Investigation
```bash
# 1. Reproduce edge case scenarios
node scripts/testing/edge-case-tester.js --scenario=specific-issue

# 2. Test system recovery
node scripts/testing/hybrid-system-test.js --recovery-mode

# 3. Validate fixes
node scripts/validation/data-gap-validator.js
```

## Test Environment Setup

```bash
# Required environment variables
VITE_SUPABASE_URL=your-test-supabase-url
SUPABASE_TOKEN=your-test-service-key
VITE_GITHUB_TOKEN=your-github-token

# Optional test configuration
TEST_REPOSITORY_ID=123              # Test repository
TEST_TIMEOUT=300000                 # Test timeout (5 minutes)
ENABLE_DESTRUCTIVE_TESTS=false      # Enable data-modifying tests
```

## Test Safety

### Safe Tests (Default)
- **Read-only operations**: No data modification
- **Isolated testing**: Uses test data only
- **Non-destructive**: Cannot break production systems
- **Monitoring friendly**: Safe to run in production

### Destructive Tests (Opt-in)
- **Data modification**: Changes test data
- **System configuration**: Modifies rollout settings
- **Resource intensive**: May impact performance
- **Requires confirmation**: Must explicitly enable

## Expected Results

### Edge Case Testing
- **Pass rate**: > 95% for all edge cases
- **Recovery time**: < 30 seconds for failures
- **Data integrity**: 100% data consistency maintained
- **Error handling**: Graceful degradation, no crashes

### Hybrid System Testing
- **Performance**: Meets cost and speed targets
- **Routing accuracy**: > 99% correct processor selection
- **Data consistency**: No gaps between processors
- **Integration**: Seamless operation across both systems

### Rollout Testing
- **Safety controls**: Auto-rollback triggers correctly
- **Monitoring**: All health checks functional
- **Configuration**: Rollout controls work as expected
- **Emergency procedures**: Stop/resume operations successful

## Integration

Testing scripts work with:
- **Monitoring system**: Continuous health validation
- **Rollout system**: Safety testing during deployments
- **Validation system**: Data integrity verification
- **Optimization system**: Performance impact assessment

Use these testing tools to ensure system reliability, data integrity, and optimal performance across all operating conditions.