# Rollout Console Commands Reference

## Overview

The rollout console provides a global `r` object (short for rollout) for quick operational control. All commands are designed to be short and easy to type in production scenarios.

## Quick Reference

```javascript
// Status & Monitoring (Read-only)
r.s()           // status - current rollout state
r.st()          // stats - detailed statistics  
r.h()           // health - health check
r.c()           // categories - repository breakdown

// Rollout Controls (Destructive)
r.set(n)        // set rollout percentage (0-100)
r.stop()        // emergency stop
r.go()          // resume rollout

// Emergency Commands (Critical)
r.back()        // rollback to 0%
r.back(n)       // rollback to n%
r.kill()        // emergency stop with confirmation
```

## Command Categories

### 📊 Status & Monitoring Commands

#### `r.s()` - Quick Status
```javascript
r.s()
// Output: 
// Rollout: 25% | Health: 92/100 | Jobs: 1,247 | Errors: 1.8%
```

#### `r.st()` - Detailed Statistics  
```javascript
r.st()
// Shows: processor breakdown, success rates, cost savings, trends
```

#### `r.h()` - Health Check
```javascript
r.h()
// Triggers immediate health check and auto-rollback if needed
// Returns: health score, issues, recommendations
```

#### `r.c()` - Repository Categories
```javascript
r.c()
// Shows: test (15), small (145), medium (67), large (23), enterprise (8)
```

### 🎯 Rollout Control Commands

#### `r.set(percentage)` - Set Rollout Percentage
```javascript
r.set(10)    // Start with 10% (test repositories)
r.set(25)    // Expand to 25% (add small repositories)  
r.set(50)    // Expand to 50% (add medium repositories)
r.set(100)   // Full rollout
```

#### `r.stop()` - Emergency Stop
```javascript
r.stop()
// Immediate emergency stop, sets rollout to 0%
// Requires confirmation for safety
```

#### `r.go()` - Resume Rollout
```javascript
r.go()
// Clears emergency stop flag
// Resumes at last configured percentage
```

### 🔧 Repository Management

#### `r.add(repos)` - Add to Whitelist
```javascript
r.add(['repo-id-1', 'repo-id-2'])
r.add('single-repo-id')
```

#### `r.rm(repos)` - Remove from Whitelist
```javascript
r.rm(['repo-id-1', 'repo-id-2'])  
r.rm('single-repo-id')
```

#### `r.test(repo)` - Mark as Test Repository
```javascript
r.test('my-org/test-repo')
```

#### `r.untest(repo)` - Unmark as Test Repository  
```javascript
r.untest('my-org/test-repo')
```

### 🚨 Emergency Commands

#### `r.back()` - Rollback to Zero
```javascript
r.back()
// Immediate rollback to 0%, logs reason
```

#### `r.back(percentage)` - Rollback to Percentage
```javascript
r.back(25)
// Rollback to 25%, useful for partial rollback
```

#### `r.kill()` - Emergency Kill Switch
```javascript
r.kill()
// Most severe action - emergency stop + rollback
// Requires typing 'YES' for confirmation
```

### 📈 Advanced Commands

#### `r.w()` - Show Whitelist
```javascript
r.w()
// Shows current whitelisted and excluded repositories
```

#### `r.cat()` - Categorize All Repositories
```javascript
r.cat()
// Triggers full repository categorization
// Use sparingly - can take time for large datasets
```

#### `r.trend()` - Trend Analysis
```javascript
r.trend()
// Shows performance trends vs previous period
```

## Command Aliases

### Short Aliases (Fastest to Type)
```javascript
r.s()     = r.status()
r.st()    = r.stats()  
r.h()     = r.health()
r.c()     = r.categories()
r.w()     = r.whitelist()
r.back()  = r.rollback()
r.stop()  = r.emergencyStop()
r.go()    = r.resume()
```

### Medium Aliases (Balance of Speed/Clarity)
```javascript
r.set(n)    = r.setRollout(n)
r.add(ids)  = r.addToWhitelist(ids)
r.rm(ids)   = r.removeFromWhitelist(ids)
r.test(id)  = r.markAsTest(id)
r.cat()     = r.categorizeAll()
```

## Production Workflows

### 🚀 Rollout Progression
```javascript
// 1. Check initial status
r.s()

// 2. Start rollout with test repositories
r.set(10)

// 3. Monitor health for 24 hours
r.h()
r.st()

// 4. Expand if healthy
r.set(25)  // Add small repositories
r.set(50)  // Add medium repositories
r.set(100) // Full rollout
```

### 🔍 Health Monitoring
```javascript
// Quick health check
r.h()

// Detailed analysis
r.st()

// Check trends
r.trend()

// Emergency response if issues detected
r.back(25)  // Partial rollback
r.stop()    // Emergency stop
```

### 🚨 Emergency Response
```javascript
// Immediate response to critical issues
r.kill()    // Emergency kill (requires confirmation)

// Or gradual response
r.stop()    // Emergency stop
r.back()    // Rollback to 0%

// After issue resolution
r.go()      // Resume rollout
r.set(10)   // Restart cautiously
```

### 🎯 Targeted Testing
```javascript
// Add specific repositories for testing
r.add(['microsoft/vscode', 'facebook/react'])

// Mark repositories as test repositories
r.test('my-org/test-repo')

// Check category distribution
r.c()

// Review whitelist
r.w()
```

## Safety Features

### 📝 Confirmation Requirements

**Destructive Commands Require Confirmation:**
- `r.kill()` - Must type 'YES'
- `r.stop()` - Confirms emergency stop
- `r.back()` - Confirms rollback action

**Read-only Commands (No Confirmation):**
- `r.s()`, `r.st()`, `r.h()`, `r.c()`, `r.w()`, `r.trend()`

### 🔒 Safety Limits

**Rollout Percentage Validation:**
```javascript
r.set(150)  // ❌ Error: Percentage must be 0-100
r.set(-10)  // ❌ Error: Percentage must be 0-100
r.set(25)   // ✅ Valid
```

**Repository ID Validation:**
```javascript
r.add([])           // ❌ Error: Repository list cannot be empty
r.add('invalid')    // ⚠️  Warning: Repository ID not found
r.add('valid-id')   // ✅ Valid
```

## Output Formats

### 📊 Status Display (`r.s()`)
```
🚀 Rollout Status: 25% ACTIVE
💯 Health Score: 92/100
📦 Total Jobs: 1,247 (last 24h)
❌ Error Rate: 1.8% (threshold: 5.0%)
⚡ Processors: 64% Inngest, 36% Actions
💰 Cost Savings: 23.5% vs Inngest-only
```

### 📈 Stats Display (`r.st()`)
```
📊 Rollout Statistics (24h window)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Jobs Processed: 1,247
Success Rate: 98.2%
Error Rate: 1.8%
Avg Processing: 2.3s

Processor Breakdown:
• Inngest: 800 jobs (64%) - 2.1s avg
• Actions: 447 jobs (36%) - 2.7s avg

Repository Participation:
• Active: 156/298 repositories (52%)
• Categories: test(15), small(89), medium(52)

Cost Analysis:
• Estimated Savings: 23.5%
• Inngest Cost: $1.60
• Actions Cost: $0.89
```

### 🏥 Health Display (`r.h()`)
```
🏥 Health Check Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Health: 92/100 ✅ HEALTHY

Component Status:
• Error Rates: ✅ 1.8% (threshold: 5.0%)
• Processor Health: ✅ Both active
• Queue Health: ✅ No backlogs
• Repository Health: ✅ Good distribution

Recommendations:
• System performing well - consider expanding rollout
• Monitor Inngest latency - slight increase detected
```

## Advanced Usage

### 🔄 Batch Operations
```javascript
// Multiple repository operations
r.add(['repo1', 'repo2', 'repo3'])
r.rm(['old-repo1', 'old-repo2'])

// Sequential rollout commands
r.set(10); setTimeout(() => r.h(), 30000)  // Check health after 30s
```

### 📱 Mobile-Friendly Commands
```javascript
// Extra short commands for mobile typing
r.s     // status (property access)
r.h     // health
r.c     // categories

// Quick emergency
r.kill  // emergency kill (property access shows help)
```

### 🔍 Debugging Commands
```javascript
// Get raw configuration
r.config()

// Show recent history
r.history()

// Export current state
r.export()

// Import state (for testing)
r.import(configObject)
```

## Integration with Existing Tools

### 🔗 Browser DevTools
```javascript
// Set breakpoints for monitoring
console.log('Rollout status:', await r.s());

// Continuous monitoring
setInterval(() => r.h(), 300000); // Health check every 5 minutes
```

### 📝 Script Integration
```javascript
// Use in automation scripts
if (await r.errorRate() > 3.0) {
  await r.back(25);
  console.log('Rolled back due to high error rate');
}
```

### 📊 Dashboard Integration
```javascript
// Export data for dashboards
const data = await r.export();
sendToDashboard(data);
```

## Error Handling

### ⚠️ Common Errors and Solutions

**"No active rollout configuration"**
```javascript
// Solution: Check if rollout is properly initialized
r.s()  // Should show configuration status
```

**"Repository not found"**
```javascript
// Solution: Verify repository ID format
r.add(['owner/repo'])  // Correct format
r.add(['just-repo'])   // ❌ Incorrect format
```

**"Database connection failed"**
```javascript
// Solution: Check connection and retry
setTimeout(() => r.s(), 5000);  // Retry after 5 seconds
```

**"Insufficient permissions"**
```javascript
// Solution: Emergency commands may require service role
// Contact admin for permission escalation
```

## Quick Help

Type `r.help()` in console for this reference, or use these quick reminders:

```javascript
r.help()           // Show full help
r.help('status')   // Help for status commands
r.help('control')  // Help for control commands  
r.help('emergency') // Help for emergency commands
```

## Best Practices

1. **Always check status first**: `r.s()` before making changes
2. **Monitor health regularly**: `r.h()` during rollout progression
3. **Use gradual progression**: 10% → 25% → 50% → 100%
4. **Keep emergency commands ready**: Know `r.kill()` and `r.back()`
5. **Document changes**: Include reason when using destructive commands
6. **Verify after changes**: Check `r.s()` after `r.set()` commands

The console commands provide quick, efficient control for production rollout management while maintaining safety through confirmation requirements and validation.