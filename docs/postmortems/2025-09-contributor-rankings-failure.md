# Postmortem: Contributor of the Month Cards Not Rendering

**Date**: September 20, 2025
**Issue**: #695
**PR**: #744
**Severity**: High - Core feature completely broken
**Duration**: September 11-20, 2025 (9 days)

## Summary

Contributor of the Month cards stopped rendering across all repositories due to missing September 2025 data in the `monthly_rankings` table. The root cause was a failing GitHub Actions workflow that has been broken since September 11, 2025.

## Timeline

- **August 31, 2025**: Last successful data in `monthly_rankings` table (August 2025)
- **September 11, 2025**: `sync-contributor-stats` workflow starts failing consistently
- **September 11-19, 2025**: Workflow fails daily at 2:30 AM UTC (scheduled run)
- **September 20, 2025**: Issue discovered and fixed with fallback logic + data migration

## Root Cause

### Primary Failure
The `sync-contributor-stats` GitHub Actions workflow (`.github/workflows/sync-contributor-stats.yml`) has been failing every day since September 11, 2025. This workflow is responsible for:
1. Fetching contributor statistics from GitHub GraphQL API
2. Calculating weighted scores (PRs: 10x, Reviews: 3x, Comments: 1x)
3. Populating the `monthly_rankings` table in Supabase

### Why It Broke
The exact cause of workflow failure is still under investigation, but likely candidates:
- GitHub API rate limiting
- Authentication token expiration or permissions issue
- Timeout issues with large repositories
- Missing `SUPABASE_SERVICE_ROLE_KEY` secret

### Why Cards Didn't Render
The `useMonthlyContributorRankings` hook was querying for current month data only:
```typescript
// Only looked for current month, no fallback
.eq('month', currentMonth)
.eq('year', currentYear)
```

When September data wasn't found, the component returned `null`, making cards disappear entirely.

## Impact

- **User Impact**: Contributor of the Month cards disappeared from all repository pages
- **Data Impact**: September 2025 contributor activity wasn't being aggregated
- **Business Impact**: Key engagement feature was completely broken for 9 days

## Resolution

### Immediate Fix (PR #744)
1. **Added Fallback Logic**: Modified `useMonthlyContributorRankings` to fall back to most recent available month
2. **UI Indicators**: Shows "Previous Month Rankings" when using fallback data
3. **Workspace CTA**: Added call-to-action for workspace creation when no data exists
4. **Data Migration**: Populated September 2025 data from existing `pull_requests` table

### Code Changes
- `/src/hooks/use-monthly-contributor-rankings.ts`: Added fallback query and state tracking
- `/src/components/features/contributor/contributor-of-month-wrapper.tsx`: Added CTA and fallback display

### Data Fix
Ran migration to populate September data:
```sql
-- Calculated rankings from existing PR data
-- Created 290 rankings across 13 repositories
```

## Lessons Learned

### What Went Well
- Quick identification once reported
- Fallback solution prevents future complete failures
- Migration script successfully recovered September data

### What Went Wrong
- No monitoring/alerting for workflow failures
- No fallback mechanism in original implementation
- Silent failure - no error messages shown to users
- 9 days before anyone noticed/reported the issue

## Action Items

### Immediate
- [x] Add fallback logic to handle missing data
- [x] Populate missing September 2025 data
- [x] Add workspace CTA for better engagement

### Short-term
- [ ] Fix `sync-contributor-stats` workflow root cause
- [ ] Add monitoring/alerting for workflow failures
- [ ] Add retry logic to the workflow
- [ ] Validate GitHub token and permissions

### Long-term
- [ ] Implement real-time ranking calculation as alternative to pre-computed
- [ ] Add health checks for critical data pipelines
- [ ] Create dashboard for monitoring data freshness
- [ ] Implement automatic backfill when gaps detected

## Prevention

To prevent similar issues:

1. **Monitoring**: Set up alerts for GitHub Actions workflow failures
2. **Redundancy**: Always implement fallback mechanisms for data queries
3. **Visibility**: Show data freshness indicators in UI
4. **Testing**: Add tests for missing data scenarios
5. **Documentation**: Document all critical data pipelines and their dependencies

## Technical Details

### Database State
- Only August 2025 data existed: 38 records
- September 2025 now populated: 290 records across 13 repositories
- Data comes from `pull_requests` table which had 1,064 PRs for September

### Workflow Configuration
- Runs daily at 2:30 AM UTC via cron: `30 2 * * *`
- Can be manually triggered for specific repositories
- Requires `SUPABASE_SERVICE_ROLE_KEY` for write access

### Fallback Query Strategy
1. Try current month first
2. If no data, query for most recent month with any data
3. Order by year DESC, month DESC to get latest
4. Display indication when using fallback data

## References

- Issue: https://github.com/bdougie/contributor.info/issues/695
- PR: https://github.com/bdougie/contributor.info/pull/744
- Workflow: `.github/workflows/sync-contributor-stats.yml`
- Script: `scripts/data-sync/sync-contributor-stats.js`
- Migration: `populate_september_2025_rankings_with_rank`