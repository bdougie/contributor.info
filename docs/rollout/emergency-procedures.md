# Emergency Procedures: Hybrid Progressive Capture Rollout

## Overview

Emergency procedures for the hybrid progressive capture rollout system. These procedures provide step-by-step guidance for responding to critical issues, performing emergency rollbacks, and restoring system stability.

## 🚨 Emergency Response Matrix

### Critical Alerts (Immediate Action Required)

| Alert Type | Severity | Response Time | Primary Action |
|------------|----------|---------------|----------------|
| **Error Rate > 10%** | Critical | < 2 minutes | Emergency rollback |
| **System-wide failure** | Critical | < 1 minute | Kill switch activation |
| **Data corruption** | Critical | < 5 minutes | Immediate stop + investigation |
| **Security incident** | Critical | < 1 minute | Full system shutdown |

### Warning Alerts (Monitor & Prepare)

| Alert Type | Severity | Response Time | Primary Action |
|------------|----------|---------------|----------------|
| **Error Rate 5-10%** | Warning | < 15 minutes | Partial rollback consideration |
| **Performance degradation** | Warning | < 30 minutes | Health check + monitoring |
| **Cost anomalies** | Warning | < 1 hour | Cost analysis + adjustment |

## 🔥 Emergency Response Procedures

### Procedure 1: Critical Error Rate Response

**Trigger**: Error rate > 10% or Sentry critical alert

**Immediate Actions (< 2 minutes)**:
```javascript
// 1. Check current status
r.s()

// 2. Immediate emergency stop
r.kill()
// Type 'YES' when prompted

// 3. Verify rollback
r.s()
// Should show: "Rollout: 0% EMERGENCY STOP"
```

**Follow-up Actions (< 15 minutes)**:
1. **Review recent errors**:
   ```bash
   # Check Sentry for error patterns
   # Review GitHub Actions workflow logs
   # Check Supabase logs for database issues
   ```

2. **Validate system state**:
   ```javascript
   r.h()  // Health check
   r.st() // Detailed stats
   ```

3. **Document incident**:
   ```javascript
   // Emergency stop reason will be automatically logged
   // Add additional context via console or GitHub issue
   ```

### Procedure 2: System-Wide Failure Response

**Trigger**: Complete system unresponsiveness or cascading failures

**Immediate Actions (< 1 minute)**:
```bash
# Environment variable override (fastest method)
export HYBRID_EMERGENCY_STOP=true

# Database override (if environment access unavailable)
# Use Supabase Dashboard SQL Editor:
UPDATE rollout_configuration 
SET emergency_stop = true, rollout_percentage = 0 
WHERE feature_name = 'hybrid_progressive_capture';
```

**Verification**:
```javascript
// After override, verify system state
r.s()
// Should show emergency stop status
```

### Procedure 3: Partial Rollback Response

**Trigger**: Error rate 5-10% or performance degradation

**Assessment Phase (< 5 minutes)**:
```javascript
// 1. Health check
r.h()

// 2. Analyze trends
r.trend()

// 3. Check processor health
r.st()
```

**Rollback Decision Matrix**:
- **Error rate 5-7%**: Rollback to 50% of current percentage
- **Error rate 7-10%**: Rollback to 25% of current percentage  
- **Performance degradation >50%**: Rollback to previous stable percentage

**Execution**:
```javascript
// Partial rollback examples
r.back(25)  // Rollback to 25%
r.back(10)  // Rollback to test repositories only
r.back()    // Full rollback to 0%
```

### Procedure 4: Data Integrity Issues

**Trigger**: Reports of missing data, incorrect processing, or data corruption

**Immediate Response (< 5 minutes)**:
```javascript
// 1. Emergency stop
r.stop()

// 2. Exclude affected repositories
r.rm(['affected-repo-id-1', 'affected-repo-id-2'])

// 3. Document affected scope
// Record repository IDs and time ranges affected
```

**Investigation Phase**:
1. **Review processing logs**:
   ```bash
   # Check GitHub Actions logs for affected repositories
   # Review Inngest function logs
   # Examine Supabase sync_logs table
   ```

2. **Validate data integrity**:
   ```sql
   -- Check for missing or duplicate data
   SELECT repository_id, COUNT(*) 
   FROM contributors 
   WHERE updated_at > 'incident-start-time'
   GROUP BY repository_id 
   HAVING COUNT(*) = 0;
   ```

3. **Scope assessment**:
   - Identify affected repositories
   - Determine time range of impact
   - Assess data recovery requirements

## 🛠️ Recovery Procedures

### Standard Recovery Process

**Step 1: Incident Resolution**
- Fix underlying issue (code deploy, configuration update, etc.)
- Validate fix in non-production environment
- Prepare monitoring for resumed rollout

**Step 2: Gradual Resumption**
```javascript
// 1. Clear emergency stop
r.go()

// 2. Start with minimal rollout
r.set(10)  // Test repositories only

// 3. Monitor for 1-2 hours
setInterval(() => {
  r.h()  // Automated health check
}, 300000) // Every 5 minutes

// 4. Gradual increase if healthy
setTimeout(() => r.set(25), 7200000)  // After 2 hours
```

**Step 3: Validation Checklist**
- [ ] Error rate < 2.5% for 2+ hours
- [ ] Health score > 80 for 1+ hour  
- [ ] No new critical alerts
- [ ] Processing times within normal range
- [ ] Cost metrics stable

### Data Recovery Process

**For Missing Data**:
```bash
# 1. Identify missing time ranges
# 2. Trigger manual data collection for affected repositories
# 3. Validate data completeness
# 4. Resume normal processing
```

**For Corrupted Data**:
```bash
# 1. Backup existing data
# 2. Remove corrupted records
# 3. Re-process affected repositories
# 4. Validate data integrity
```

## 📞 Escalation Procedures

### Internal Escalation

**Level 1: Development Team** (First 30 minutes)
- Handle standard rollback scenarios
- Address common configuration issues
- Resolve performance degradation

**Level 2: Senior Engineering** (After 30 minutes or major issues)
- Complex data integrity issues  
- System architecture problems
- Security-related incidents

**Level 3: Executive/Business** (After 2 hours or business impact)
- Customer-facing impact
- Significant cost implications
- Public relations concerns

### External Communication

**Customer Communication Template**:
```
Subject: Service Update - GitHub Contributor Processing

We're experiencing elevated error rates in our GitHub data processing system. 
We've implemented protective measures and are investigating the root cause.

Impact: Some repositories may show slightly delayed data updates.
Timeline: We expect resolution within [X] hours.
Updates: We'll provide updates every [Y] hours.

Our team is actively working on a resolution.
```

## 🔍 Investigation Procedures

### Log Analysis

**GitHub Actions Logs**:
```bash
# Access via GitHub UI or API
# Focus on workflows: rollout-health-monitor, rollout-metrics-collector
# Look for patterns in timing and error messages
```

**Sentry Analysis**:
```bash
# Filter by rollout tags:
# rollout.percentage, rollout.processor, alert.type
# Analyze error frequency and correlation
```

**Supabase Logs**:
```bash
# Use Supabase Dashboard Logs section
# Filter by service: api, postgres, auth
# Focus on error rates and slow queries
```

### Performance Analysis

**Key Metrics to Review**:
1. **Processing Time Trends**:
   ```javascript
   // Look for sudden increases in processing time
   // Compare Inngest vs GitHub Actions performance
   ```

2. **Error Pattern Analysis**:
   ```javascript
   // Categorize errors by type
   // Identify if errors are repository-specific
   // Check for time-based patterns
   ```

3. **Cost Impact Assessment**:
   ```javascript
   // Calculate actual vs expected costs
   // Identify cost drivers
   // Assess budget impact
   ```

## 📋 Post-Incident Procedures

### Immediate Post-Incident (< 24 hours)

**1. Incident Report Creation**:
```markdown
# Incident Report: [Date] - [Brief Description]

## Summary
- Start time: [timestamp]
- End time: [timestamp]  
- Impact: [description]
- Root cause: [analysis]

## Timeline
- [timestamp]: Issue detected
- [timestamp]: Emergency response initiated
- [timestamp]: Resolution implemented
- [timestamp]: Normal operations resumed

## Lessons Learned
- [key learnings]
- [process improvements needed]

## Action Items
- [ ] [specific action] - [owner] - [due date]
```

**2. System Validation**:
- [ ] Confirm all metrics are within normal ranges
- [ ] Validate data integrity for affected period
- [ ] Test emergency procedures used
- [ ] Update monitoring thresholds if needed

### Follow-up Actions (< 1 week)

**1. Process Improvements**:
- Review and update emergency procedures
- Enhance monitoring and alerting
- Improve documentation gaps identified
- Conduct team training if needed

**2. System Hardening**:
- Implement additional safety mechanisms
- Update error handling for identified edge cases
- Enhance rollback automation
- Improve alert signal-to-noise ratio

## 🛡️ Prevention Measures

### Proactive Monitoring

**Daily Health Checks**:
```javascript
// Automated daily health assessment
r.h()  // Overall health
r.st() // Detailed statistics
r.trend() // Performance trends
```

**Weekly Review Process**:
1. Review incident history
2. Analyze performance trends
3. Assess cost optimization opportunities
4. Update emergency contact information

### System Hardening

**Enhanced Error Handling**:
- Implement circuit breaker patterns
- Add retry mechanisms with exponential backoff
- Improve error categorization and routing
- Enhanced logging for debugging

**Improved Monitoring**:
- Lower alert thresholds for early warning
- Add predictive monitoring based on trends
- Implement cross-service correlation
- Enhanced dashboard visualization

## 📱 Emergency Contacts

### Primary On-Call

**Development Team**:
- Primary: [Developer Name] - [Contact]
- Secondary: [Developer Name] - [Contact]

**Infrastructure Team**:
- Primary: [Engineer Name] - [Contact] 
- Secondary: [Engineer Name] - [Contact]

### Escalation Contacts

**Engineering Leadership**:
- [Name] - [Contact] - [Availability]

**Business Leadership** (for customer impact):
- [Name] - [Contact] - [Availability]

### External Contacts

**Supabase Support**: [Support contact for database issues]
**GitHub Support**: [Support contact for API issues]
**Inngest Support**: [Support contact for function issues]

## 🔧 Emergency Tooling

### Browser Console Access

**Quick Access Commands**:
```javascript
// Emergency console setup (paste in browser)
const emergency = {
  status: () => r.s(),
  kill: () => r.kill(),
  health: () => r.h(),
  rollback: (percent = 0) => r.back(percent),
  stop: () => r.stop()
};

// Use: emergency.kill() for fastest access
```

### Database Emergency Queries

**Emergency Stop via SQL**:
```sql
-- Use in Supabase SQL Editor for immediate stop
UPDATE rollout_configuration 
SET emergency_stop = true, 
    rollout_percentage = 0,
    updated_at = NOW()
WHERE feature_name = 'hybrid_progressive_capture';
```

**Health Check via SQL**:
```sql
-- Get rollout status and recent metrics
SELECT 
  rc.rollout_percentage,
  rc.emergency_stop,
  COUNT(rm.id) as recent_jobs,
  AVG(CASE WHEN rm.error_count > 0 THEN 1.0 ELSE 0.0 END) * 100 as error_rate
FROM rollout_configuration rc
LEFT JOIN rollout_metrics rm ON rm.created_at > NOW() - INTERVAL '1 hour'
WHERE rc.feature_name = 'hybrid_progressive_capture'
GROUP BY rc.id, rc.rollout_percentage, rc.emergency_stop;
```

## 📈 Success Metrics

### Response Time Targets

- **Critical alerts**: < 2 minutes to emergency action
- **Warning alerts**: < 15 minutes to assessment
- **System recovery**: < 30 minutes to stable state
- **Full resolution**: < 4 hours to normal operations

### Quality Metrics

- **False positive rate**: < 5% of emergency responses
- **Recovery success rate**: > 95% within SLA
- **Data integrity**: 0% data loss during incidents
- **Customer impact**: < 1% of repositories affected

## 🔄 Procedure Testing

### Monthly Drill Schedule

**Week 1**: Emergency rollback drill
**Week 2**: Partial rollback and recovery
**Week 3**: Communication and escalation drill  
**Week 4**: Data integrity scenario

### Drill Checklist

- [ ] All emergency contacts respond within SLA
- [ ] Emergency procedures execute successfully
- [ ] Monitoring and alerting function correctly
- [ ] Communication templates are current
- [ ] Post-drill improvements identified and implemented

## 📚 Reference Materials

### Key Documentation Links

- [Phase 1: Infrastructure](/docs/rollout/phase-1-infrastructure.md)
- [Phase 2: Targeting](/docs/rollout/phase-2-targeting.md)  
- [Phase 3: Monitoring](/docs/rollout/phase-3-monitoring.md)
- [Console Commands](/docs/rollout/console-commands.md)

### External Resources

- **Sentry Dashboard**: [Project-specific Sentry URL]
- **Supabase Dashboard**: [Project-specific Supabase URL]
- **GitHub Actions**: [Repository workflow URLs]
- **Monitoring Dashboard**: [Public dashboard URL]

---

**Remember**: When in doubt, prioritize system stability over feature functionality. Emergency stops are always preferable to data corruption or extended outages.

These procedures ensure rapid response to critical issues while maintaining system integrity and user trust. Regular practice and updates keep the team prepared for any rollout emergency.