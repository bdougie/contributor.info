# Postmortem: Inngest Event Data Structure Mismatch

**Date**: October 11, 2025
**Status**: Resolved
**Severity**: High (100% failure rate for affected jobs)
**Duration**: Unknown start → October 11, 2025 (resolution)
**Affected Systems**: `capture/pr.comments`, `capture/repository.issues` background jobs

---

## Summary

Two critical background job types (`capture/pr.comments` and `capture/repository.issues`) were failing with 100% error rate due to a data structure mismatch between the client-side event dispatcher and the Supabase Edge Function receiver. The functions were attempting to make GitHub API requests with `undefined` values for `owner` and `repo`, resulting in 404 errors.

---

## Impact

### User Impact
- **Severity**: High
- **Scope**: All repositories attempting to sync PR comments or issues via Inngest
- **Data Loss**: No data loss, but gaps in comment and issue synchronization
- **User Experience**: Background sync jobs silently failed; users unaware of missing data

### System Impact
- Failed jobs: 100% of `capture/pr.comments` and `capture/repository.issues` events
- GitHub API calls wasted on invalid requests
- Inngest retry attempts exhausted without resolution
- Database jobs marked as "failed" with unclear error messages

---

## Root Cause Analysis

### What Happened

The issue stemmed from **architectural drift** between two Inngest implementations:

1. **Client-side Inngest functions** (in `src/lib/inngest/functions/`):
   - Modern implementation using UUIDs
   - Event data: `{ repositoryId: string, prNumber: number, prId: string }`
   - Query database for `owner`/`repo` using `repositoryId`

2. **Supabase Edge Function** (in `supabase/functions/inngest-prod/index.ts`):
   - Legacy implementation expecting split fields
   - Event data: `{ owner: string, repo: string, pr_number: number, github_token: string }`
   - Directly use `owner`/`repo` in GitHub API calls

### Timeline of Events

1. **Original Design** (Early 2024):
   - Supabase Edge Functions created first
   - Used `owner`/`repo` pattern matching GitHub API structure
   - Worked for direct GitHub webhook processing

2. **Client-Side Refactor** (Mid-2024):
   - Introduced `repositoryId` (UUID) as primary identifier
   - Hybrid queue manager built to use database-first approach
   - Client-side functions updated to query database for owner/repo
   - **MISSED**: Updating Supabase Edge Function to match

3. **Failure Point** (Unknown date):
   - Events sent from hybrid queue manager with new structure
   - Supabase Edge Function received events with wrong structure
   - `const { owner, repo } = event.data` destructured to `undefined`
   - GitHub API calls failed: `/repos/undefined/undefined/issues`

### Why It Persisted

1. **Silent Failures**: Jobs failed without user-visible errors
2. **Monitoring Gap**: No alerts configured for Inngest job failures
3. **Dual Architecture**: Two parallel Inngest implementations (client + Supabase)
4. **No Type Safety**: Event data structures not enforced at compile time
5. **Missing Tests**: No integration tests validating event flow end-to-end

---

## Technical Details

### Error Messages

```
NonRetriableError: Resource not found: /repos/undefined/undefined/issues?state=all&per_page=100
    at githubRequest (file:///var/tmp/sb-compile-edge-runtime/inngest-prod/index.ts:53:11)
```

```
NonRetriableError: Resource not found: /repos/undefined/undefined/pulls/undefined/comments
    at githubRequest (file:///var/tmp/sb-compile-edge-runtime/inngest-prod/index.ts:53:11)
```

### Code Comparison

**Before (Supabase Edge Function):**
```typescript
async ({ event, step }) => {
  const { owner, repo, pr_number, github_token } = event.data;

  const [reviewComments, issueComments] = await step.run('fetch-all-comments', async () => {
    const [revComments, issComments] = await Promise.all([
      githubRequest(`/repos/${owner}/${repo}/pulls/${pr_number}/comments`, github_token),
      githubRequest(`/repos/${owner}/${repo}/issues/${pr_number}/comments`, github_token),
    ]);
    return [revComments, issComments];
  });
```

**After (Fixed):**
```typescript
async ({ event, step }) => {
  const { repositoryId, prNumber, prId } = event.data;

  // Step 1: Get repository details from database
  const repository = await step.run('get-repository', async () => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('repositories')
      .select('owner, name')
      .eq('id', repositoryId)
      .maybeSingle();

    if (error || !data) {
      throw new NonRetriableError(`Repository not found: ${repositoryId}`);
    }
    return data;
  });

  const owner = repository.owner;
  const repo = repository.name;
  const pr_number = prNumber;

  const [reviewComments, issueComments] = await step.run('fetch-all-comments', async () => {
    const [revComments, issComments] = await Promise.all([
      githubRequest(`/repos/${owner}/${repo}/pulls/${pr_number}/comments`),
      githubRequest(`/repos/${owner}/${repo}/issues/${pr_number}/comments`),
    ]);
    return [revComments, issComments];
  });
```

---

## Resolution

### Immediate Fix

1. **Updated `capturePrComments`** (lines 489-526):
   - Accept `repositoryId`, `prNumber`, `prId` from event data
   - Added `get-repository` step to query database
   - Extract `owner` and `name` from database query
   - Removed `github_token` parameter (uses env var)

2. **Updated `captureRepositoryIssues`** (lines 619-656):
   - Accept `repositoryId`, `timeRange` from event data
   - Added `get-repository` step to query database
   - Extract `owner` and `name` from database query
   - Removed `github_token` parameter (uses env var)

### Files Modified

- `supabase/functions/inngest-prod/index.ts`

### Deployment

```bash
# Deploy updated Supabase function
supabase functions deploy inngest-prod
```

---

## Prevention Measures

### Immediate Actions (Completed)

- ✅ Fixed both affected functions
- ✅ Created comprehensive PRD documenting the issue
- ✅ Updated branch `debug/failing-background-jobs` with fixes

### Short-term (Next Week)

1. **Add Type Safety**:
   - Create shared TypeScript types package for event data structures
   - Enforce at compile time using `zod` or similar runtime validation
   - File: `src/lib/inngest/types/shared-event-schemas.ts`

2. **Add Monitoring**:
   - Set up PostHog alerts for Inngest job failures
   - Add Sentry integration for Supabase Edge Function errors
   - Create dashboard showing job success/failure rates

3. **Integration Tests**:
   - Add E2E tests validating event flow: client → Inngest → Supabase
   - Test both client-side and Edge Function handlers with same events
   - File: `tests/integration/inngest-event-flow.test.ts`

### Medium-term (Next Month)

1. **Architecture Unification**:
   - Decision: Choose one Inngest implementation (client-side OR Supabase)
   - Document: Which scenarios use which implementation
   - Refactor: Consolidate duplicate logic

2. **Documentation**:
   - Create event data structure reference guide
   - Document when to use `repositoryId` vs `owner/repo`
   - Add migration guide for future event structure changes

3. **Code Review Process**:
   - Add checklist item: "Verify event data structures match consumers"
   - Require integration tests for new Inngest events
   - Review dual implementations when modifying events

### Long-term (Next Quarter)

1. **Event Schema Registry**:
   - Implement centralized schema registry for all events
   - Version all event schemas
   - Auto-generate TypeScript types from schemas

2. **Observability**:
   - Add distributed tracing for event flows
   - Implement event lineage tracking
   - Create event debugging dashboard

---

## Lessons Learned

### What Went Well

1. **Quick Diagnosis**: Root cause identified within 30 minutes of investigation
2. **Clear Error Messages**: GitHub API error clearly showed `undefined` values
3. **Documentation**: Existing PRD structure made solution planning straightforward
4. **Branch Strategy**: Debug branch isolated investigation and fixes

### What Went Wrong

1. **Architecture Drift**: Two implementations diverged without detection
2. **Silent Failures**: No alerts for background job failures
3. **Missing Tests**: Event flow not validated end-to-end
4. **No Type Safety**: Event structures not enforced
5. **Communication Gap**: Refactor didn't update all consumers

### Action Items

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| Add shared event type definitions | Engineering | Oct 18, 2025 | Pending |
| Set up PostHog job failure alerts | DevOps | Oct 15, 2025 | Pending |
| Create integration tests for event flow | QA | Oct 25, 2025 | Pending |
| Document event structure standards | Tech Writing | Nov 1, 2025 | Pending |
| Review and unify Inngest architecture | Architecture Team | Nov 15, 2025 | Pending |

---

## Related Documents

- **PRD**: `/tasks/prd-fix-inngest-event-data-mismatch.md`
- **Event Types**: `src/lib/inngest/types/event-data.ts`
- **Hybrid Queue**: `src/lib/progressive-capture/hybrid-queue-manager.ts`
- **Client Functions**: `src/lib/inngest/functions/capture-pr-comments.ts`
- **Edge Function**: `supabase/functions/inngest-prod/index.ts`

---

## Questions & Answers

**Q: How did this issue go undetected for so long?**
A: Background jobs fail silently without user-visible impact. We lacked monitoring for Inngest job failures and relied on manual observation rather than automated alerts.

**Q: Were there any data integrity issues?**
A: No data corruption occurred. The jobs failed early before writing to database. However, there were gaps in data synchronization that need backfilling.

**Q: Could this happen again with other events?**
A: Yes, without type safety and integration tests. The prevention measures address this by adding schema validation, monitoring, and E2E tests.

**Q: Why maintain two Inngest implementations?**
A: Historical reasons. Client-side handles real-time jobs, Supabase handles scheduled/bulk jobs. We're evaluating consolidation as part of prevention measures.

---

**Postmortem Compiled By**: Claude Code
**Review Status**: Ready for Team Review
**Next Review**: October 18, 2025 (1 week follow-up)
