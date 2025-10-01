# Enable GitHub App Installation CTA for Real-time Similarity Search

## Summary

Enables the GitHub App installation call-to-action (CTA) component in workspace UI, completing issue #833's webhook-driven similarity search feature. Users can now easily install the GitHub App to unlock real-time similarity detection with automatic embedding generation.

## Changes

### UI Components
- ✅ Enabled `GitHubAppInstallCTA` component in workspace Pull Requests tab
- ✅ Enabled `GitHubAppInstallCTA` component in workspace Issues tab
- ✅ Removed TODO comments blocking component usage
- ✅ Added development mode console message for Netlify server requirement

### Documentation
- ✅ Added comprehensive testing guide: `docs/features/similarity-webhook-testing.md`
  - Complete test plan for all 5 phases
  - Database verification queries
  - Performance metrics and targets
  - Troubleshooting guide
  - PostHog analytics tracking

## Why This Matters

**Similarity detection requires webhooks:**
1. GitHub App webhooks fire when issues/PRs are created
2. Embeddings are generated automatically in background
3. Similar items are detected and cached
4. Sparkle icons (✨) appear in workspace UI for issues with similar matches

**Without GitHub App installation:**
- No webhooks = No automatic embedding generation
- No embeddings = No similarity data
- No similarity data = No sparkle icons

## How to Test

### 1. Install GitHub App
1. Navigate to workspace → PRs or Issues tab
2. See blue CTA card at top: "Enable Real-time Similarity Search"
3. Click "Install GitHub App" button
4. Complete installation on GitHub
5. Return to workspace → Should see green success card

### 2. Create Test Issues
Create 2-3 similar issues in your test repository:
```
Issue #1: "Fix navigation menu bug on mobile devices"
Issue #2: "Navigation bar not responsive on small screens"
Issue #3: "Mobile menu overflow causing layout issues"
```

### 3. Wait for Processing
- Webhooks fire automatically (< 2 seconds)
- Embeddings generate in background (30-60 seconds)
- Monitor database:
```sql
-- Check embedding jobs
SELECT * FROM embedding_jobs
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- Check similarity cache
SELECT * FROM similarity_cache
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;
```

### 4. Verify UI
1. Go to workspace → Issues tab
2. Look for ✨ sparkle icons in rightmost column
3. Click sparkle → Dialog shows similar issues with % match scores
4. Verify scores are accurate (similar content should be 85-95%)

## Database Verification

```sql
-- Check if app is installed
SELECT
  aer.id,
  aer.repository_id,
  gai.installation_id
FROM app_enabled_repositories aer
JOIN github_app_installations gai ON aer.installation_id = gai.id
WHERE gai.deleted_at IS NULL;

-- Check recent embeddings
SELECT
  item_type,
  COUNT(*) as total,
  AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_seconds
FROM embedding_jobs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY item_type;
```

## Performance Expectations

| Metric | Target | Acceptable |
|--------|--------|------------|
| Webhook response | < 500ms | < 1s |
| Embedding generation | < 60s | < 120s |
| Similarity search (cached) | < 100ms | < 500ms |
| Cache hit rate | > 80% | > 60% |

## Screenshots

### Before Installation
![Blue CTA prompting user to install](https://placeholder-for-screenshot.com/blue-cta.png)

### After Installation
![Green success card showing app is connected](https://placeholder-for-screenshot.com/green-success.png)

### Sparkle Icons in Issues Table
![Table with amber sparkle icons](https://placeholder-for-screenshot.com/sparkle-icons.png)

### Similarity Dialog
![Dialog showing 3-5 similar issues with match percentages](https://placeholder-for-screenshot.com/similarity-dialog.png)

## Related Work

This PR completes the webhook consolidation and similarity feature (#833):

**Completed Phases:**
- ✅ Phase 0: Shared services & Check Runs
- ✅ Phase 1: Webhook handler refactoring
- ✅ Phase 2: Background embedding processing
- ✅ Phase 3: Real-time similarity updates
- ✅ Phase 4: Event routing with prioritization
- ✅ Phase 5: PostHog monitoring and analytics

**This PR:** UI enablement and testing documentation

## Risk Assessment

**Risk Level:** 🟢 Low

**Mitigations:**
- CTA only appears for workspaces with repositories
- Graceful fallback if GitHub App is not installed
- No changes to existing similarity logic
- Component has been thoroughly tested in development

## Rollout Plan

1. **Deploy to staging** - Verify CTA appears correctly
2. **Test with 1-2 repositories** - Ensure webhooks work end-to-end
3. **Deploy to production** - No feature flag needed (passive UI)
4. **Monitor adoption** - Track installation rate via PostHog
5. **Collect feedback** - Iterate on CTA messaging if needed

## Documentation

- **Testing Guide:** [docs/features/similarity-webhook-testing.md](./docs/features/similarity-webhook-testing.md)
- **Feature Overview:** [docs/features/similarity-detection.md](./docs/features/similarity-detection.md)
- **Architecture:** [docs/features/similarity-architecture.md](./docs/features/similarity-architecture.md)
- **PRD:** [tasks/prd-webhook-consolidation-similarity.md](./tasks/prd-webhook-consolidation-similarity.md)

## Closes

Closes #833 (all phases 0-5 complete)
