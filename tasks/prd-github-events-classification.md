# PRD: GitHub Contributor Classification Through Event Analysis

## Project Overview

### Objective
Implement a system to identify GitHub maintainers without write access by analyzing privileged events, achieving 90-95% accuracy in classification.

### Background
The system will analyze GitHub events to detect maintainer-revealing actions and calculate a "rate of self-selection" metric - the percentage of contributions from external vs internal contributors.

### Success Metrics
- 90-95% accuracy in maintainer detection
- Real-time classification updates
- Efficient processing of GitHub events at scale
- Clear visualization of internal vs external contribution rates

## Current State Analysis

### What Exists
- React + TypeScript application with Supabase integration
- Basic contributor visualization
- Database connection and authentication setup

### What's Missing
- Event collection and processing pipeline
- Maintainer detection algorithm
- Historical data storage
- Real-time role classification
- Self-selection rate calculations

## Implementation Plan

### Phase 1: Foundation (HIGH PRIORITY) ✅
**Timeline: Week 1**
**Status: COMPLETED**

#### Database Schema
- [x] Create contributor_roles table with confidence scoring
- [x] Set up github_events_cache table with partitioning
- [x] Add indexes for performance optimization
- [x] Enable Row Level Security (RLS)
- [x] Create monthly partitions for events

#### Supabase Edge Functions
- [x] Set up webhook handler function structure
- [x] Implement HMAC signature verification
- [x] Create scheduled sync function skeleton
- [x] Configure pg_cron for automated tasks
- [x] Set up error handling and logging

**Acceptance Criteria:**
- Database tables created and indexed ✅
- Edge functions deployed and accessible ✅
- Webhook endpoint responds to GitHub events ✅
- Scheduled jobs configured ✅

**Implementation Summary:**
- Created comprehensive database schema with partitioning for scalability
- Implemented webhook handler with HMAC verification and event processing
- Built scheduled sync function for periodic GitHub API polling
- Configured pg_cron for automated maintenance tasks
- Added setup documentation in `docs/setup/phase1-setup.md`

### Phase 2: Core Processing (HIGH PRIORITY) ✅
**Timeline: Week 2**
**Status: COMPLETED**

#### Event Detection Algorithm
- [x] Implement PushEvent analysis for write access detection
- [x] Add PullRequestEvent merge detection
- [x] Process administrative actions
- [x] Create confidence scoring formula
- [x] Build privileged event classification

#### Data Processing
- [x] Implement event deduplication using event_id
- [x] Add batch processing for efficiency
- [x] Create pattern detection for merge permissions
- [x] Build temporal consistency tracking
- [x] Filter bot accounts from analysis

**Acceptance Criteria:**
- Events correctly classified as privileged/non-privileged ✅
- Confidence scores calculated accurately ✅
- No duplicate events in database ✅
- Bot accounts properly filtered ✅

**Implementation Summary:**
- Created comprehensive event detection system with 10+ event types
- Implemented confidence scoring with weighted factors (privileged events 40%, activity patterns 35%, temporal consistency 25%)
- Built pattern detection for maintainer behaviors (regular merger, release manager, active triager, direct committer)
- Added bot filtering with common bot patterns
- Created self-selection rate analytics with materialized views
- Updated Edge Functions to use shared utilities for consistency

### Phase 3: Integration (MEDIUM PRIORITY) ✅
**Timeline: Week 3**
**Status: COMPLETED**

#### React App Integration
- [x] Create useContributorRoles hook
- [x] Add real-time subscription support
- [x] Update ContributorCard component with role badges
- [x] Implement confidence score display
- [x] Add internal/external contributor indicators

#### Data Synchronization
- [x] Implement GitHub API backfill for historical data
- [x] Create rate limit management
- [x] Add retry logic with exponential backoff
- [x] Set up event stream processing
- [x] Configure real-time updates via Supabase

**Acceptance Criteria:**
- UI displays maintainer roles with confidence ✅
- Real-time updates when roles change ✅
- Historical data successfully imported ✅
- Rate limits properly managed ✅

**Implementation Summary:**
- Created comprehensive React hooks with real-time subscriptions
- Built enhanced ContributorCard component with role badges (Owner, Maintainer, Bot indicators)
- Implemented rate limit management with local storage and exponential backoff
- Created backfill Edge Function for importing up to 90 days of historical data
- Added self-selection rate component with trend analysis
- Integrated confidence score displays with color coding

### Phase 4: Optimization & Monitoring (MEDIUM PRIORITY)
**Timeline: Week 4**

#### Performance & Reliability
- [ ] Add caching layer for API calls
- [ ] Implement circuit breaker pattern
- [ ] Create monitoring dashboard
- [ ] Add distributed tracing
- [ ] Set up alerting for failures

#### Analytics & Reporting
- [ ] Build self-selection rate calculation
- [ ] Create contribution statistics views
- [ ] Add trend analysis over time
- [ ] Implement accuracy tracking
- [ ] Generate team insights dashboard

**Acceptance Criteria:**
- System handles 1000+ events/minute
- 99.9% uptime for webhook processing
- Dashboard shows real-time metrics
- Accurate self-selection rates calculated

## Technical Guidelines

### Architecture Decisions
- Use Supabase Edge Functions instead of separate microservice
- Implement event-driven architecture with webhooks
- Store raw events in JSONB for flexibility
- Use materialized views for performance

### Code Patterns
```typescript
// Event Processing Pattern
const processPrivilegedEvent = async (event: GitHubEvent) => {
  const confidence = calculateConfidence(event)
  await updateContributorRole(event.actor, confidence)
}

// Confidence Calculation
const calculateConfidence = (events: PrivilegedEvent[]) => {
  return (privilegedWeight * 0.4) + 
         (activityWeight * 0.35) + 
         (temporalWeight * 0.25)
}
```

### Security Requirements
- Store webhook secrets in Supabase Vault
- Use service role keys only in Edge Functions
- Implement request signing for internal calls
- Rotate secrets quarterly

### Performance Targets
- < 100ms webhook response time
- < 5s for role classification update
- < 1s for UI updates
- Support 100k+ events/day

## Risk Mitigation

### Technical Risks
- **GitHub API rate limits**: Implement intelligent caching and batching
- **Data volume growth**: Use table partitioning and archival strategy
- **Webhook reliability**: Add retry mechanism and dead letter queue
- **False positive detection**: Use multi-signal approach and manual review

### Operational Risks
- **Monitoring gaps**: Implement comprehensive observability
- **Cost overruns**: Monitor Edge Function invocations and database storage
- **Data privacy**: Ensure GDPR compliance for user data

## Future Enhancements

### Phase 5: Advanced Features (LOW PRIORITY)
- Machine learning model for improved accuracy
- Cross-repository maintainer detection
- Organization-level analytics
- API for external integrations
- Advanced visualization options

## Implementation Notes

### Key Dependencies
- Supabase Edge Functions
- GitHub Webhooks API
- PostgreSQL with pg_cron
- React with real-time subscriptions

### Testing Strategy
- Unit tests for confidence algorithm
- Integration tests for webhook processing
- Load testing for scalability
- Accuracy testing with known repositories

### Documentation Requirements
- API documentation for Edge Functions
- User guide for interpreting confidence scores
- Admin guide for monitoring and maintenance
- Architecture decision records (ADRs)