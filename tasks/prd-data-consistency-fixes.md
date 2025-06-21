# PRD: Data Consistency Fixes for Maintainer Identification

## Project Overview

### Objective
Fix critical data inconsistency issues in the maintainer identification system where users appear with conflicting roles (contributor vs maintainer) across different pull requests and repositories.

### Background
The current system uses GitHub event analysis to classify users as owner/maintainer/contributor with confidence scoring. However, inconsistencies have been identified where the same user (e.g., "bdougie") appears as a contributor in one PR and maintainer in another, indicating flaws in user correlation and confidence aggregation logic.

### Success Metrics
- ✅ 100% of users have consistent role classifications across all their activities
- ✅ Confidence scores properly aggregate all user activities across repositories
- ✅ Zero conflicting role assignments for the same user in the same repository
- ✅ Data audit reports show improved consistency scores >95%

## Current State Analysis

### Issues Identified
1. **User Identity Correlation**: Users not properly correlated across different GitHub events
2. **Inconsistent Role Assignment**: Same user classified differently across PRs/repos
3. **Confidence Score Fragmentation**: User activities not properly aggregated for scoring
4. **Event Processing Logic**: Individual events processed without considering user's complete activity history

### Database Schema Context
- `contributor_roles` table tracks user roles with confidence scores
- `github_events_cache` stores GitHub events for analysis
- `contributor_role_history` maintains audit trail of role changes
- Current logic in `confidence-scoring.ts` and `event-detection.ts`

## Implementation Plan

### Phase 1: Data Audit & Analysis (2-3 days)
**Priority: HIGH**

#### 1.1 Inconsistency Detection
- [ ] Query `contributor_roles` for users with multiple conflicting roles
- [ ] Identify users appearing as both contributor/maintainer in same repo
- [ ] Generate comprehensive data inconsistency report
- [ ] Document specific cases (like bdougie) for validation

#### 1.2 Root Cause Analysis
- [ ] Analyze confidence scoring algorithm for aggregation flaws
- [ ] Review user correlation logic in event processing
- [ ] Identify gaps in user ID normalization across events
- [ ] Document correlation failures between GitHub usernames and IDs

#### 1.3 Impact Assessment
- [ ] Quantify scope of inconsistent data (% of affected users)
- [ ] Assess impact on frontend user experience
- [ ] Evaluate confidence in current maintainer identification accuracy

### Phase 2: User Correlation Enhancement (3-4 days)
**Priority: HIGH**

#### 2.1 Enhanced User Identity Management
- [ ] Create robust user ID correlation system
- [ ] Implement username normalization and deduplication
- [ ] Add user identity verification against GitHub API
- [ ] Create user identity mapping table if needed

#### 2.2 Improved Event Processing
- [ ] Update event processing to consider complete user history
- [ ] Implement user activity aggregation across all repositories
- [ ] Add user context lookup before role determination
- [ ] Enhance bot detection to prevent false positives

#### 2.3 Confidence Scoring Overhaul
- [ ] Modify confidence calculation to aggregate ALL user activities
- [ ] Implement temporal consistency across user's complete timeline
- [ ] Add cross-repository activity analysis
- [ ] Create unified confidence score per user per repository

### Phase 3: Data Migration & Cleanup (2-3 days)
**Priority: HIGH**

#### 3.1 Database Cleanup
- [ ] Create backup of existing `contributor_roles` data
- [ ] Remove duplicate/conflicting role entries
- [ ] Consolidate user activities under canonical user IDs
- [ ] Clean up orphaned records in related tables

#### 3.2 Data Recalculation
- [ ] Recalculate confidence scores with fixed algorithms
- [ ] Regenerate role assignments using enhanced correlation
- [ ] Update `contributor_role_history` with migration notes
- [ ] Verify data integrity post-migration

#### 3.3 Validation & Testing
- [ ] Run comprehensive data validation queries
- [ ] Test specific known cases (bdougie, other identified users)
- [ ] Verify no remaining role conflicts exist
- [ ] Generate post-migration consistency report

### Phase 4: Prevention & Monitoring (1-2 days)
**Priority: MEDIUM**

#### 4.1 Constraint Implementation
- [ ] Add database constraints to prevent future inconsistencies
- [ ] Implement validation rules in confidence scoring logic
- [ ] Add real-time consistency checks during role updates
- [ ] Create data integrity monitoring functions

#### 4.2 Enhanced Logging & Auditing
- [ ] Improve logging in role detection and assignment
- [ ] Add detailed audit trails for confidence score changes
- [ ] Implement alerts for role assignment conflicts
- [ ] Create dashboard for data consistency monitoring

## Technical Guidelines

### Database Changes
```sql
-- Add constraint to prevent conflicting roles per user/repo
ALTER TABLE contributor_roles 
ADD CONSTRAINT unique_user_repo_role 
UNIQUE (user_id, repository_owner, repository_name);

-- Create user identity mapping table if needed
CREATE TABLE user_identity_mapping (
  canonical_user_id TEXT PRIMARY KEY,
  github_id BIGINT,
  github_username TEXT,
  alternative_usernames TEXT[],
  verified_at TIMESTAMPTZ
);
```

### Algorithm Improvements
- User correlation before event processing
- Confidence aggregation across complete user timeline
- Temporal weighting with consistency checks
- Cross-repository activity analysis

### Testing Strategy
```sql
-- Query to find conflicting roles
SELECT user_id, repository_owner, repository_name, 
       array_agg(DISTINCT role) as roles,
       array_agg(confidence_score) as scores
FROM contributor_roles 
GROUP BY user_id, repository_owner, repository_name
HAVING count(DISTINCT role) > 1;

-- Validation query for consistent assignments
SELECT COUNT(*) as consistent_users
FROM (
  SELECT user_id, repository_owner, repository_name
  FROM contributor_roles 
  GROUP BY user_id, repository_owner, repository_name
  HAVING count(DISTINCT role) = 1
) t;
```

## Acceptance Criteria

### Phase 1 Complete ✅
- [ ] Data inconsistency report generated with specific examples
- [ ] Root cause analysis documented with technical details
- [ ] Impact assessment shows scope of data quality issues
- [ ] Known problematic cases (bdougie) identified and documented

### Phase 2 Complete ✅
- [ ] Enhanced user correlation system implemented
- [ ] Confidence scoring properly aggregates all user activities
- [ ] Event processing considers complete user context
- [ ] Bot detection improved to prevent false classifications

### Phase 3 Complete ✅
- [ ] Data migration completed successfully with backups
- [ ] Zero conflicting role assignments remain in database
- [ ] All confidence scores recalculated with new algorithms
- [ ] Post-migration validation confirms data consistency >95%

### Phase 4 Complete ✅
- [ ] Database constraints prevent future inconsistencies
- [ ] Monitoring and alerting systems operational
- [ ] Enhanced logging captures detailed audit information
- [ ] Data consistency dashboard shows health metrics

## Risk Mitigation

### Data Loss Prevention
- Full database backup before any migrations
- Staged rollout with validation checkpoints
- Rollback procedures documented and tested
- Critical user data verified manually

### Performance Considerations
- Batch processing for large data recalculations
- Index optimization for new query patterns
- Memory usage monitoring during migrations
- Progress tracking for long-running operations

### Business Continuity
- Feature flags to disable role updates during migration
- API response consistency during transition
- User communication about temporary inconsistencies
- Gradual rollout of fixes to production

## Future Enhancements

### Real-time Validation
- Live consistency checking during event processing
- Automatic conflict resolution algorithms
- Machine learning for anomaly detection
- Predictive data quality scoring

### Enhanced User Identity
- OAuth integration for verified user identity
- Cross-platform user correlation (GitHub, GitLab, etc.)
- Social graph analysis for relationship mapping
- Advanced bot detection using behavioral patterns

## Implementation Notes

### Code Files to Modify
- `supabase/functions/_shared/confidence-scoring.ts` - Core algorithm fixes
- `supabase/functions/_shared/event-detection.ts` - User correlation logic
- `src/hooks/useContributorRoles.ts` - Frontend data handling
- Database migration files for schema updates

### Testing Requirements
- Unit tests for new correlation algorithms
- Integration tests for data migration scripts
- End-to-end tests for consistent user experience
- Performance tests for confidence calculation at scale

### Documentation Updates
- API documentation for role assignment logic
- Database schema documentation updates
- Troubleshooting guide for data inconsistencies
- Operational runbook for data quality monitoring

---

**Estimated Timeline: 8-12 days**
**Priority: CRITICAL - Must complete before OpenAI Evals setup**
**Dependencies: None (blocking task for evals implementation)**