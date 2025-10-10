# ⚠️ IMPORTANT: Migration Verification Required

After reviewing the Supabase functions directory, I need to clarify the migration status:

## ✅ Confirmed Migrations
- **inngest-prod** → `supabase/functions/inngest-prod/` ✅
- **github-webhook** → Fly.io (per documentation) ✅
- **queue-event** → `supabase/functions/queue-event/` ✅

## ⚠️ Partially Migrated - May Need Additional Work
- **backfill-trigger** → `supabase/functions/manual-backfill/` ✅ (main trigger functionality)
- **backfill-status** → ❌ NOT found in Supabase (checks job status)
- **backfill-cancel** → ❌ NOT found in Supabase (cancels running jobs)
- **backfill-events** → ❌ NOT found in Supabase (event handling)
- **backfill-events-proxy** → ❌ NOT found in Supabase (proxy for events)
- **webhook-backfill-complete** → ❌ NOT found in Supabase (completion webhook)

The `manual-backfill` function only handles triggering backfills, not status checking, cancellation, or completion webhooks.

## ✅ Test/Duplicate Files (Safe to Remove)
- All inngest variations (test, simple, local-full, hybrid, unified) - test/experimental versions
- `api-test-reviewers.mts` - test endpoint
- `test.mts` - test file
- `validate-repository.ts.backup` - backup file

## ⚠️ Possibly Still Needed
- **api-repository-status.js** - No direct Supabase equivalent found
- **api-discover-repository.js** - Duplicate of .mjs, but no Supabase migration found

## 🔄 Recommendation

Before merging this PR, we should:

1. **EITHER** restore the backfill management functions (status, cancel, events, events-proxy, webhook-complete) until they're properly migrated
2. **OR** confirm these endpoints are no longer being called by the frontend/other services

The main `backfill-trigger` functionality exists in Supabase, but the supporting operations (status checks, cancellation) appear to be missing.

## Frontend Impact Check Needed

Please verify:
- Are any UI components calling `/api/backfill/status/{job_id}`?
- Are any UI components calling `/api/backfill/cancel/{job_id}`?
- Is the backfill completion webhook still needed?

If these endpoints are still in use, we should keep them until proper Supabase equivalents are created.