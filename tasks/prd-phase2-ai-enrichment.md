# PRD: Phase 2 - AI Contributor Enrichment

**Issue**: #803 (Phase 2)
**Branch**: `claude/issue-803-phase2-ai-enrichment`
**Status**: In Progress
**Start Date**: 2025-10-18
**Estimated Completion**: 18 days (3.5 weeks)

## Project Overview

Implement AI-powered contributor intelligence through topic clustering, contribution trend analysis, and engagement quality scoring. This builds on Phase 1's foundation (✅ embeddings, discussions, AI summaries) to provide deep insights into contributor personas, expertise evolution, and engagement quality.

### Background

Phase 1 successfully implemented:
- ✅ GitHub Discussions collection
- ✅ 384-dimension embeddings for issues, PRs, and discussions
- ✅ AI-generated contributor summaries
- ✅ Cross-entity similarity search

Phase 2 extends this foundation to add intelligent pattern recognition and quality assessment.

### Success Metrics

**Functionality:**
- Topic clustering identifies 5-10 meaningful clusters per workspace
- Quality scores accurately reflect contribution value (validated against manual assessment)
- Trend detection predicts future focus areas with 70%+ accuracy
- Persona detection matches manual classification 80%+ of time

**Performance:**
- Analytics calculation < 2s per contributor
- Background jobs process 1000 contributors/minute
- UI renders analytics in < 500ms
- No impact on existing page load times

**User Experience:**
- Profile modal shows insights immediately (cached data)
- Topic clusters help discover similar contributors
- Quality scores help prioritize engagement
- Trends reveal contributor evolution over time

## Current State Analysis

### What Exists

1. **Embedding Infrastructure** ✅
   - 384-dimension vectors for issues, PRs, discussions
   - Cross-entity similarity search
   - Standardized dimensions (migration: `20251018000001_standardize_embedding_dimensions.sql`)

2. **LLM Service** ✅
   - PostHog tracking for observability
   - Caching layer for efficiency
   - Contributor summary generation
   - Discussion summary generation

3. **Activity Fetching** ✅
   - `useContributorActivity` hook fetches PRs, issues, discussions
   - Includes discussion participation data
   - Repository-scoped queries

4. **Trend Analysis** ✅
   - Repository-level trend metrics exist (`trends-metrics.ts`)
   - 7-day and 30-day comparison windows
   - Velocity and engagement calculations

### What Needs Improvement

1. **No Topic Clustering** ❌
   - Cannot group contributors by expertise
   - Cannot identify trending topics
   - No automatic persona detection

2. **No Contribution Trends** ❌
   - Cannot track contributor evolution
   - Cannot predict future focus areas
   - No shift detection (e.g., frontend → backend)

3. **No Quality Scoring** ❌
   - All contributions weighted equally
   - No way to identify high-value contributors
   - No recognition of mentor/helper behavior

4. **No Historical Tracking** ❌
   - Current values only, no time-series data
   - Cannot analyze patterns over time
   - No snapshot comparisons

## Implementation Plan

### Phase 1: Database Schema & Infrastructure (✅ HIGH PRIORITY - Days 1-2)

#### 1.1 Database Migration ✅

**File**: `supabase/migrations/20251018000002_contributor_analytics_and_enrichment.sql`

**Tasks**:
- [ ] Create `contributor_analytics` table for time-series data
- [ ] Add computed columns to `contributors` table
- [ ] Create indexes for performance (GIN index on topics array)
- [ ] Add database functions for clustering and scoring
- [ ] Validate migration with test data

**Schema Design**:

```sql
-- Time-series analytics table
contributor_analytics:
  - snapshot_date (daily/weekly snapshots)
  - primary_topics TEXT[] (top 3-5 topics)
  - topic_embedding VECTOR(384) (aggregated)
  - contribution_velocity JSONB ({7d: 5, 30d: 20})
  - topic_shifts JSONB (topic changes over time)
  - quality_score FLOAT (0-100 composite)
  - quality_breakdown (discussion, review, issue, mentor scores)

-- Current values in contributors table
contributors:
  + current_topics TEXT[]
  + quality_score FLOAT
  + engagement_trend TEXT (rising_star, steady, declining)
  + last_analytics_update TIMESTAMPTZ
```

**Acceptance Criteria**:
- ✅ Migration runs without errors on local Supabase
- ✅ All indexes created successfully
- ✅ Foreign key constraints validated
- ✅ Functions return expected output with test data

---

### Phase 2: Topic Clustering (✅ HIGH PRIORITY - Days 3-5)

#### 2.1 Topic Clustering Service

**File**: `src/services/topic-clustering.ts`

**Tasks**:
- [ ] Implement K-means clustering on embeddings
- [ ] Create content topic clustering (cluster issues/PRs by technical topics)
- [ ] Create contributor clustering (group people by expertise)
- [ ] Generate topic labels using LLM
- [ ] Calculate topic confidence scores
- [ ] Write unit tests

**Key Functions**:

```typescript
// Cluster contributions by content similarity
async function clusterContributionsByTopic(
  workspaceId: string,
  k: number = 7
): Promise<TopicCluster[]>

// Cluster contributors by expertise/interests
async function clusterContributorsByExpertise(
  workspaceId: string,
  k: number = 5
): Promise<ContributorCluster[]>

// Generate human-readable topic labels
async function generateTopicLabels(
  cluster: EmbeddingCluster,
  sampleTitles: string[]
): Promise<string[]>

// Calculate topic confidence
function calculateTopicConfidence(
  contributorEmbedding: number[],
  topicEmbedding: number[]
): number
```

**Algorithm**:
1. Fetch all embeddings for workspace items (issues, PRs, discussions)
2. Run K-means clustering (k=5-10 clusters)
3. Calculate cluster centroids (topic embeddings)
4. Extract sample titles from each cluster
5. Use LLM to generate topic labels from samples
6. Assign contributors to topics based on their contribution embeddings

#### 2.2 Extend LLM Service for Persona Detection

**File**: `src/lib/llm/llm-service.ts`

**Tasks**:
- [ ] Add `generateContributorPersona` method
- [ ] Create persona detection prompt
- [ ] Implement persona confidence scoring
- [ ] Cache persona results (24hr TTL)
- [ ] Write unit tests

**Persona Types**:
- Enterprise users (SSO, proxies, compliance keywords)
- Security-focused (vulnerability reports, auth discussions)
- Performance-oriented (optimization PRs, benchmarks)
- Documentation contributors
- Bug hunters
- Feature requesters
- Community helpers (answering questions, mentoring)

**Prompt Template**:

```
Analyze this contributor's activity and identify their persona:

Recent Activity:
- PRs: [titles and topics]
- Issues: [titles and keywords]
- Discussions: [participation type and topics]

Primary Topics: {topics}
Quality Scores: {quality breakdown}

Identify the contributor's:
1. Primary persona (1-2 types from list above)
2. Expertise areas (specific technical topics)
3. Contribution style (code-focused, discussion-focused, mixed)
4. Engagement pattern (mentor, learner, reporter, builder)

Output format: JSON with persona, expertise[], style, pattern
```

#### 2.3 Type Definitions

**File**: `src/lib/llm/contributor-enrichment-types.ts`

```typescript
export interface TopicCluster {
  id: string;
  label: string;
  keywords: string[];
  contributorCount: number;
  topContributors: string[];
  centroid: number[]; // Embedding vector
  confidence: number;
}

export interface ContributorPersona {
  type: PersonaType;
  confidence: number;
  expertise: string[];
  contributionStyle: 'code' | 'discussion' | 'mixed';
  engagementPattern: 'mentor' | 'learner' | 'reporter' | 'builder';
}

export type PersonaType =
  | 'enterprise'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'bug_hunter'
  | 'feature_requester'
  | 'community_helper';
```

**Acceptance Criteria**:
- ✅ Topic clustering produces meaningful, interpretable clusters
- ✅ LLM-generated labels match cluster content
- ✅ Persona detection accuracy > 80% (validated manually on sample)
- ✅ Clustering completes in < 5s for 1000 contributors
- ✅ All tests pass

---

### Phase 3: Contribution Trend Analysis (✅ HIGH PRIORITY - Days 6-8)

#### 3.1 Trend Analysis Service

**File**: `src/services/contribution-trends.ts`

**Tasks**:
- [ ] Implement 7-day and 30-day velocity tracking
- [ ] Create topic shift detection
- [ ] Build engagement pattern analysis
- [ ] Generate predictive focus areas
- [ ] Write unit tests

**Key Functions**:

```typescript
async function analyzeContributorTrends(
  contributorId: string,
  workspaceId: string
): Promise<TrendAnalysis>

interface TrendAnalysis {
  velocityTrend: 'accelerating' | 'steady' | 'declining';
  velocityData: {
    current7d: number;
    previous7d: number;
    current30d: number;
    previous30d: number;
  };
  topicShifts: TopicShift[];
  engagementPattern: 'increasing' | 'stable' | 'decreasing';
  predictedFocus: string[];
  confidenceScore: number;
}

interface TopicShift {
  from: string[];
  to: string[];
  timeframe: '7d' | '30d';
  significance: 'major' | 'minor';
}
```

**Metrics to Track**:
1. **Velocity Trend**
   - PRs/issues per week (7-day window)
   - Compare current vs. previous week
   - Calculate acceleration/deceleration

2. **Topic Evolution**
   - Compare topics in current vs. previous period
   - Detect shifts (frontend → backend, code → docs)
   - Measure topic stability

3. **Engagement Shifts**
   - Track PR count vs. issue count vs. discussion participation
   - Detect shift from code contributions to community help
   - Monitor response time trends

4. **Predictive Focus**
   - Based on recent topic shifts
   - Weighted by contribution frequency
   - LLM-enhanced prediction

#### 3.2 Extend Trends Metrics

**File**: `src/lib/insights/trends-metrics.ts`

**Tasks**:
- [ ] Add `calculateContributorTrendMetrics` function
- [ ] Reuse existing time-window logic
- [ ] Add contributor-specific calculations
- [ ] Write unit tests

**Reuse Pattern**:

```typescript
// Existing: Repository trends
export async function calculateTrendMetrics(
  owner: string,
  repo: string,
  timeRange: string
): Promise<TrendData[]>

// New: Contributor trends
export async function calculateContributorTrendMetrics(
  contributorId: string,
  workspaceId: string,
  timeRange: '7d' | '30d'
): Promise<ContributorTrendData[]>
```

**Acceptance Criteria**:
- ✅ Trend detection identifies meaningful shifts
- ✅ Velocity calculations accurate (validated against manual count)
- ✅ Topic shift detection > 70% accuracy
- ✅ Predictive focus relevant to recent activity
- ✅ All tests pass

---

### Phase 4: Engagement Quality Scoring (✅ HIGH PRIORITY - Days 9-11)

#### 4.1 Quality Scoring Service

**File**: `src/services/quality-scoring.ts`

**Tasks**:
- [ ] Implement discussion impact scoring
- [ ] Implement code review depth scoring
- [ ] Implement issue quality scoring
- [ ] Implement mentor score calculation
- [ ] Create composite quality score
- [ ] Write unit tests

**Scoring Formulas**:

**Discussion Impact (0-100)**:
```typescript
function calculateDiscussionImpact(discussions: DiscussionParticipation[]): number {
  let score = 0;

  for (const d of discussions) {
    if (d.isAnswered && d.isAuthor) score += 10; // Answered own question
    if (d.isAnswered && !d.isAuthor) score += 15; // Provided answer
    score += Math.min(d.reactions * 2, 10); // Up to 10 points for reactions
    score += Math.min(d.commentLength / 100, 5); // Detail bonus
  }

  return Math.min(score / discussions.length * 10, 100);
}
```

**Code Review Depth (0-100)**:
```typescript
function calculateCodeReviewDepth(reviews: Review[]): number {
  let score = 0;

  for (const r of reviews) {
    if (r.state === 'APPROVED' && r.body.length < 20) score += 1; // Simple LGTM
    if (r.body.length > 50) score += 5; // Detailed feedback
    if (r.comments.length > 0) score += 5; // Inline comments
    if (hasSecurityKeywords(r.body)) score += 10; // Security concerns
    if (hasPerformanceKeywords(r.body)) score += 10; // Performance concerns
    if (r.body.includes('```')) score += 5; // Code suggestions
  }

  return Math.min(score / reviews.length * 10, 100);
}
```

**Issue Quality (0-100)**:
```typescript
function calculateIssueQuality(issues: Issue[]): number {
  let score = 0;

  for (const i of issues) {
    if (hasReproductionSteps(i.body)) score += 10;
    if (hasCodeExample(i.body)) score += 5;
    if (i.labels.length > 0) score += 3;
    if (i.body.length > 200) score += 5; // Clear description
    if (hasExpectedActual(i.body)) score += 5; // Expected vs actual
  }

  return Math.min(score / issues.length * 10, 100);
}
```

**Mentor Score (0-100)**:
```typescript
function calculateMentorScore(activity: ContributorActivity[]): number {
  let score = 0;

  // Answering others' questions
  const answers = activity.filter(a =>
    a.type === 'discussion' &&
    !a.is_discussion_author &&
    a.is_answered
  );
  score += answers.length * 5;

  // Helpful comments
  const helpfulComments = activity.filter(a =>
    a.type === 'comment' &&
    hasHelpfulKeywords(a.body)
  );
  score += helpfulComments.length * 3;

  // Documentation improvements
  const docImprovements = activity.filter(a =>
    a.type === 'pr' &&
    a.title.toLowerCase().includes('doc')
  );
  score += docImprovements.length * 3;

  return Math.min(score, 100);
}
```

**Composite Score**:
```typescript
function calculateQualityScore(breakdown: QualityBreakdown): number {
  const weights = {
    discussionImpact: 0.25,
    codeReviewDepth: 0.30,
    issueQuality: 0.25,
    mentorScore: 0.20
  };

  return (
    breakdown.discussionImpact * weights.discussionImpact +
    breakdown.codeReviewDepth * weights.codeReviewDepth +
    breakdown.issueQuality * weights.issueQuality +
    breakdown.mentorScore * weights.mentorScore
  );
}
```

#### 4.2 Quality Metrics Component

**File**: `src/components/features/contributor/contributor-quality-metrics.tsx`

**Tasks**:
- [ ] Create quality score badge component
- [ ] Build breakdown visualization (progress bars)
- [ ] Add trend indicator (improving/declining)
- [ ] Highlight top strengths
- [ ] Create Storybook story
- [ ] Write tests

**UI Design**:
```
┌─────────────────────────────────────┐
│ Quality Score: 87/100 ⭐️            │
├─────────────────────────────────────┤
│ Discussion Impact    █████████░ 92  │
│ Code Review Depth    ██████░░░░ 68  │
│ Issue Quality        ████████░░ 85  │
│ Mentor Score         ██████████ 95  │
├─────────────────────────────────────┤
│ 📈 Improving: +12 points this month │
│ ⭐ Top Strength: Community Helper  │
└─────────────────────────────────────┘
```

**Acceptance Criteria**:
- ✅ Quality scores correlate with manual assessment (r > 0.8)
- ✅ Breakdown accurately reflects contribution patterns
- ✅ UI clearly visualizes quality dimensions
- ✅ Performance < 100ms to calculate per contributor
- ✅ All tests pass

---

### Phase 5: UI Integration & Display (✅ MEDIUM PRIORITY - Days 12-14)

#### 5.1 Update Contributor Profile Modal

**File**: `src/components/features/workspace/ContributorProfileModal.tsx`

**Tasks**:
- [ ] Add "Topics & Expertise" tab
- [ ] Add "Trends" tab
- [ ] Enhance "Notes" tab with AI insights
- [ ] Integrate quality metrics display
- [ ] Add loading states for analytics
- [ ] Write tests

**New Tabs**:

1. **Topics & Expertise**
   - Topic badges with confidence scores
   - Detected persona indicators
   - Domain expertise areas
   - Similar contributors link

2. **Trends**
   - 7-day and 30-day velocity charts
   - Topic shift timeline
   - Engagement pattern visualization
   - Predicted focus areas

3. **Notes (Enhanced)**
   - AI-generated persona summary
   - Quality highlights
   - Trend insights
   - Manual notes (existing)

#### 5.2 Create Storybook Stories

**Files**:
- `src/components/features/contributor/contributor-topics.stories.tsx`
- `src/components/features/contributor/contributor-trends.stories.tsx`
- `src/components/features/contributor/contributor-quality.stories.tsx`

**Stories to Create**:
- Default state
- Loading state
- Error state
- Empty state (no data)
- Rich data state

**Acceptance Criteria**:
- ✅ All new tabs render without errors
- ✅ Analytics load asynchronously without blocking modal
- ✅ Loading states provide clear feedback
- ✅ Error states degrade gracefully
- ✅ Storybook stories demonstrate all states
- ✅ All tests pass

---

### Phase 6: Background Processing & Optimization (✅ MEDIUM PRIORITY - Days 15-16)

#### 6.1 Create Inngest Function for Analytics

**File**: `src/inngest/functions/contributor-analytics.ts`

**Tasks**:
- [ ] Create daily quality score calculation job
- [ ] Create weekly topic clustering job
- [ ] Create daily trend snapshot job
- [ ] Implement batch processing
- [ ] Add error handling and retries
- [ ] Monitor job performance

**Job Schedules**:
- **Quality Scores**: Daily at 2 AM UTC
- **Topic Clustering**: Weekly on Sunday 3 AM UTC
- **Trend Snapshots**: Daily at 3 AM UTC

#### 6.2 Optimize Query Performance

**Tasks**:
- [ ] Create materialized view for aggregations
- [ ] Add caching layer for expensive queries
- [ ] Batch process contributor updates
- [ ] Monitor query performance
- [ ] Optimize indexes

**Materialized Views**:
```sql
CREATE MATERIALIZED VIEW workspace_topic_clusters AS
  SELECT workspace_id, topic, COUNT(*) as contributor_count
  FROM contributor_analytics
  GROUP BY workspace_id, topic;

CREATE MATERIALIZED VIEW quality_score_rankings AS
  SELECT workspace_id, contributor_id, quality_score,
         RANK() OVER (PARTITION BY workspace_id ORDER BY quality_score DESC) as rank
  FROM contributors
  WHERE quality_score IS NOT NULL;
```

#### 6.3 Create Analytics Dashboard

**File**: `src/components/features/workspace/analytics-dashboard.tsx`

**Tasks**:
- [ ] Build workspace-level analytics view
- [ ] Show top contributors by quality
- [ ] Display topic distribution
- [ ] Show trending topics
- [ ] Add engagement trends chart
- [ ] Write tests

**Dashboard Sections**:
1. Top Contributors (quality score leaderboard)
2. Topic Distribution (pie chart)
3. Trending Topics (rising topics this week)
4. Engagement Trends (overall workspace activity)

**Acceptance Criteria**:
- ✅ Background jobs run reliably
- ✅ Query performance < 500ms for dashboard
- ✅ Materialized views refresh automatically
- ✅ Dashboard loads in < 1s
- ✅ All tests pass

---

### Phase 7: Testing & Documentation (✅ LOW PRIORITY - Days 17-18)

#### 7.1 Unit Tests

**Files**:
- `src/services/__tests__/topic-clustering.test.ts`
- `src/services/__tests__/contribution-trends.test.ts`
- `src/services/__tests__/quality-scoring.test.ts`

**Test Coverage**:
- [ ] Topic clustering algorithm
- [ ] LLM persona detection
- [ ] Trend calculation
- [ ] Quality scoring formulas
- [ ] Edge cases (no data, single contribution, etc.)

#### 7.2 Integration Tests

**Tasks**:
- [ ] Test full analytics pipeline (activity → clustering → scoring → display)
- [ ] Test background job execution
- [ ] Test cache invalidation
- [ ] Test error handling
- [ ] Test performance under load

#### 7.3 Documentation

**File**: `docs/features/ai-contributor-enrichment.md`

**Contents**:
- Architecture overview
- Quality scoring methodology
- Topic clustering algorithm
- Trend analysis approach
- Privacy and transparency
- API reference
- Troubleshooting guide

**Acceptance Criteria**:
- ✅ Test coverage > 80%
- ✅ All tests pass
- ✅ Documentation complete and accurate
- ✅ No TypeScript errors
- ✅ Build succeeds

---

## Technical Guidelines

### Architecture Decisions

1. **Hybrid Storage**
   - Current values in `contributors` table (fast access)
   - Historical snapshots in `contributor_analytics` (trends)
   - Materialized views for aggregations (performance)

2. **Reuse Existing Systems**
   - Embeddings: 384-dim vectors already standardized
   - LLM Service: Extend with new prompt types
   - Activity Hooks: Add analytics to existing data
   - Trend Patterns: Apply repo logic to contributors

3. **Background Processing**
   - Inngest for scheduled jobs (reliable, monitored)
   - Batch process to minimize API calls
   - Incremental updates (only changed contributors)

4. **Performance Optimization**
   - Cache analytics results (24hr TTL)
   - Lazy load analytics in UI
   - Materialize expensive aggregations
   - Index all query paths

### Privacy & Ethics

1. **Transparency**
   - Show what data was analyzed
   - Explain quality scores
   - Display confidence levels

2. **Opt-Out Mechanism**
   - Contributors can disable AI analysis
   - Respect privacy preferences
   - Delete analytics on request

3. **Public Data Only**
   - No external enrichment
   - GitHub public activity only
   - No personal inference

4. **GDPR Compliance**
   - Right to access data
   - Right to deletion
   - Data portability
   - Privacy by design

## Progress Tracking

### Completed ✅

- [x] Plan approved
- [x] PRD created
- [x] Todo list initialized
- [x] Branch created

### In Progress 🔄

- [ ] Phase 1: Database schema
- [ ] Phase 2: Topic clustering
- [ ] Phase 3: Trend analysis
- [ ] Phase 4: Quality scoring
- [ ] Phase 5: UI integration
- [ ] Phase 6: Background processing
- [ ] Phase 7: Testing & docs

### Blocked ⛔

None

## Dependencies

- ✅ Phase 1 complete (embeddings, discussions, AI summaries)
- ✅ Supabase MCP access configured
- ✅ PostHog LLM tracking enabled
- ⏳ Database migration needs approval

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM costs too high | High | Use caching aggressively, batch requests |
| Clustering doesn't converge | Medium | Add max iterations, validate k value |
| Quality scores not accurate | High | Validate with manual assessment, tune weights |
| Performance degradation | High | Materialize views, optimize indexes, monitor |
| Privacy concerns | High | Clear transparency, easy opt-out, no PII |

## Next Steps

1. ✅ Create PRD (this document)
2. ⏳ Start Phase 1: Database migration
3. ⏳ Implement Phase 2: Topic clustering
4. ⏳ Continue through phases sequentially
5. ⏳ Create PR with comprehensive description
6. ⏳ Delete PRD after merge (per CLAUDE.md)

---

**Note**: This PRD will be deleted after the feature is merged, per CLAUDE.md guidelines. All permanent documentation will be in `/docs/features/ai-contributor-enrichment.md`.
