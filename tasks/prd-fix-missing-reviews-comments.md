# PRD: Fix Missing Reviews and Comments in Feed

## Project Overview

### Objective
Fix the issue where PR reviews and comments are not appearing in the repository feed, even though the UI shows toggles for "Reviewed" and "Commented" activity types.

### Background
- The feed UI has toggles for showing reviews and comments
- Database queries show that continuedev/continue has 692 PRs but only 19 reviews and 34 comments
- Recent PRs (last 30 days) all show 0 reviews and 0 comments
- The feed implementation expects review/comment data but it's not being populated

### Success Metrics
- Reviews and comments appear in the feed when toggled on
- Database contains accurate review and comment data for all tracked repositories
- Background jobs successfully capture and update review/comment data

## Current State Analysis

### What's Working
- PR creation, merge, and close activities display correctly
- Database schema supports reviews and comments with proper relationships
- Frontend components are ready to display review/comment activities
- Sync Contributor Stats workflow updates monthly rankings

### What's Broken
- Reviews and comments are not being captured for most repositories
- The feed shows empty results when "Reviewed" or "Commented" toggles are enabled
- Database has minimal review/comment data (only 19 reviews out of 692 PRs)

### Root Cause
The background data capture process is not fetching or storing review and comment data properly. The GitHub API calls may not include review/comment expansion, or the data ingestion process may be skipping this data.

## Implementation Plan

### Phase 1: Investigate Data Collection (HIGH PRIORITY)
- [ ] Check if GitHub API calls include review/comment data
- [ ] Verify Inngest background jobs are processing reviews/comments
- [ ] Check if the sync process is properly storing review/comment data
- [ ] Identify specific failure points in the data pipeline

### Phase 2: Fix Data Collection Process (HIGH PRIORITY)
- [ ] Update GitHub API calls to include reviews and comments
- [ ] Ensure background processors fetch and store review data
- [ ] Add proper error handling and logging for review/comment collection
- [ ] Test with a small repository first

### Phase 3: Backfill Existing Data (MEDIUM PRIORITY)
- [ ] Create a script to backfill reviews/comments for existing PRs
- [ ] Run backfill for high-priority repositories first
- [ ] Monitor database growth and performance
- [ ] Add progress tracking for backfill operations

### Phase 4: Monitoring and Validation (MEDIUM PRIORITY)
- [ ] Add metrics for review/comment collection success rate
- [ ] Create alerts for data collection failures
- [ ] Validate feed displays reviews/comments correctly
- [ ] Document the fix and update troubleshooting guides

## Technical Guidelines

### Architecture Decisions
- Leverage existing GitHub GraphQL API infrastructure
- Use batch processing to minimize API calls
- Implement incremental updates rather than full re-fetches
- Respect GitHub API rate limits

### Data Flow
1. Background job fetches PR data including reviews/comments
2. Data is normalized and stored in Supabase
3. Feed queries include review/comment joins
4. Frontend displays activities based on user toggles

### Performance Considerations
- Reviews and comments can significantly increase data volume
- Implement pagination for large PR review histories
- Consider caching strategies for frequently accessed repos

## Acceptance Criteria

### Phase 1
- Clear understanding of why reviews/comments are missing
- Documentation of current data flow and failure points
- Identification of required API changes

### Phase 2
- Reviews and comments are successfully fetched from GitHub API
- Data is properly stored in the database
- No regression in existing PR data collection

### Phase 3
- Historical reviews/comments are backfilled for active repositories
- Database performance remains acceptable
- Progress tracking shows completion status

### Phase 4
- Monitoring dashboard shows healthy review/comment collection
- Feed correctly displays all activity types
- Documentation is updated with new data flow

## Risk Mitigation
- Test fixes on small repositories before large ones
- Implement rate limit handling to avoid API exhaustion
- Add circuit breakers for failing data collections
- Maintain backwards compatibility with existing data