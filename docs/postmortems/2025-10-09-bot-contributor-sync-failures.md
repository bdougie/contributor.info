# Postmortem: Bot Contributor Sync Failures (October 9, 2025)

**Date**: October 9, 2025
**Duration**: ~2 hours
**Impact**: Repository sync jobs failing to capture bot contributors; missing recent PRs from database; duplicate key constraint violations
**Status**: Resolved

## Summary

Repository sync jobs were failing due to three compounding issues: (1) bot contributors being filtered out during data ingestion instead of at the UI layer, (2) PRs being fetched by `updated` timestamp instead of `created` timestamp, missing brand new PRs, and (3) duplicate key constraint violations when checking contributors by username instead of github_id.

## Timeline (UTC)

All times approximate based on conversation context:

- **19:00** - Triggered repository sync and workspace aggregation for 4 repositories
- **19:01** - User reports immediate failures: "Cannot create contributor continue[bot] without github_id"
- **19:05** - Added bot detection logic to Edge Function to filter out bots during ingestion
- **19:10** - Fixed missing `user.id` parameter in 9 `ensureContributor` calls
- **19:15** - Deployed Edge Function with bot filtering
- **19:16** - User confirms fix works: "it worked by the way"
- **19:20** - User notes data freshness issue: PR #8138 is latest but should have newer PRs from Oct 9
- **19:25** - **CRITICAL FEEDBACK**: User: "We need bots to be included. gh pr 808 standardizes bot detection"
- **19:30** - Reverted bot filtering from Edge Function (3 locations: issue comments, issues, repository sync PRs)
- **19:35** - Deployed updated Edge Function without bot filtering
- **19:40** - Triggered new sync, immediately failed - missing PRs #8164 and #8166 (both created Oct 9)
- **19:45** - Identified root cause #2: Repository sync fetching PRs by `sort=updated` instead of `sort=created`
- **19:50** - Changed PR fetch from `sort=updated` to `sort=created` in line 691
- **19:55** - Deployed and triggered sync
- **20:00** - New error: "duplicate key value violates unique constraint 'contributors_github_id_key'"
- **20:05** - Identified root cause #3: `ensureContributor` checking by `username` first instead of `github_id`
- **20:10** - Fixed `ensureContributor` to check by `github_id` first (the actual unique constraint)
- **20:15** - Final deployment with all three fixes
- **20:20** - Repository sync successful

## Root Causes

### 1. Incorrect Bot Filtering Strategy

**What Happened**: Bot contributors (like `continue[bot]`) were being filtered out during data ingestion in the Edge Function.

**Why It Happened**:
- Misunderstood the system design - thought bots should be filtered at ingestion
- PR #808 actually standardizes bot detection at the **application/UI level**, not data layer
- Bot detection patterns were added to `ensureContributor` function, causing null returns

**Code Location**: `supabase/functions/inngest-prod/index.ts` lines 134-177 (ensureContributor function)

**Fix**: Removed bot pattern detection from Edge Function. Now only skips GitHub Apps that lack numeric `github_id` values (database constraint requirement). Application-level filtering happens via PR #808's `src/lib/utils/bot-detection.ts`.

### 2. Wrong PR Sort Order

**What Happened**: Repository sync was fetching the 30 most recently *updated* PRs instead of the 30 most recently *created* PRs.

**Why It Happened**:
- GitHub API query used `sort=updated&direction=desc`
- This meant brand new PRs (created Oct 9) weren't in the result set if there were 30+ older PRs that had been updated more recently
- Issue went unnoticed because most of the time, recently created PRs are also recently updated

**Code Location**: `supabase/functions/inngest-prod/index.ts` line 691

**Before**:
```typescript
const prs = await githubRequest(
  `/repos/${owner}/${repo}/pulls?state=all&per_page=30&sort=updated&direction=desc`,
  github_token
);
```

**After**:
```typescript
const prs = await githubRequest(
  `/repos/${owner}/${repo}/pulls?state=all&per_page=30&sort=created&direction=desc`,
  github_token
);
```

### 3. Duplicate Key Constraint Violations

**What Happened**: When creating contributors, the function would fail with "duplicate key value violates unique constraint 'contributors_github_id_key'"

**Why It Happened**:
- `ensureContributor` was checking if contributor exists by `username` first
- Database has unique constraint on `github_id`, not `username`
- Race condition: contributor could exist with same `github_id` but different `username`

**Code Location**: `supabase/functions/inngest-prod/index.ts` lines 142-147

**Before**:
```typescript
// Check if contributor exists by username
const { data: existing } = await supabase
  .from('contributors')
  .select('id')
  .eq('username', username)
  .single();
```

**After**:
```typescript
// Check if contributor exists by github_id first (unique constraint)
const { data: existingById } = await supabase
  .from('contributors')
  .select('id')
  .eq('github_id', githubId)
  .single();

if (existingById) {
  return existingById.id;
}

// Check if contributor exists by username (for legacy data)
const { data: existingByUsername } = await supabase
  .from('contributors')
  .select('id')
  .eq('username', username)
  .single();
```

## Detection

User reported immediate failures after triggering manual repository sync and workspace aggregation. Errors were visible in Inngest job logs and Supabase Edge Function logs.

## Resolution

Three code changes deployed to `supabase/functions/inngest-prod/index.ts`:

1. **Removed bot filtering** (lines 543, 610, 704): Changed from `if (!authorId) { console.log("Skipping bot..."); continue; }` to `if (!authorId) continue; // Skip if no github_id (GitHub Apps/bots)`

2. **Fixed PR sort order** (line 691): Changed `sort=updated` to `sort=created`

3. **Fixed contributor lookup** (lines 142-191): Check by `github_id` first (unique constraint), then `username` (legacy), with proper fallback in error handling

## Impact

- **User Impact**: Repository sync jobs failed for ~1.5 hours, preventing fresh PR data from being captured
- **Data Impact**: Bot contributors (like `continue[bot]`) were not being stored in database during the window where bot filtering was active (~15 minutes)
- **Scope**: Affected all repository sync operations during the incident window

## Lessons Learned

### What Went Well

- Quick iteration cycle - 3 deployments in ~45 minutes
- User provided immediate, clear feedback about failures
- Comprehensive error messages helped identify issues quickly

### What Went Wrong

- Misunderstood the bot filtering architecture (should be UI-layer, not data-layer)
- Didn't validate PR sort order against expected behavior (newest PRs should always be captured)
- Didn't align contributor lookup with actual database constraints

### Where We Got Lucky

- Issues discovered during manual sync testing, not during production cron
- User actively monitoring results and provided immediate feedback
- All three issues manifested quickly with clear error messages

## Action Items

### Immediate (Completed)

- [x] Remove bot filtering from Edge Function data ingestion
- [x] Change PR sort from `updated` to `created`
- [x] Fix `ensureContributor` to check by `github_id` first
- [x] Deploy all three fixes to production

### Short-term

- [ ] Add integration tests for `ensureContributor` function covering:
  - New contributor creation
  - Existing contributor by `github_id`
  - Existing contributor by `username` (legacy)
  - Duplicate `github_id` handling
- [ ] Document bot filtering architecture (data layer vs UI layer)
- [ ] Add monitoring for repository sync job success/failure rates
- [ ] Review other GitHub API queries for similar sort order issues

### Long-term

- [ ] Consider increasing PR fetch limit from 30 to 50-100 for high-velocity repos
- [ ] Add validation that ensures database constraint checks align with actual schema
- [ ] Create postmortem review process for future incidents

## Supporting Information

- **Related PR**: #808 (Standardizes bot detection at application level)
- **Edge Function**: `supabase/functions/inngest-prod/index.ts`
- **Bot Detection Utility**: `src/lib/utils/bot-detection.ts`
- **Example Bot PR**: https://github.com/continuedev/continue/pull/8166 (continue[bot])
- **Manual Trigger Scripts**: `/tmp/trigger-repo-syncs.sh`, `/tmp/trigger-workspace-aggregation.sh`
