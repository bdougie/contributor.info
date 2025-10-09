# Workspace Data Not Updating - Root Cause Analysis

## Problem Summary
Workspace metrics (issues, PRs, discussions, stars, etc.) are not updating even when:
1. The manual "Sync Workspace Data" button is clicked
2. Repositories are added/removed from workspaces
3. The scheduled cron job should be running (twice daily at 6 AM and 6 PM)

## Root Causes Identified

### 1. Missing API Endpoint ✅ FIXED
**Issue**: `workspace-client.ts:709` was calling `/api/workspaces/metrics/aggregate` which doesn't exist
- The function `triggerMetricsAggregation()` tried to use a REST API
- This API endpoint was never implemented

**Fix Applied**:
- Changed to use Inngest events instead: `workspace.metrics.aggregate`
- File: `src/lib/workspace/workspace-client.ts:700-727`

### 2. Repository Change Events Not Triggered ✅ PARTIALLY FIXED
**Issue**: When repos are added/removed, no event triggers workspace re-aggregation
- `WorkspaceService.addRepositoryToWorkspace()` doesn't send `workspace.repository.changed` event
- `WorkspaceService.removeRepositoryFromWorkspace()` doesn't send the event either

**Fix Applied**:
- Added event trigger in `addRepositoryToWorkspace()` at line 644-673
- Still need to add trigger in `removeRepositoryFromWorkspace()`

### 3. Sync Button Only Syncs Repositories, Not Metrics
**Issue**: The "Sync Workspace Data" button calls `workspace-sync-simple` Netlify function
- This function only syncs individual repository data (stars, forks, etc.)
- It does NOT trigger workspace metrics aggregation
- So the aggregated workspace view never updates

**Solution Needed**: Update the sync button or the Netlify function to:
1. Sync repository data (current functionality)
2. Trigger `workspace.metrics.aggregate` Inngest event
3. Invalidate workspace metrics cache

### 4. Inngest Cron Not Registering
**Issue**: The scheduled aggregation function (`scheduledWorkspaceAggregation`) may not be registered properly
- Function is exported from `aggregate-workspace-metrics.ts`
- It's included in the exports from `src/lib/inngest/functions/index.ts`
- BUT: Need to verify it's registered in the Inngest Netlify function

**Location**: `netlify/functions/netlify/functions/inngest-embeddings.mts`
- Need to check if `scheduledWorkspaceAggregation` is in the functions array

## Architecture Overview

### Data Flow (How It Should Work)
```
User Action → Event Trigger → Inngest → Aggregation Service → Cache Update
```

1. **Triggers**:
   - User adds/removes repository
   - Manual sync button clicked
   - Scheduled cron (twice daily)

2. **Event**: `workspace.repository.changed` or `workspace.metrics.aggregate`

3. **Inngest Function**: `aggregateWorkspaceMetrics` or `handleWorkspaceRepositoryChange`

4. **Aggregation**: `WorkspaceAggregationService.aggregateWorkspaceMetrics()`
   - Queries repos, PRs, issues, contributors
   - Calculates metrics
   - Stores in `workspace_metrics_cache`

5. **UI Update**: Components refetch data from cache

### Current Issues in Flow

#### Issue 1: Manual Sync Button (workspace-sync-simple)
```
Current: Button → Netlify → Sync Repos → ❌ (stops here)
Should be: Button → Netlify → Sync Repos → Trigger Inngest → Update Metrics
```

#### Issue 2: Repository Changes
```
Current: Add/Remove → ✅ Priority Sync → ❌ No Metrics Update
Should be: Add/Remove → Priority Sync → workspace.repository.changed → Update Metrics
```

#### Issue 3: Scheduled Cron
```
Current: Cron → ❌ Function Not Registered?
Should be: Cron (6AM/6PM) → Check Stale Caches → Update Metrics
```

## Fix Checklist

- [x] Fix `triggerMetricsAggregation` to use Inngest
- [x] Add `workspace.repository.changed` event in `addRepositoryToWorkspace`
- [ ] Add `workspace.repository.changed` event in `removeRepositoryFromWorkspace`
- [ ] Update sync button to trigger metrics aggregation
- [ ] Verify Inngest cron function registration
- [ ] Test full flow end-to-end

## Files Modified

1. `src/lib/workspace/workspace-client.ts:700-727` - Fixed triggerMetricsAggregation
2. `src/services/workspace.service.ts:644-673` - Added repository change event

## Files That Need Updates

1. `src/services/workspace.service.ts:~707` - Add event in removeRepositoryFromWorkspace
2. `netlify/functions/netlify/functions/workspace-sync-simple.ts` - Trigger metrics after sync
3. `netlify/functions/netlify/functions/inngest-embeddings.mts` - Verify cron registration

## Testing Plan

1. **Test Repository Add**:
   - Add a repository to workspace
   - Verify `workspace.repository.changed` event fires
   - Check Inngest dashboard for event
   - Wait ~30 seconds (debounce period)
   - Verify metrics update

2. **Test Manual Sync**:
   - Click "Sync Workspace Data" button
   - Verify repository data updates
   - Verify metrics aggregation triggers
   - Check workspace view for updated numbers

3. **Test Scheduled Cron**:
   - Check Inngest dashboard for scheduled function
   - Wait for next 6 AM or 6 PM run
   - Verify workspaces with stale cache get updated

## Related Files

- Inngest Functions: `src/lib/inngest/functions/aggregate-workspace-metrics.ts`
- Service: `src/services/workspace-aggregation.service.ts`
- Client: `src/lib/workspace/workspace-client.ts`
- UI: `src/components/features/workspace/WorkspaceSyncButton.tsx`
- Netlify: `netlify/functions/netlify/functions/workspace-sync-simple.ts`
