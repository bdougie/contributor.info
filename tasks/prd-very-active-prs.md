# Product Requirements Document: Very Active PRs Feature with Smart Fallbacks

## Project Overview

### Objective
Transform the "Recent PR Activity" section into an intelligent "Very Active PRs" feature that surfaces the most engaging pull requests based on activity metrics (comments, reviews, commits) with robust fallback strategies for repositories with varying data availability.

### Background
**Current State:**
- Static "Recent PR Activity" shows chronological list of PR events
- Basic filtering by activity type (opened, closed, merged, reviewed, commented)
- Limited value for identifying truly important or engaging PRs
- No differentiation between low-engagement and high-engagement PRs

**Target State:**
- Intelligent ranking system highlighting PRs with exceptional engagement
- Dynamic titles and descriptions based on data availability
- Progressive enhancement from basic chronological view to sophisticated activity scoring
- Always functional regardless of repository data richness

### Success Metrics
- **User Engagement**: Increased click-through rates on displayed PRs
- **Data Utilization**: Effective use of available comment/review data
- **Fallback Reliability**: 100% uptime across all repository types
- **User Understanding**: Clear comprehension of ranking methodology

## Current State Analysis

### Existing Implementation
**File: `contributions-wrapper.tsx`**
- Displays "Recent PR Activity" with basic chronological sorting
- Uses `usePRActivity` hook for data processing
- Shows limited activity items (10) with "See more" link
- Fixed title regardless of data quality

**File: `use-pr-activity.ts`**
- Processes PR data into chronological activity feed
- Handles comments and reviews data when available
- Bot detection and filtering capabilities
- No activity-based ranking or scoring

**Data Sources Available:**
- PR comments array with user info and timestamps
- Reviews array with state and submission times
- Basic PR metadata (additions, deletions, creation dates)
- Commit information (limited availability)

### Gaps Identified
1. **No activity scoring algorithm** for identifying high-engagement PRs
2. **Fixed presentation** regardless of data richness
3. **No fallback strategy** for repositories with sparse data
4. **Limited insights** into what makes PRs "interesting"

## Implementation Plan

### Phase 1: Activity Scoring Engine (HIGH Priority)
**Duration**: 2-3 days

**Deliverables:**
1. **New Hook: `useVeryActivePRs.ts`**
   - Activity scoring algorithm based on weighted metrics
   - Percentile ranking within repository context
   - Data quality assessment logic
   - Fallback tier determination

2. **New Types: Activity Scoring**
   ```typescript
   interface VeryActivePR extends PullRequest {
     activityScore: number;
     activityRank: number;
     engagementMetrics: ActivityMetrics;
     fallbackTier: 'very-active' | 'high-impact' | 'notable' | 'recent';
   }
   
   interface ActivityMetrics {
     commentCount: number;
     reviewCount: number;
     commitCount?: number;
     engagementWindow: string;
   }
   ```

**Algorithm Design:**
```
Activity Score = (comments × 1.0) + (reviews × 1.5) + (commits × 0.5) + recencyBoost
Percentile Ranking = Position within repository's PR activity distribution
Fallback Tier = Based on data availability and repository activity levels
```

**Acceptance Criteria:**
- ✅ Scores all PRs with available activity data
- ✅ Handles missing/incomplete data gracefully
- ✅ Determines appropriate fallback tier automatically
- ✅ Maintains consistent performance with large datasets

### Phase 2: Smart Fallback System (HIGH Priority)
**Duration**: 1-2 days

**Deliverables:**
1. **Tiered Display Logic**
   - **Tier 1 - "Very Active PRs"**: 10+ PRs with rich activity data, show top 20%
   - **Tier 2 - "High Impact PRs"**: 5+ PRs with moderate data, show above-average
   - **Tier 3 - "Notable PRs"**: 3+ PRs with basic data, show any with engagement
   - **Tier 4 - "Recent Activity"**: Fallback to chronological view

2. **Dynamic Content System**
   - Context-aware titles and descriptions
   - Appropriate messaging for each tier
   - Smooth transitions between fallback states

**Data Quality Thresholds:**
```
Tier 1: avgCommentsPerPR >= 2 && totalPRsWithActivity >= 10
Tier 2: avgCommentsPerPR >= 1 && totalPRsWithActivity >= 5  
Tier 3: anyPRsWithActivity >= 3
Tier 4: fallback (always available)
```

**Acceptance Criteria:**
- ✅ Automatically selects appropriate tier based on data
- ✅ Provides value at every fallback level
- ✅ Maintains consistent UI/UX across tiers
- ✅ Clear user communication about ranking methodology

### Phase 3: Enhanced UI Components (MEDIUM Priority)
**Duration**: 2 days

**Deliverables:**
1. **Activity Indicators**
   - Comment count badges
   - Review status indicators
   - Engagement level visual cues
   - Conditional display based on data availability

2. **Updated Contributions Wrapper**
   - Dynamic titles based on fallback tier
   - Context-appropriate descriptions
   - Enhanced "See more" link with tier-specific messaging
   - Tooltip explanations for ranking system

3. **Visual Enhancements**
   - Highlight highly active PRs with subtle styling
   - Progressive disclosure of activity metrics
   - Loading states for score calculation
   - Empty states with helpful explanations

**Acceptance Criteria:**
- ✅ Clear visual hierarchy emphasizing most active PRs
- ✅ Helpful context without overwhelming interface
- ✅ Accessible tooltips and explanations
- ✅ Responsive design across screen sizes

### Phase 4: Testing & Documentation (MEDIUM Priority)
**Duration**: 1 day

**Deliverables:**
1. **Comprehensive Test Coverage**
   - Unit tests for scoring algorithm
   - Integration tests for fallback logic
   - Component tests for UI enhancements
   - Edge case handling (empty repositories, single PRs)

2. **Updated Documentation**
   - Algorithm explanation in code comments
   - User-facing help text for feature
   - Storybook examples for different tiers

**Acceptance Criteria:**
- ✅ 90%+ test coverage for new functionality
- ✅ All fallback scenarios tested
- ✅ Performance benchmarks established
- ✅ Clear documentation for future maintenance

## Technical Guidelines

### Architecture Decisions
1. **Hook-based Architecture**: Maintain existing pattern with new `useVeryActivePRs` hook
2. **Backward Compatibility**: Ensure existing PR activity functionality continues working
3. **Performance**: Lazy calculation of scores, memoization where appropriate
4. **Error Boundaries**: Graceful degradation on scoring failures

### Data Processing Strategy
1. **Client-side Scoring**: Calculate activity scores in browser for responsiveness
2. **Caching Strategy**: Memoize scores to avoid recalculation on re-renders
3. **Incremental Enhancement**: Start with basic metrics, expand over time

## Risk Mitigation

### Technical Risks
- **Performance Impact**: Mitigate with memoization and lazy evaluation
- **Data Inconsistency**: Implement robust null/undefined handling
- **Algorithm Complexity**: Start simple, iterate based on user feedback

### User Experience Risks
- **Confusion About Rankings**: Clear explanations and tooltips
- **Inconsistent Behavior**: Comprehensive testing across repository types
- **Feature Regression**: Maintain fallback to existing functionality

## Success Metrics & KPIs

### Quantitative Metrics
- **Feature Adoption**: % of users interacting with Very Active PRs section
- **Click-through Rate**: Engagement with displayed PRs vs. previous implementation
- **Performance**: Rendering time for activity scoring (< 100ms target)
- **Reliability**: Uptime across different repository configurations

### Qualitative Metrics
- **User Comprehension**: Feedback on ranking clarity
- **Value Perception**: User reports of finding relevant PRs more easily
- **Developer Experience**: Code maintainability and extensibility

## Progress Tracking

### Phase 1: Activity Scoring Engine ⏳
- [ ] Create `useVeryActivePRs.ts` hook
- [ ] Implement activity scoring algorithm
- [ ] Add new TypeScript interfaces
- [ ] Build data quality assessment logic
- [ ] Test scoring with various repository data

### Phase 2: Smart Fallback System ⏳
- [ ] Implement tiered display logic
- [ ] Create dynamic title/description system
- [ ] Build data quality threshold detection
- [ ] Test all fallback scenarios
- [ ] Ensure smooth tier transitions

### Phase 3: Enhanced UI Components ⏳
- [ ] Add activity indicator badges
- [ ] Update contributions wrapper component
- [ ] Implement visual enhancements
- [ ] Add tooltips and explanations
- [ ] Test responsive design

### Phase 4: Testing & Documentation ⏳
- [ ] Write comprehensive unit tests
- [ ] Add integration tests
- [ ] Update component tests
- [ ] Document algorithm and features
- [ ] Performance optimization

This PRD provides a complete roadmap for implementing the Very Active PRs feature with robust fallback strategies, ensuring value delivery regardless of repository data availability.