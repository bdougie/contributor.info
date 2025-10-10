# Obsolete Netlify Functions Cleanup

## Date: October 10, 2025
## Issue: #1070 (and related #1059)

## Files to Remove/Archive

### 1. Already Migrated to Supabase Edge Functions

#### Inngest Functions (migrated to `supabase/functions/inngest-prod/`)
- `netlify/functions/inngest-prod.ts` - Main production Inngest handler
- `.archived/inngest-prod-functions.mts.disabled` - Already archived
- `.archived/inngest-prod.mts.disabled` - Already archived

#### Backfill Functions (KEPT - Still Used by Frontend)
- ✅ KEPT: `netlify/functions/backfill-trigger.ts` - Frontend uses `/api/backfill/trigger`
- ✅ KEPT: `netlify/functions/backfill-cancel.ts` - Frontend uses `/api/backfill/cancel/{id}`
- ✅ KEPT: `netlify/functions/backfill-status.ts` - Frontend uses `/api/backfill/status/{id}`
- ✅ KEPT: `netlify/functions/backfill-events.ts` - Frontend uses `/api/backfill/events`
- ✅ KEPT: `netlify/functions/backfill-events-proxy.ts` - Supporting function
- ❌ REMOVED: `netlify/functions/webhook-backfill-complete.ts` - Backfill webhook handler

### 2. Duplicates and Test Files

#### Development/Test Inngest Variations (keep only essential ones)
- `netlify/functions/inngest-test.js` - Test file
- `netlify/functions/inngest-simple.mts` - Simplified version, not needed
- `netlify/functions/inngest-local-full.mts` - Local development variant
- `netlify/functions/inngest-hybrid.ts` - Experimental hybrid version
- `netlify/functions/inngest-unified.mts` - Attempted unification, not used

#### Backup Files
- `netlify/functions/validate-repository.ts.backup` - Old backup file

### 3. Migrated to Fly.io
- `netlify/functions/github-webhook-simple/` - GitHub webhooks moved to Fly.io

### 4. Obsolete/Unused Functions
- `netlify/functions/api-discover-repository.js` - Duplicate of .mjs version
- `netlify/functions/api-repository-status.js` - Old implementation
- `netlify/functions/test.mts` - Test file
- `netlify/functions/api-test-reviewers.mts` - Test endpoint

### 5. Files to Keep (Currently Working)

#### Data-Centric Functions (Issue #1070 - To Be Migrated)
- ✅ KEEP: `netlify/functions/api-codeowners.mts`
- ✅ KEEP: `netlify/functions/workspace-sync-simple.ts`
- ✅ KEEP: `netlify/functions/api-suggest-reviewers.mts`
- ✅ KEEP: `netlify/functions/api-suggested-codeowners.mts`
- ✅ KEEP: `netlify/functions/api-file-tree.mts`

#### Essential Working Functions
- ✅ KEEP: `netlify/functions/health-check.mts` - Health monitoring
- ✅ KEEP: `netlify/functions/hello.js` - Simple ping endpoint
- ✅ KEEP: `netlify/functions/widget-badge.mjs` - SVG badges
- ✅ KEEP: `netlify/functions/widget-stat-card.mjs` - SVG stat cards
- ✅ KEEP: `netlify/functions/inngest-embeddings.mts` - Embeddings webhook
- ✅ KEEP: `netlify/functions/inngest-local.mts` - Local development
- ✅ KEEP: `netlify/functions/inngest.mts` - Main development handler
- ✅ KEEP: `netlify/functions/inngest-health.mts` - Inngest health check

#### Repository Management
- ✅ KEEP: `netlify/functions/api-track-repository.mts`
- ✅ KEEP: `netlify/functions/api-trending-repositories.mts`
- ✅ KEEP: `netlify/functions/api-discover-repository.mjs`
- ✅ KEEP: `netlify/functions/api-fetch-codeowners.mts`
- ✅ KEEP: `netlify/functions/validate-repository.ts`

#### Workspace & Sync Functions
- ✅ KEEP: `netlify/functions/workspace-sync.ts`
- ✅ KEEP: `netlify/functions/sync-router.mts`
- ✅ KEEP: `netlify/functions/trigger-inngest-sync.ts`

#### Other Services
- ✅ KEEP: `netlify/functions/polar-checkout.ts` - Polar integration
- ✅ KEEP: `netlify/functions/polar-webhook.ts` - Polar webhooks
- ✅ KEEP: `netlify/functions/docs-content.mts` - Documentation API
- ✅ KEEP: `netlify/functions/github-app-installation-status.mts`
- ✅ KEEP: `netlify/functions/queue-health-check.ts`
- ✅ KEEP: `netlify/functions/_health-check-queue-event.mts`

#### Shared Libraries & Tests
- ✅ KEEP: `netlify/functions/lib/` - All library files
- ✅ KEEP: `netlify/functions/_shared/` - Shared utilities
- ✅ KEEP: `netlify/functions/__tests__/` - Test files

## Summary

**Files Removed:** 14 files (was 20, but restored 6 backfill functions)
**Files Kept:** ~36 files
**Already Archived:** 2 files removed

## Rationale

1. **Reduce Confusion**: Remove duplicates and migrated functions
2. **Clean Development Environment**: Remove test and experimental files
3. **Maintain Working Functions**: Keep all currently operational endpoints
4. **Prepare for Migration**: Keep the 5 functions identified in #1070 for future migration
5. **Frontend Compatibility**: Keep backfill functions that are actively used by UI components

## Important Discovery

During cleanup, discovered that the frontend `ManualBackfill` component and other UI components
actively use the backfill endpoints. While `supabase/functions/manual-backfill/` exists,
it only handles the trigger functionality. The status checking, cancellation, and event
streaming functions are still required and have been kept.