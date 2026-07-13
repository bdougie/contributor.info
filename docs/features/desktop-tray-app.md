# Desktop Tray App

## Overview

`desktop/` contains a system tray / menu bar companion app (inspired by
[RepoBar](https://repobar.app/)) built with Tauri v2. It is **workspaces-first**:
the tray surfaces each configured workspace's aggregated team metrics at a
glance, without opening the site. The tray icon is the pixel plant 🌱,
generated from `public/plant_pixel_coarse.svg`.

## Feature Behavior

### Tray menu

- One submenu per configured workspace, titled with the workspace name and
  its open-PR count. Inside: an "Open in contributor.info ↗" action
  (deep-links to `/i/{slug}`) and read-only metric lines — open/merged PRs
  with trend vs the previous period, PR velocity (PRs/day) and average hours
  to merge, active/new contributors with trend, open issues, and stars.
- Dashboard…, Refresh now, and Quit actions. The tooltip summarizes
  workspaces and total open PRs.

### Dashboard window

A small always-available webview (React + Vite, hidden on close rather than
quit) for managing which workspaces appear in the tray — add by slug or
`/i/…` URL — and for viewing the same metrics as tiles with trend arrows.

### Degradation

Every fetch failure maps to a status, never an error: `not_found` (usually a
private workspace, pending login support), `no_metrics` (aggregation hasn't
run), `unconfigured` (no anon key), `unreachable` (offline).

## Implementation Details

### Architecture

- **Rust core** (`desktop/src-tauri/src/`): `lib.rs` owns the tray, a 60s
  poll loop, and the IPC commands (`get_snapshot`, `get_workspaces`,
  `set_workspaces`, `refresh_now`). Each poll stores a `Snapshot` in managed
  state, rebuilds the tray menu, and emits a `snapshot` event that the
  dashboard listens to. `supabase.rs` is a minimal Supabase REST reader;
  `settings.rs` persists workspace slugs, time range, and Supabase overrides
  to `settings.json` in the app config dir.
- **Frontend** (`desktop/src/`): one-page React app; talks to the core only
  via Tauri `invoke`/events, so all network access stays in Rust.

### Data sources

| Data | Source |
| --- | --- |
| Workspace lookup | Supabase REST `workspaces?slug=eq.{slug}` |
| Workspace metrics | Supabase REST `workspace_metrics_cache?workspace_id=eq.{id}&time_range=eq.{7d\|30d\|…}` |

RLS permits anonymous reads of public workspaces and their metrics cache
(policies in `supabase/migrations/20250827000000_workspace_metrics_cache.sql`),
so the app works with just the public anon key. Note that
`workspace_repositories` requires a logged-in user even for public
workspaces, which is why the tray shows workspace-level metrics only for now.

### Keys

No secrets live in the repo. The public Supabase anon key is baked at build
time from `VITE_SUPABASE_ANON_KEY` (the same env var the site build uses) or
set per-machine in `settings.json`. Without a key the tray reports
`unconfigured`.

## Build & Develop

Prereqs: Rust stable, Node 20+; on Linux also
`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`.

```bash
cd desktop
npm install
VITE_SUPABASE_ANON_KEY=… npm run tauri dev
VITE_SUPABASE_ANON_KEY=… npm run tauri build   # .app/.dmg on macOS, .deb/.AppImage on Linux
```

## Future Work

1. **Login for private workspaces** — Supabase GitHub OAuth via deep link
   (`tauri-plugin-deep-link`); a user JWT makes RLS scope to workspace
   membership, unlocking private workspaces and per-repo drill-down.
2. **Notifications** — `tauri-plugin-notification` on metric transitions
   (open-PR spikes, contributor trend drops, stale metrics).
3. **Repo drill-down** — per-workspace repo list rendering the existing
   stat-card SVG widgets.
4. **macOS polish** — template (monochrome) tray icon variant and
   launch-at-login via `tauri-plugin-autostart`.
