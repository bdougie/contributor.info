# Inngest Handler Unification Plan

## Overview
This document outlines the plan to consolidate the separate development (`inngest.mts`) and production (`inngest-prod.mts`) handlers into a single unified handler that can handle both environments.

## Benefits
1. **Single source of truth**: Eliminates duplicate code and import path mismatches
2. **Easier maintenance**: Changes only need to be made in one place
3. **Reduced errors**: No more forgetting to update both handlers
4. **Consistent behavior**: Same code runs in all environments

## Migration Steps

### Phase 1: Testing (Current)
- [x] Created `inngest-unified.mts` that combines logic from both handlers
- [x] Environment detection based on multiple signals
- [x] Dynamic configuration based on environment
- [ ] Test in development environment
- [ ] Test in deploy preview
- [ ] Test in production

### Phase 2: Gradual Migration
1. Update `netlify.toml` to add a new route for testing:
   ```toml
   [[redirects]]
     from = "/api/inngest-test"
     to = "/.netlify/functions/inngest-unified"
     status = 200
     force = true
   ```

2. Monitor both endpoints:
   - Existing: `/api/inngest` → `inngest-prod`
   - New: `/api/inngest-test` → `inngest-unified`

3. Compare behavior and logs

### Phase 3: Cutover
1. Update the main redirect:
   ```toml
   [[redirects]]
     from = "/api/inngest"
     to = "/.netlify/functions/inngest-unified"
     status = 200
     force = true
   ```

2. Keep old handlers for rollback capability

3. Monitor for any issues

### Phase 4: Cleanup
1. After stable operation (1-2 weeks):
   - Remove `inngest.mts`
   - Remove `inngest-prod.mts`
   - Remove `inngest-prod-functions.mts`
   - Rename `inngest-unified.mts` to `inngest.mts`

2. Update documentation

## Environment Variables
The unified handler uses intelligent fallbacks:
- Production: Checks `INNGEST_PRODUCTION_*` first, then standard vars
- Development: Uses standard environment variables
- All environments: Falls back to `VITE_*` prefixed variables

## Testing Checklist
- [ ] GET request returns status page
- [ ] Environment detection is correct
- [ ] All functions are registered
- [ ] Test event executes successfully
- [ ] Production signing works
- [ ] Development mode works without signing
- [ ] GitHub token is available
- [ ] Supabase connection works

## Rollback Plan
If issues occur:
1. Revert `netlify.toml` redirect
2. Original handlers remain in place
3. No data loss or downtime

## Monitoring
After deployment:
1. Check `/api/health` endpoint
2. Monitor Inngest dashboard for job execution
3. Check sync_logs table for activity
4. Verify PR/comment capture is working