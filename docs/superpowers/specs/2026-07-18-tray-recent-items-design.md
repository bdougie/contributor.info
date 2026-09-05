# Desktop tray: recent PRs and issues in the dropdown

**Date:** 2026-07-18
**Status:** Approved
**Inspiration:** [RepoBar](https://github.com/steipete/RepoBar)'s clickable
recent-item rows — the tray moves from read-only aggregate stats to actionable
details.

## Goal

Each workspace submenu in the desktop tray (`desktop/`) gains two clickable
sections — **Recent PRs** and **Recent Issues** — listing the newest open items
across the workspace's repositories. Clicking a row opens the item **on
GitHub** in the default browser.

## Non-goals

- Dashboard-window tiles for these lists (tray menu only).
- CI status, per-repo drill-down, trend restoration, release/changelog
  previews (remain in the documented follow-ups).
- Window-scoping recent items by `time_range` — an open PR from two months
  ago is still actionable, so recency is by `created_at` regardless of the
  selected metrics window.

## Design

### 1. API — `netlify/functions/api-workspace-metrics.mts`

Add two small queries alongside the existing aggregation (not a widening of
the paginated aggregate scan):

- Newest **5 open PRs** and newest **5 open issues** across the workspace's
  `repository_id`s, ordered `created_at` desc.
- Columns: `number, title, html_url, created_at`, author username via the
  `contributors` relationship, and repository name.

Response gains two additive arrays (existing consumers unaffected):

```json
"recent_open_prs":    [{ "number", "title", "url", "author", "repo", "created_at" }],
"recent_open_issues": [{ "number", "title", "url", "author", "repo", "created_at" }]
```

Same 120s in-memory cache entry, same public-workspace-only visibility rule
(403 for private stays as is).

### 2. Tray — `desktop/src-tauri/`

- `supabase.rs`: `WorkspaceMetrics` gains `recent_open_prs` /
  `recent_open_issues` (`Vec<RecentItem>`) with `#[serde(default)]` so an
  older deployed endpoint (missing fields) parses cleanly.
- `lib.rs` `build_menu`: after the metric lines in each workspace submenu:
  separator → disabled `Recent PRs` header → up to 5 enabled rows →
  separator → disabled `Recent Issues` header → up to 5 enabled rows.
  Sections are omitted entirely when their array is empty.
- Row format: `#1824 Truncated title… · author` (titles truncated to ~50
  chars on a char boundary).
- Row menu ids: `open-url:{url}`. The existing tray click handler gains a
  prefix match that opens the URL with the opener plugin (same mechanism as
  "Open in contributor.info ↗").

### 3. Error handling

Missing or empty arrays render nothing; all existing degradation states
(`not_found`, `no_metrics`, `unconfigured`, `unreachable`) are untouched.
Endpoint failures on the new queries must not break the metrics payload —
if the recent-item queries fail, return empty arrays and still serve metrics.

### 4. Testing & verification

- Vitest: endpoint returns the new arrays with the expected shape and
  falls back to empty arrays on query failure.
- Rust unit test: title truncation and row formatting.
- Live verification on Linux: `npm run tauri dev` against local
  `netlify dev`, confirm rows render and clicking opens the browser.
- Docs: update `desktop/README.md` data table and
  `docs/features/desktop-tray-app.md`.
