# PRD: Smart Data Fetching with Repository Size Classification

## Project Overview

### Objective
Transform the data fetching system to make all repositories usable, regardless of size, by implementing intelligent size-based fetching strategies and progressive data loading.

### Background
Currently, large repositories like kubernetes/kubernetes are "protected" from resource-intensive operations, making them unusable. This protection is hardcoded and blocks users from accessing data for the most interesting projects.

### Success Metrics
- 100% of repositories show some data within 3 seconds
- 0% of repositories show "protected" or blocking messages
- 90% reduction in resource exhaustion errors
- Background capture success rate >80% for all repository sizes

## Current State Analysis

### Problems
1. Hardcoded protection list blocks large repositories entirely
2. No size classification system for repositories
3. All-or-nothing data fetching approach
4. GitHub Actions failing with 100% error rate
5. No progressive data loading UX

### Existing Code
- `src/lib/supabase-pr-data.ts`: Contains hardcoded large repo protection
- `tracked_repositories` table: Missing size and priority columns
- Progressive capture system exists but isn't well integrated

## Implementation Plan

### Phase 1: Database Schema Enhancement (Priority: HIGH)
**Timeline**: 1-2 days

#### Tasks
- [ ] Create migration to add columns to `tracked_repositories`:
  - `size` enum ('small', 'medium', 'large', 'xl') 
  - `priority` enum ('high', 'medium', 'low') default 'low'
  - `metrics` jsonb for storing repo statistics
  - `size_calculated_at` timestamp
- [ ] Update Supabase types
- [ ] Add RLS policies for new columns
- [ ] Create indexes for efficient size-based queries

#### Acceptance Criteria
- Migration runs successfully
- New columns accessible via Supabase client
- No breaking changes to existing functionality

### Phase 2: Repository Size Classification Service (Priority: HIGH)
**Timeline**: 2-3 days

#### Tasks
- [ ] Create `RepositorySizeClassifier` service:
  ```typescript
  interface RepoMetrics {
    stars: number;
    forks: number;
    monthlyPRs: number;
    monthlyCommits: number;
    activeContributors: number;
  }
  ```
- [ ] Implement size calculation logic:
  - Small: <1k stars, <100 PRs/month
  - Medium: 1k-10k stars, 100-500 PRs/month
  - Large: 10k-50k stars, 500-2000 PRs/month
  - XL: >50k stars, >2000 PRs/month
- [ ] Add LLM-powered classification for edge cases
- [ ] Create background job to classify unclassified repos
- [ ] Add size classification on repository track

#### Acceptance Criteria
- Service correctly classifies test repositories
- Classification runs automatically on new repos
- Metrics stored in database for future reference

### Phase 3: Smart Data Fetching Logic (Priority: HIGH)
**Timeline**: 3-4 days

#### Tasks
- [ ] Refactor `getSupabasePRData` to remove hardcoded protection
- [ ] Implement size-based fetching strategy:
  ```typescript
  interface FetchStrategy {
    small: { days: 30, immediate: true },
    medium: { days: 14, immediate: true },
    large: { days: 7, immediate: true, chunked: true },
    xl: { days: 3, immediate: true, chunked: true, rateLimit: true }
  }
  ```
- [ ] Add logic for "no cached data" scenario:
  - Fetch limited live data based on size
  - Always trigger background capture
  - Return partial data immediately
- [ ] Implement progressive data merging
- [ ] Add telemetry for fetch performance

#### Acceptance Criteria
- All repositories return some data immediately
- No "protected repository" messages
- Background captures triggered appropriately
- Performance metrics show improvement

### Phase 4: Background Capture Optimization (Priority: MEDIUM)
**Timeline**: 2-3 days

#### Tasks
- [ ] Fix GitHub Actions workflows (404 errors)
- [ ] Implement capture queue prioritization:
  - High priority + Small: Immediate full capture
  - High priority + Large: Chunked capture
  - Low priority: Batch processing
- [ ] Add job status reporting from workflows
- [ ] Create monitoring dashboard for capture health
- [ ] Implement auto-retry for failed captures

#### Acceptance Criteria
- GitHub Actions success rate >80%
- High priority repos captured within 10 minutes
- Failed jobs automatically retried
- Clear visibility into capture status

### Phase 5: User Experience Enhancements (Priority: MEDIUM)
**Timeline**: 2 days

#### Tasks
- [ ] Add repository size badges (S/M/L/XL)
- [ ] Implement data freshness indicators:
  - Green: <1 day old
  - Yellow: 1-7 days old  
  - Red: >7 days old
- [ ] Add loading states during background fetch
- [ ] Create "Load more history" button for partial data
- [ ] Show capture progress for repos being processed
- [ ] Add manual refresh with size-appropriate limits

#### Acceptance Criteria
- Users can see repository size at a glance
- Data freshness is clearly communicated
- Loading states don't block UI interaction
- Manual refresh respects size limits

### Phase 6: Example Repository Updates (Priority: LOW)
**Timeline**: 1 day

#### Tasks
- [ ] Remove kubernetes/kubernetes from examples
- [ ] Set all example repos to high priority
- [ ] Ensure example repos have fresh data
- [ ] Add size diversity to examples (small/medium/large)

#### Acceptance Criteria
- All example repos load quickly with data
- Examples showcase different repository sizes
- No XL repos in default examples

## Technical Architecture

### Data Flow
1. User requests repository data
2. Check cached data availability
3. If no cache: fetch size-appropriate live data
4. Return available data immediately  
5. Trigger background capture for full history
6. Progressively update UI as data arrives

### Size-Based Strategies
```typescript
const fetchStrategies = {
  small: {
    liveDataDays: 30,
    captureProcessor: 'inngest',
    chunkSize: null
  },
  medium: {
    liveDataDays: 14,
    captureProcessor: 'hybrid',
    chunkSize: 7
  },
  large: {
    liveDataDays: 7,
    captureProcessor: 'github_actions',
    chunkSize: 7
  },
  xl: {
    liveDataDays: 3,
    captureProcessor: 'github_actions',
    chunkSize: 3,
    rateLimit: 'aggressive'
  }
}
```

## Risk Mitigation

### Risks
1. **API Rate Limits**: XL repos could still hit limits
   - Mitigation: Aggressive rate limiting, caching, fallbacks

2. **Classification Accuracy**: Size might be incorrectly calculated
   - Mitigation: Monthly recalculation, manual override option

3. **Performance Impact**: More complex logic could slow down
   - Mitigation: Efficient queries, caching, monitoring

## Rollout Strategy

1. **Phase 1-2**: Deploy schema and classification (no user impact)
2. **Phase 3**: Test with internal team first
3. **Phase 4-5**: Gradual rollout (10% → 50% → 100%)
4. **Phase 6**: Update examples after system is stable

## Success Criteria

- All repositories accessible with some data
- No resource exhaustion errors
- Improved user satisfaction metrics
- Reduced support tickets about "missing data"

## Future Enhancements

- GHArchive integration for historical data
- Predictive pre-fetching for trending repos
- User-configurable fetch preferences
- WebSocket updates for real-time data