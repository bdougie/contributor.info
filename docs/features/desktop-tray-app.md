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
- An account section: **Sign in with GitHub…** when anonymous, or
  "Signed in as {user}" plus **Sign out** when authenticated.
- Dashboard…, Refresh now, and Quit actions. The tooltip summarizes
  workspaces and total open PRs.

### Dashboard window

A small always-available webview (React + Vite, hidden on close rather than
quit) for managing which workspaces appear in the tray — add by slug or
`/i/…` URL — and for viewing the same metrics as tiles with trend arrows.
The header carries the same sign-in/sign-out control as the tray menu and
surfaces sign-in errors inline.

### Login (private workspaces)

Supabase GitHub OAuth using the **PKCE flow with a loopback listener**
(`desktop/src-tauri/src/auth.rs`):

1. The app binds a one-shot HTTP listener on `127.0.0.1:1421` and opens the
   browser at GoTrue's `/authorize` with a SHA-256 code challenge.
2. After GitHub, Supabase redirects to `http://localhost:1421/callback?code=…`;
   the listener replies with a small "return to the app" page.
3. The app exchanges code + verifier at `/auth/v1/token?grant_type=pkce`.

The resulting user JWT replaces the anon key in the `Authorization` header on
REST reads, so RLS widens from public workspaces to everything the user owns
or is a member of — including private workspaces. Sessions persist to
`session.json` (mode 0600) in the app config dir; the poll loop refreshes the
access token when it is within 5 minutes of expiry (GoTrue rotates refresh
tokens on every use), and a rejected refresh drops cleanly back to anonymous.

**One-time project setup**: `http://localhost:1421/callback` must be added to
Authentication → URL Configuration → Redirect URLs in the Supabase dashboard;
otherwise GoTrue redirects the OAuth callback to the site URL instead of the
loopback listener.

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
| Workspace metrics | Site endpoint `GET /.netlify/functions/api-workspace-metrics?workspace_id={id}&time_range={7d\|30d\|…}` |

RLS permits anonymous reads of public workspaces, so workspace identity resolves
with just the anon key; signing in extends reads to the private workspaces the
user owns or belongs to. Metrics no longer come from a cache table — the
`workspace_metrics_cache` table was dropped (migration
`20260428000007_drop_dead_tables`) and the `api-workspace-metrics` endpoint now
aggregates the numbers on demand from the source tables (PRs, issues,
contributors, stars). The endpoint currently serves **public** workspaces only;
private-workspace metrics and period-over-period trends are follow-ups. Note that
`workspace_repositories` requires a logged-in user even for public workspaces, so
per-repo drill-down is only possible once signed in.

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

## Releases

Releases are cut independently of the web app on `desktop-v*` tags. Pushing such
a tag runs `.github/workflows/desktop-release.yml`, which builds unsigned macOS
(Apple Silicon) and Linux artifacts and publishes them to a GitHub Release. See
`desktop/RELEASING.md` for the runbook and `desktop/CHANGELOG.md` for history.

## Future Work

1. **Notifications** — `tauri-plugin-notification` on metric transitions
   (open-PR spikes, contributor trend drops, stale metrics).
2. **Repo drill-down** — per-workspace repo list rendering the existing
   stat-card SVG widgets (readable once signed in).
3. **Keychain storage** — move `session.json` into the OS keychain
   (`keyring` crate).
4. **macOS polish** — template (monochrome) tray icon variant and
   launch-at-login via `tauri-plugin-autostart`.
