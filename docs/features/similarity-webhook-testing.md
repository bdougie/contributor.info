# Webhook-Driven Similarity Testing Guide

**Related:** Issue #833 - Webhook Consolidation & Real-time Similarity Search
**Status:** ✅ Phases 1-5 Completed
**Last Updated:** 2025-01-30

## Overview

This guide covers testing the webhook-driven similarity detection system that automatically generates embeddings and displays similar issues/PRs in the workspace UI.

## Architecture

The webhook-driven similarity system consists of:

1. **GitHub App Webhooks** → Real-time event capture
2. **Background Embedding Generation** → Semantic analysis via OpenAI
3. **Similarity Cache** → Fast lookups with PostgreSQL pgvector
4. **Workspace UI** → Visual sparkle indicators for similar content

## Prerequisites

### Required Infrastructure

- ✅ GitHub App installed on repository
- ✅ Webhook endpoint deployed (Fly.io or Netlify)
- ✅ PostgreSQL with pgvector extension
- ✅ OpenAI API key configured
- ✅ Workspace with tracked repositories

### Required Environment Variables

```bash
# GitHub App
GITHUB_APP_ID=your_app_id
GITHUB_APP_PRIVATE_KEY=your_private_key
GITHUB_WEBHOOK_SECRET=your_webhook_secret

# OpenAI (for embeddings)
OPENAI_API_KEY=your_openai_key

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Test Plan

### Phase 1: GitHub App Installation CTA

**Objective:** Verify the installation prompt appears and works correctly.

#### Test Steps

1. **Navigate to Workspace**
   ```
   Go to: /workspaces/{your-workspace-slug}/prs
   ```

2. **Check CTA Display**
   - **If GitHub App NOT installed:** Blue card should appear at top
   - **If GitHub App IS installed:** Green success card should appear

3. **Verify CTA Content**
   ```
   Expected elements:
   - "Enable Real-time Similarity Search" header
   - Benefits list (10x faster, 100% coverage, etc.)
   - "Install GitHub App" button
   - Link to GitHub App installation page
   ```

4. **Test Installation Flow**
   - Click "Install GitHub App" button
   - Should redirect to: `https://github.com/apps/contributor-info/installations/new`
   - Complete installation for test repository
   - Return to workspace
   - Green success card should now appear

#### Expected Results

| Condition | Expected Display |
|-----------|-----------------|
| No App Installed | Blue CTA card with install button |
| App Installed | Green success card with checkmark |
| No Repositories | No CTA shown |

#### Database Verification

```sql
-- Check if repository is marked as app-enabled
SELECT
  aer.id,
  aer.repository_id,
  aer.enabled_at,
  gai.installation_id,
  gai.suspended_at,
  gai.deleted_at
FROM app_enabled_repositories aer
JOIN github_app_installations gai ON aer.installation_id = gai.id
WHERE aer.repository_id = 'your-repo-id'
  AND gai.deleted_at IS NULL
  AND gai.suspended_at IS NULL;
```

---

### Phase 2: Webhook Event Processing

**Objective:** Verify webhooks fire and embeddings are queued.

#### Test Steps

1. **Enable Webhook Logging**
   ```typescript
   // Set in environment or PostHog
   ENABLE_WEBHOOK_DEBUG=true
   ```

2. **Create Test Issue**
   - Go to GitHub repository
   - Create new issue with descriptive content:
     ```
     Title: "Fix navigation menu bug on mobile devices"
     Body: "The navigation menu doesn't collapse properly on
            mobile screens smaller than 768px. Users report the
            menu overlaps content and is difficult to close."
     ```

3. **Verify Webhook Delivery**
   - Go to: GitHub → Settings → Developer settings → GitHub Apps
   - Select "contributor-info" app
   - Click "Advanced" tab
   - Check "Recent Deliveries"
   - Should see `issues.opened` event with 200 response

4. **Check Database Updates**
   ```sql
   -- Verify issue was stored
   SELECT
     id,
     number,
     title,
     processed_by_webhook,
     webhook_event_id,
     created_at
   FROM issues
   WHERE title ILIKE '%navigation%'
   ORDER BY created_at DESC
   LIMIT 1;

   -- Check if embedding job was queued
   SELECT
     id,
     item_id,
     item_type,
     status,
     priority,
     triggered_by,
     created_at
   FROM embedding_jobs
   WHERE item_type = 'issue'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

5. **Monitor Embedding Generation**
   ```sql
   -- Wait 30-60 seconds, then check similarity cache
   SELECT
     id,
     item_type,
     content_hash,
     embedding_model,
     cache_hit,
     created_at
   FROM similarity_cache
   WHERE item_type = 'issue'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

#### Expected Results

| Step | Expected Outcome | Timing |
|------|------------------|--------|
| Webhook fires | 200 response in GitHub | Immediate |
| Issue stored | Row in `issues` table | < 2 seconds |
| Embedding queued | Row in `embedding_jobs` | < 3 seconds |
| Embedding generated | Row in `similarity_cache` | 30-60 seconds |

#### Troubleshooting

**Webhook not firing:**
```bash
# Check webhook endpoint is accessible
curl -X POST https://your-webhook-endpoint.com/health

# Verify GitHub App webhook URL is correct
# Go to: GitHub App → Settings → Webhook URL
```

**Embedding not generated:**
```sql
-- Check for failed jobs
SELECT
  id,
  item_id,
  status,
  error_message,
  retry_count,
  created_at
FROM embedding_jobs
WHERE status = 'failed'
ORDER BY created_at DESC;
```

---

### Phase 3: Similarity Matching

**Objective:** Verify similar items are detected and cached.

#### Test Steps

1. **Create Similar Issues**
   Create 2-3 issues with related content:

   ```
   Issue #1: "Fix navigation menu bug on mobile devices"
   Issue #2: "Navigation bar not responsive on small screens"
   Issue #3: "Mobile menu overflow causing layout issues"
   ```

2. **Wait for Processing**
   - Allow 2-3 minutes for all embeddings to generate
   - Monitor `embedding_jobs` table for completion

3. **Verify Similarity Scores**
   ```sql
   -- Check if similar items were linked
   SELECT
     source_id,
     target_id,
     similarity_score,
     created_at
   FROM similarity_matches
   WHERE similarity_score >= 0.85
   ORDER BY created_at DESC
   LIMIT 10;
   ```

4. **Test Similarity Function**
   ```sql
   -- Find similar issues for a specific issue
   SELECT * FROM find_similar_issues(
     target_issue_id := 'uuid-of-issue-1',
     limit_count := 5
   );
   ```

#### Expected Results

| Scenario | Expected Similarity Score | Should Match? |
|----------|---------------------------|---------------|
| Nearly identical titles | 92-98% | ✅ Yes |
| Same topic, different words | 85-92% | ✅ Yes |
| Related but distinct | 75-85% | ⚠️ Maybe |
| Unrelated content | < 75% | ❌ No |

---

### Phase 4: Workspace UI Display

**Objective:** Verify sparkle icons appear and similarity dialog works.

#### Test Steps

1. **Navigate to Workspace Issues Tab**
   ```
   Go to: /workspaces/{your-workspace-slug}/issues
   ```

2. **Check for Sparkle Icons**
   - Look for amber/yellow ✨ sparkle icons in rightmost column
   - Icons should only appear for issues with similar matches
   - Hover over icon → Tooltip should say "Similar issues found"

3. **Test Similarity Dialog**
   - Click sparkle icon
   - Dialog should open with:
     - Header: "Similar Issues" with amber sparkle
     - Description showing clicked issue title
     - List of 3-5 similar issues
     - Each item showing:
       - State indicator (green circle = open, purple check = closed)
       - Issue number (e.g., #123)
       - Similarity percentage badge (e.g., "92% match")
       - Issue title
       - Clickable to navigate

4. **Verify Empty State**
   - For issues without similar matches:
     - No sparkle icon should appear
   - If sparkle clicked but cache is empty:
     - Should show "No similar issues found yet" message
     - Should show "Embeddings are being computed in the background"

#### Expected UI States

```typescript
// State 1: Loading similarity check
similarIssuesMap: Map<string, Issue[]> = new Map()
sparkleIcon: hidden

// State 2: Similar issues found
similarIssuesMap: Map<string, Issue[]> = new Map([
  ['issue-uuid-1', [issue2, issue3, issue4]]
])
sparkleIcon: visible for issue-uuid-1

// State 3: Dialog open
dialog: {
  isOpen: true,
  selectedIssue: issue1,
  similarIssues: [issue2, issue3, issue4]
}
```

#### Screenshot Checklist

Capture screenshots for documentation:
- [ ] Blue CTA card (not installed)
- [ ] Green CTA card (installed)
- [ ] Issues table with sparkle icons
- [ ] Similarity dialog open
- [ ] Empty state (no similar issues)

---

### Phase 5: Performance Metrics

**Objective:** Verify system performance meets targets.

#### Test Steps

1. **Check Webhook Metrics**
   ```sql
   SELECT
     event_type,
     COUNT(*) as total_events,
     AVG(processing_time_ms) as avg_processing_time,
     MAX(processing_time_ms) as max_processing_time,
     MIN(processing_time_ms) as min_processing_time
   FROM webhook_metrics
   WHERE timestamp > NOW() - INTERVAL '24 hours'
   GROUP BY event_type;
   ```

2. **Check Embedding Performance**
   ```sql
   SELECT
     item_type,
     COUNT(*) as total_jobs,
     COUNT(*) FILTER (WHERE status = 'completed') as completed,
     COUNT(*) FILTER (WHERE status = 'failed') as failed,
     AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_duration_seconds
   FROM embedding_jobs
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY item_type;
   ```

3. **Check Cache Hit Rate**
   ```sql
   SELECT
     COUNT(*) as total_queries,
     COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
     (COUNT(*) FILTER (WHERE cache_hit = true)::float / COUNT(*)) * 100 as hit_rate_percent
   FROM similarity_cache
   WHERE created_at > NOW() - INTERVAL '24 hours';
   ```

#### Performance Targets

| Metric | Target | Acceptable |
|--------|--------|------------|
| Webhook response time | < 500ms | < 1s |
| Embedding generation | < 60s | < 120s |
| Similarity search (cached) | < 100ms | < 500ms |
| Cache hit rate | > 80% | > 60% |
| Webhook success rate | > 99% | > 95% |

---

## Common Issues & Solutions

### Issue: No sparkle icons appear

**Symptoms:**
- Webhooks firing successfully
- Embeddings generated
- No UI indicators

**Solutions:**
1. Check browser console for errors
2. Verify `similarity_cache` has entries:
   ```sql
   SELECT COUNT(*) FROM similarity_cache
   WHERE repository_id = 'your-repo-id';
   ```
3. Ensure `find_similar_issues` function exists:
   ```sql
   SELECT routine_name FROM information_schema.routines
   WHERE routine_name = 'find_similar_issues';
   ```
4. Clear browser cache and reload

### Issue: Webhooks timing out

**Symptoms:**
- 504 Gateway Timeout errors
- Incomplete database updates

**Solutions:**
1. Check webhook endpoint logs
2. Verify database connection pool isn't exhausted:
   ```sql
   SELECT count(*) FROM pg_stat_activity
   WHERE state = 'active';
   ```
3. Consider increasing function timeout
4. Move heavy processing to background jobs

### Issue: Low similarity scores

**Symptoms:**
- Similar issues not being matched
- All scores < 75%

**Solutions:**
1. Verify embedding model is correct:
   ```sql
   SELECT DISTINCT embedding_model FROM similarity_cache;
   ```
2. Check issue content quality (short titles/bodies may not match well)
3. Review similarity threshold settings
4. Test with more descriptive content

### Issue: High API costs

**Symptoms:**
- Unexpected OpenAI bills
- Many duplicate embeddings

**Solutions:**
1. Check cache hit rate (should be > 80%)
2. Verify content hash deduplication:
   ```sql
   SELECT content_hash, COUNT(*) as duplicates
   FROM similarity_cache
   GROUP BY content_hash
   HAVING COUNT(*) > 1;
   ```
3. Review embedding queue priority logic
4. Consider batching similar requests

---

## PostHog Analytics

Monitor feature adoption and performance:

### Key Events to Track

```typescript
posthog.capture('similarity_sparkle_clicked', {
  issue_id: string,
  workspace_id: string,
  similar_count: number
});

posthog.capture('similarity_dialog_opened', {
  issue_id: string,
  has_similar_issues: boolean
});

posthog.capture('github_app_install_started', {
  repository_id: string,
  source: 'install_cta'
});

posthog.capture('webhook_similarity_computed', {
  issue_id: string,
  similarity_score: number,
  processing_time_ms: number
});
```

### Success Metrics Dashboard

Track these metrics in PostHog:
- GitHub App installation rate (% of workspaces)
- Sparkle icon click-through rate
- Average similarity scores
- Time to first sparkle (from issue creation)
- User engagement with similar issues

---

## Rollout Checklist

Use this checklist when deploying to production:

### Pre-Deployment
- [ ] All 5 phases completed and tested
- [ ] Database migrations applied
- [ ] GitHub App configured and tested
- [ ] Webhook endpoint deployed and healthy
- [ ] OpenAI API key configured
- [ ] PostHog events implemented

### Deployment
- [ ] Deploy with feature flag enabled for 10% of users
- [ ] Monitor error rates and performance
- [ ] Check webhook delivery success rate
- [ ] Verify embedding generation working
- [ ] Test UI in production environment

### Post-Deployment
- [ ] Monitor PostHog for user engagement
- [ ] Check database query performance
- [ ] Review OpenAI API usage and costs
- [ ] Collect user feedback
- [ ] Gradually increase rollout to 100%

### 7-Day Success Criteria
- [ ] > 50% of workspaces have GitHub App installed
- [ ] > 80% webhook success rate
- [ ] < 60s average embedding generation time
- [ ] > 10 sparkle icon clicks per day
- [ ] No critical bugs reported
- [ ] Positive user feedback

---

## Support & Resources

- **Documentation:** [docs/features/similarity-detection.md](./similarity-detection.md)
- **Architecture:** [docs/features/similarity-architecture.md](./similarity-architecture.md)
- **GitHub Issues:** [#833](https://github.com/bdougie/contributor.info/issues/833)
- **PRD:** [tasks/prd-webhook-consolidation-similarity.md](../../tasks/prd-webhook-consolidation-similarity.md)
