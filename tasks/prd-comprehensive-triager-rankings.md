# Technical Requirements Document: Comprehensive Triager Rankings and First Responder Metrics

## Project Overview

**Objective**: Implement comprehensive triager rankings and first responder metrics that include both PR and issue activity, providing complete visibility into community engagement patterns.

**Background**: Currently, the system only tracks PR comments in the comments table. GitHub issue #670 identifies the need to extend data collection to include issue comments, enabling accurate triager rankings and first responder metrics across both PRs and issues.

**Success Metrics**:
- Issue comments are collected and stored alongside PR comments
- First responder metrics work for both PRs and issues
- Triager rankings combine PR and issue activity
- Bot detection works for issue commenters
- Workspace analytics display comprehensive engagement data

## Current State Analysis

### Existing Infrastructure

**✅ What Works:**
- Issues table exists (`issues` table from 20250114_github_app_schema.sql)
- PR comments are collected and stored in `comments` table
- PR-based triager metrics function correctly via `issue-metrics.ts`
- Bot detection system via `event-detection.ts`
- Webhook infrastructure handles GitHub events via `github-webhook/index.ts`
- GitHub events cached in `github_events_cache` table

**❌ Current Limitations:**
- `comments` table only references `pull_request_id`, no support for direct issue comments
- `comment_type` field uses 'issue_comment' for PR comments (confusing naming)
- No webhook handlers for GitHub issue comment events
- Issue-specific first responder calculations missing
- Triager rankings exclude issue activity

### Database Schema Analysis

**Comments Table Structure (from initial_contributor_schema.sql):**
```sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    pull_request_id UUID NOT NULL REFERENCES pull_requests(id) ON DELETE CASCADE,
    commenter_id UUID NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    comment_type TEXT NOT NULL CHECK (comment_type IN ('issue_comment', 'review_comment')),
    -- ... additional fields for review comments
);
```

**Issues Table Structure (from 20250114_github_app_schema.sql):**
```sql
CREATE TABLE issues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_id BIGINT UNIQUE NOT NULL,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT CHECK (state IN ('open', 'closed')),
    author_id UUID REFERENCES contributors(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    closed_by_id UUID REFERENCES contributors(id),
    comments_count INTEGER DEFAULT 0,
    -- ... additional fields
);
```

## Implementation Plan

### Phase 1: Database Schema Enhancement (HIGH Priority)

**Objective**: Modify database schema to support both PR and issue comments in a unified structure.

**Tasks**:

1. **Add issue_id Field to Comments Table**
   ```sql
   ALTER TABLE comments 
   ADD COLUMN issue_id UUID REFERENCES issues(id) ON DELETE CASCADE;
   ```

2. **Update Comments Table Constraints**
   ```sql
   -- Make pull_request_id nullable for issue comments
   ALTER TABLE comments 
   ALTER COLUMN pull_request_id DROP NOT NULL;
   
   -- Add constraint ensuring exactly one of pull_request_id or issue_id is set
   ALTER TABLE comments 
   ADD CONSTRAINT comments_source_check 
   CHECK ((pull_request_id IS NOT NULL AND issue_id IS NULL) OR 
          (pull_request_id IS NULL AND issue_id IS NOT NULL));
   ```

3. **Add Repository ID for Direct Access**
   ```sql
   -- Add repository_id for efficient querying (from 20250812_add_repository_id_to_comments.sql)
   ALTER TABLE comments 
   ADD COLUMN repository_id UUID REFERENCES repositories(id) ON DELETE CASCADE;
   
   -- Create index for repository-based comment queries
   CREATE INDEX idx_comments_repository ON comments(repository_id);
   CREATE INDEX idx_comments_issue ON comments(issue_id);
   ```

4. **Update Comment Type Semantics**
   ```sql
   -- Add new comment types for clarity
   ALTER TABLE comments 
   DROP CONSTRAINT comments_comment_type_check;
   
   ALTER TABLE comments 
   ADD CONSTRAINT comments_comment_type_check 
   CHECK (comment_type IN ('pr_issue_comment', 'review_comment', 'issue_comment'));
   ```

**Acceptance Criteria**:
- ✅ Comments table supports both PR and issue comments via nullable foreign keys
- ✅ Repository ID enables efficient cross-comment queries
- ✅ Comment types clearly distinguish PR vs issue comments
- ✅ Existing PR comment data remains intact after migration

### Phase 2: Webhook Event Handling (HIGH Priority)

**Objective**: Extend GitHub webhook handling to capture issue comment events.

**Tasks**:

1. **Update Event Detection for Issue Comments**
   - Modify `_shared/event-detection.ts` to handle `issue_comment` webhook events
   - Distinguish between PR comments and true issue comments
   - Apply bot detection to issue commenters

2. **Enhance Webhook Handler**
   ```typescript
   // In github-webhook/index.ts
   // Add handling for issue comment events
   if (event.type === 'issue_comment') {
     const commentData = event.payload.comment;
     const issueData = event.payload.issue;
     
     // Store issue comment in comments table
     await supabase
       .from('comments')
       .upsert({
         github_id: commentData.id,
         issue_id: issueUUID, // Resolved from issue number
         commenter_id: commenterUUID,
         repository_id: repositoryUUID,
         body: commentData.body,
         comment_type: 'issue_comment',
         created_at: commentData.created_at,
         updated_at: commentData.updated_at
       });
   }
   ```

3. **Add Issue Comment Sync to Background Jobs**
   - Extend `github-sync/index.ts` to fetch historical issue comments
   - Add issue comment collection to progressive capture system
   - Ensure rate limiting respects GitHub API limits

**Acceptance Criteria**:
- ✅ Webhook captures issue comment creation, updates, and deletions
- ✅ Historical issue comments are collected via sync jobs
- ✅ Bot detection works for issue commenters
- ✅ Issue comments are properly attributed to issues and repositories

### Phase 3: Metrics Calculation Enhancement (MEDIUM Priority)

**Objective**: Update metrics calculations to include issue comment activity in triager rankings and first responder metrics.

**Tasks**:

1. **Update Issue Activity Patterns Function**
   ```typescript
   // In src/lib/insights/issue-metrics.ts
   export async function calculateIssueActivityPatterns(
     owner: string,
     repo: string,
     timeRange: string = '30'
   ): Promise<IssueActivityPatterns> {
     // Query both PR and issue comments
     const { data: allComments } = await supabase
       .from('comments')
       .select(`
         id,
         commenter_id,
         created_at,
         comment_type,
         issue_id,
         pull_request_id,
         contributors!fk_comments_commenter (
           username,
           avatar_url
         )
       `)
       .eq('repository_id', repoData.id)
       .in('comment_type', ['issue_comment', 'pr_issue_comment', 'review_comment'])
       .gte('created_at', since.toISOString());
       
     // Calculate combined triager stats across all comment types
     // Calculate first responders specifically for issue comments
   }
   ```

2. **Implement True First Responder Logic**
   ```typescript
   // Get issue comments grouped by issue with first response detection
   const firstResponsesByIssue = await supabase
     .from('comments')
     .select('issue_id, commenter_id, created_at, contributors(*)')
     .eq('repository_id', repoData.id)
     .eq('comment_type', 'issue_comment')
     .order('created_at', { ascending: true });
     
   // Group by issue and identify first non-author responder
   const firstResponders = identifyFirstResponders(firstResponsesByIssue, issues);
   ```

3. **Create Combined Rankings Function**
   ```typescript
   // New function for comprehensive triager rankings
   export async function calculateCombinedTriagerRankings(
     owner: string,
     repo: string,
     timeRange: string = '30'
   ): Promise<TriagerRanking[]> {
     // Combine PR and issue comment activity
     // Weight different types of triage activities
     // Return unified ranking with activity breakdown
   }
   ```

**Acceptance Criteria**:
- ✅ First responder metrics identify first non-author responder to issues
- ✅ Triager rankings combine PR and issue comment activity
- ✅ Activity patterns distinguish between PR and issue engagement
- ✅ Metrics handle edge cases (no comments, author self-responses)

### Phase 4: UI Integration and Analytics Display (MEDIUM Priority)

**Objective**: Update workspace analytics UI to display comprehensive triager and first responder data.

**Tasks**:

1. **Update Analytics Cards**
   - Remove "Coming soon" placeholders from `first-responders-card.tsx` and `active-triager-card.tsx`
   - Display actual data from enhanced metrics calculations
   - Show activity breakdown (PR vs issue engagement)

2. **Enhance Workspace Analytics**
   - Update `WorkspaceIssueMetricsAndTrends.tsx` to use new combined metrics
   - Add visual indicators for different types of triage activity
   - Include issue vs PR activity breakdowns in tooltips/details

3. **Add Activity Type Filters**
   - Allow filtering triager rankings by activity type (PRs only, issues only, combined)
   - Add time range selectors for flexible analysis
   - Show trend indicators for first response times

**Acceptance Criteria**:
- ✅ First responder and triager cards show real data from both PRs and issues
- ✅ Activity breakdowns help users understand engagement patterns
- ✅ UI clearly distinguishes different types of triage activity
- ✅ Performance remains acceptable with combined data queries

### Phase 5: Data Migration and Validation (LOW Priority)

**Objective**: Ensure data consistency and validate the new system with existing repositories.

**Tasks**:

1. **Backfill Repository IDs**
   ```sql
   -- Populate repository_id for existing comments
   UPDATE comments 
   SET repository_id = pr.repository_id
   FROM pull_requests pr 
   WHERE comments.pull_request_id = pr.id 
   AND comments.repository_id IS NULL;
   ```

2. **Validate Data Consistency**
   - Verify all comments have proper repository associations
   - Check that bot detection works consistently across comment types
   - Validate that metrics calculations produce expected results

3. **Performance Optimization**
   - Analyze query performance with new schema
   - Add additional indexes if needed
   - Optimize combined metrics calculations

**Acceptance Criteria**:
- ✅ All existing PR comments have repository_id populated
- ✅ Query performance meets acceptable thresholds
- ✅ Data validation confirms system accuracy
- ✅ No regressions in existing functionality

## Technical Guidelines

### Database Schema Decisions

1. **Nullable Foreign Keys**: Using nullable `pull_request_id` with required `issue_id` for issue comments provides flexibility while maintaining referential integrity.

2. **Repository ID Denormalization**: Adding `repository_id` to comments enables efficient cross-repository queries without complex joins.

3. **Comment Type Evolution**: Renaming existing 'issue_comment' to 'pr_issue_comment' and introducing true 'issue_comment' type provides semantic clarity.

### Webhook Integration Patterns

1. **Event Type Mapping**: GitHub webhook `issue_comment` events need careful handling to distinguish PR vs issue contexts.

2. **Incremental Collection**: New webhook handlers must integrate with existing progressive capture and rate limiting systems.

3. **Data Consistency**: Webhook processing must handle race conditions and duplicate events gracefully.

### Metrics Calculation Architecture

1. **Unified Data Model**: All comment-based metrics should query from the unified comments table rather than separate sources.

2. **First Responder Logic**: True first responders exclude issue authors and require temporal ordering within each issue thread.

3. **Ranking Weights**: Combined rankings may need different weights for PR vs issue activity based on community value.

## Integration Points

### Existing Workspace Analytics System

The new functionality integrates with:

- **Workspace Metrics Cache** (`workspace_metrics_cache` table): Combined triager rankings will be cached for performance
- **Progressive Capture Jobs** (`progressive_capture_jobs` table): Issue comment collection joins existing background processing
- **GitHub Events Classification** (`github_events_cache` table): Issue comment events are classified and processed alongside PR events

### Data Fetching and Sync Systems

- **GitHub Sync Function**: Extended to collect issue comments during repository synchronization
- **Webhook Processing**: Issue comment webhooks processed with same reliability patterns as PR webhooks
- **Rate Limiting**: Issue comment collection respects GitHub API rate limits in `rate_limits` table

### Authentication and Permissions

- **Row Level Security**: Issue comments inherit same RLS policies as other public data
- **Bot Detection**: Issue commenters are subject to same bot detection algorithms as PR commenters
- **Data Privacy**: No sensitive information exposure through issue comment collection

## Risk Mitigation

### Performance Impact

**Risk**: Combined PR/issue queries may impact performance
**Mitigation**: 
- Add specific indexes for combined queries
- Use repository_id denormalization to avoid expensive joins
- Implement query result caching in `workspace_metrics_cache`

### Data Volume

**Risk**: Issue comments may significantly increase storage requirements  
**Mitigation**:
- Monitor storage growth with new comment collection
- Implement data retention policies for old comments
- Use partitioning for comments table if needed

### API Rate Limits

**Risk**: Additional issue comment collection may hit GitHub API limits
**Mitigation**:
- Integrate with existing rate limiting system (`rate_limits` table)
- Prioritize recent/active repositories for issue comment collection
- Use progressive capture to spread API usage over time

### Migration Complexity  

**Risk**: Schema changes may impact existing functionality
**Mitigation**:
- Implement changes incrementally with feature flags
- Maintain backward compatibility during transition
- Comprehensive testing of existing PR comment workflows

## Implementation Timeline

- **Phase 1** (Database Schema): 2-3 days
- **Phase 2** (Webhook Handling): 3-4 days  
- **Phase 3** (Metrics Calculation): 4-5 days
- **Phase 4** (UI Integration): 2-3 days
- **Phase 5** (Migration/Validation): 2-3 days

**Total Estimated Duration**: 13-18 days

**Critical Path**: Phase 1 → Phase 2 → Phase 3 (database changes must precede webhook handling, which must precede metrics enhancement)

**Parallel Work Opportunities**: Phase 4 UI work can begin once Phase 3 metrics are defined, even before full implementation.

## Success Criteria

### Functional Requirements
- [x] Database supports both PR and issue comments
- [x] Issue comments collected via webhooks and sync jobs  
- [x] Bot detection works for issue commenters
- [x] First responder metrics work for both PRs and issues
- [x] Triager rankings include both PR and issue activity
- [x] Workspace analytics display combined data

### Technical Requirements
- [x] Query performance remains acceptable with new schema
- [x] Existing PR comment functionality unchanged
- [x] Data migration completes without corruption
- [x] API rate limiting respects GitHub constraints
- [x] RLS policies secure issue comment access

### Business Requirements  
- [x] Complete visibility into community engagement patterns
- [x] Identification of most responsive community members
- [x] Detection of issues needing attention (no responses)
- [x] Community health pattern analysis
- [x] Response time trend tracking across both PRs and issues

This comprehensive approach ensures the triager rankings and first responder metrics provide complete insight into repository community engagement across all contribution channels.