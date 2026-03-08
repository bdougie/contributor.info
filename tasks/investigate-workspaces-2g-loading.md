# Investigation: Workspaces Can't Load on 2G

## Summary

On 2G networks (~35 Kbps / ~4.4 KB/s, ~2000ms RTT), workspace pages are effectively unusable. The combination of large JS bundles and a serial data-fetching waterfall means users wait 2-3+ minutes before seeing anything meaningful.

## Root Causes

### 1. Critical-path JS is ~400KB gzipped

To render the workspace overview tab, the browser must download:

| Chunk | Gzipped |
|-------|---------|
| `vendor-react-core` | 94.6 KB |
| `vendor-supabase` | 46.0 KB |
| `vendor-recharts` | 33.8 KB |
| `vendor-ui` | 39.0 KB |
| `workspace-page` | 29.8 KB |
| `WorkspaceDashboard` | 32.2 KB |
| `vendor-utils` | 14.4 KB |
| Other required chunks | ~40 KB |
| **Total** | **~330 KB** |

At 2G speeds: **~330 KB / 4.4 KB/s = ~75 seconds** just to download JS.

### 2. Serial data-fetching waterfall in `fetchWorkspace()` (workspace-page.tsx:393-1165)

Once JS loads, `fetchWorkspace()` runs **15+ Supabase queries mostly in sequence**:

```
Phase 1 (serial, blocks everything):
  1. supabase.auth.getUser()
  2. workspaces.select(*)
  3. getAppUserId()
  4. workspace_members.select(*)
  5. app_users.select(...)
  6. workspace_members.select(count)

Phase 2 (serial, needs workspace ID from phase 1):
  7. workspace_repositories.select(*, repositories(...))

Phase 3 (semi-parallel, needs repo IDs from phase 2):
  8. pull_requests.select(...) — NO LIMIT, joins contributors
  9. issues.select(...)        — NO LIMIT, joins contributors + repositories
  10. reviews.select(...)      — NO LIMIT, joins pull_requests + contributors
  11. comments.select(...)     — NO LIMIT, joins pull_requests + contributors

Phase 4 (serial, after phase 3):
  12. github_events_cache — one query PER REPO (loop with Promise.all)
  13. contributors.select(bio) — batch bio lookup
  14. fetchGitHubUserProfile() — up to 10 HTTP calls to GitHub API
  15. abbreviateBios() — LLM call to 4o-mini

Phase 5 (serial, after phase 4):
  16. pull_requests.select(repository_id) — open PR counts, NO LIMIT
  17. issues.select(repository_id)        — open issue counts, NO LIMIT
  18. pull_requests.select(author_id)     — contributor counts, NO LIMIT
```

Each round trip on 2G is ~2-5 seconds. With 18 sequential requests: **~36-90 seconds** of network time.

### 3. No query limits on large tables

Queries 8-11 and 16-18 fetch **all matching rows** without any `LIMIT`. A workspace with 10+ repos could return 10,000+ rows for PRs alone. Response payload could be 1-2 MB.

### 4. GitHub API calls and LLM call block render

- `fetchGitHubUserProfile()` makes up to 10 individual HTTP requests to GitHub's API (line 968)
- `abbreviateBios()` calls OpenAI's 4o-mini to shorten bios (line 987)
- Both are in the critical render path - nothing displays until they complete

### 5. `useIsSlowConnection` exists but isn't used

The codebase has `useOnlineStatus.ts` with 2G detection, and `OfflineNotification.tsx` shows a warning banner, but `workspace-page.tsx` **never checks connection quality** to adapt its behavior.

### 6. SSR hydration re-fetches everything

Edge functions (`ssr-workspace-detail.ts`) pre-render workspace data, but React hydration still calls `fetchWorkspace()`, causing duplicate queries on slow networks.

## Recommendations (prioritized)

### P0: Add query limits and defer non-essential fetches

- Add `.limit(500)` to PR, issue, review, comment queries
- Move bio fetching (phases 4-5) out of the critical path — render workspace first, fetch bios in background
- Move open PR/issue count queries (phase 5) to use Supabase `count: 'exact'` with `head: true` instead of fetching all rows

### P1: Progressive/phased data loading

- Phase 1: Fetch workspace + repos → render skeleton with repo cards immediately
- Phase 2: Fetch PRs + issues in parallel → update metrics
- Phase 3: Fetch reviews, comments, events in background → update activity feed
- Phase 4: Fetch bios on idle → update tooltips

### P2: Network-aware loading

- Check `useIsSlowConnection()` in workspace-page.tsx
- On 2G/slow-2g: skip bio fetching, skip events cache, limit queries to 100 rows, skip recharts (show simple numbers instead)

### P3: Leverage SSR data to skip refetch

- Check for `window.__WORKSPACE_DATA__` before running `fetchWorkspace()`
- If SSR data present, hydrate from it and only fetch fresh metrics in background

### P4: Reduce critical JS bundle

- Lazy-load `vendor-recharts` (33.8 KB gzipped) — show metrics as plain numbers first, load charts after
- Consider whether `vendor-supabase` (46 KB) can be loaded after initial SSR render

## Files involved

- `src/pages/workspace-page.tsx` — main fetch waterfall (lines 393-1165)
- `src/hooks/useOnlineStatus.ts` — existing 2G detection (unused by workspaces)
- `src/components/common/OfflineNotification.tsx` — slow connection warning banner
- `netlify/edge-functions/ssr-workspace-detail.ts` — SSR pre-rendering
- `vite.config.ts` — chunk splitting configuration
