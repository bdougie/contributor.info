# contributor.info desktop

contributor.info in your system tray / menu bar — a [RepoBar](https://repobar.app/)-style
glanceable companion, built with Tauri v2. **Workspaces-first**: the tray is
organized around your workspaces (teams of repos), not individual repos.

The tray icon is the pixel plant 🌱. Each configured workspace gets a submenu
with its headline metrics (open/merged PRs, PR velocity and merge time,
active/new contributors, open issues, stars) plus clickable **Recent PRs** and
**Recent Issues** rows — the newest open items across the workspace's repos,
deep-linking to GitHub. A dashboard window manages workspaces and renders the
same numbers as metric tiles.

## Install

Grab the latest build from the
[GitHub Releases](https://github.com/bdougie/contributor.info/releases?q=desktop-v)
page (filter for `desktop-v*`). Builds are **unsigned** for now.

- **macOS (Apple Silicon):** download the `.dmg`, open it, and drag the app to
  Applications. On first launch, right-click the app and choose **Open** to get
  past Gatekeeper (only needed once, because the build isn't notarized).
- **Linux (x86_64):** install the `.deb` (`sudo dpkg -i contributor.info_*.deb`),
  or `chmod +x` the `.AppImage` and run it.

Once running, click the tray icon → **Dashboard…**, add a workspace by its slug
or `/i/…` URL, and (for private workspaces) **Sign in with GitHub**. The
end-user walkthrough lives in
[docs/user-guide/desktop-app.md](../docs/user-guide/desktop-app.md).

## Where the data comes from

| Data | Source | Status |
| --- | --- | --- |
| Workspace lookup | Supabase REST `workspaces?slug=eq.{slug}` (anon key, or user JWT when signed in) | live |
| Workspace metrics | `GET https://contributor.info/.netlify/functions/api-workspace-metrics?workspace_id={id}&time_range={range}` | live |
| Recent open PRs/issues | Same endpoint — additive `recent_open_prs` / `recent_open_issues` arrays (5 newest open items each, not scoped to `time_range`) | live |

RLS lets anonymous clients read **public** workspaces, so workspace identity
resolves with just the anon key. Signing in widens RLS to the workspaces you
own or belong to, including private ones.

Workspace metrics come from the site's public `api-workspace-metrics` endpoint,
which aggregates them on demand from the source tables (PRs, issues,
contributors, stars) — the old `workspace_metrics_cache` table was dropped
(migration `20260428000007_drop_dead_tables`) and never held data. The endpoint
serves **public** workspaces only; private-workspace metrics (passing the user
JWT) and period-over-period trends are follow-ups (see [Next steps](#next-steps)).

## Sign in (private workspaces)

"Sign in with GitHub" (tray menu or dashboard) runs Supabase's OAuth PKCE
flow with a one-shot loopback listener: the app binds `127.0.0.1:1421`,
opens the browser at GoTrue's `/authorize`, and exchanges the returned code
for a session. The user JWT then replaces the anon key on REST reads, and
sessions persist to `session.json` (0600) in the app config dir with
automatic refresh-token rotation; failing refresh drops cleanly back to
anonymous.

**One-time Supabase setup**: add `http://localhost:1421/callback` to
Authentication → URL Configuration → Redirect URLs in the Supabase
dashboard, or GoTrue will bounce the callback to the site URL instead.

The Rust core polls every 60s, rebuilds the tray menu from the snapshot, and
emits a `snapshot` event the dashboard listens to. Fetch failures degrade to
a status badge — the tray never errors out. Settings (workspace slugs, time
range, Supabase overrides) persist to `settings.json` in the app config dir.

## Keys

No secrets ship in this repo. The Supabase **anon key** (public-by-design,
same one the web app embeds) is picked up at build time from
`VITE_SUPABASE_ANON_KEY` — the same env var the site build uses — or can be
set per-machine in `settings.json` as `supabase_anon_key`. Without it, the
tray shows `unconfigured`. `VITE_SUPABASE_URL` overrides the default project
URL the same way.

## Develop

Prereqs: Rust stable, Node 20+, and on Linux the Tauri system deps
(`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`).

```bash
cd desktop
npm install
VITE_SUPABASE_ANON_KEY=… npm run tauri dev     # run with hot reload
VITE_SUPABASE_ANON_KEY=… npm run tauri build   # .app/.dmg on macOS, .deb/.AppImage on Linux
```

Icons are generated from `public/plant_pixel_coarse.svg`:

```bash
npx tauri icon ../public/plant_pixel_coarse.svg
```

## Releasing

Releases are cut independently of the web app, on `desktop-v*` tags. Pushing a
`desktop-v<version>` tag runs the
[Desktop Release workflow](../.github/workflows/desktop-release.yml), which
builds unsigned macOS + Linux artifacts and publishes them to a GitHub Release.
See [RELEASING.md](./RELEASING.md) for the full runbook and
[CHANGELOG.md](./CHANGELOG.md) for the release history.

## Next steps

- **Metric trends**: the `api-workspace-metrics` endpoint returns null trend
  fields (`stars_trend`, `prs_trend`, `contributors_trend`) — the history table
  they were derived from was dropped. Recompute period-over-period deltas in the
  endpoint (compare against the previous window) to restore the ▲/▼ arrows.
- **Private-workspace metrics**: the endpoint serves public workspaces only.
  Accept the user JWT and verify workspace membership so signed-in users see
  metrics for their private workspaces.
- **Notifications**: tauri-plugin-notification on metric transitions (open
  PRs jump, contributors trend down, metrics went stale).
- **Repo drill-down**: per-workspace repo list with the site's stat-card SVG
  widgets (`workspace_repositories` is readable once signed in).
- **Keychain storage**: move `session.json` into the OS keychain
  (e.g. the `keyring` crate), matching how RepoBar stores tokens.
- **macOS niceties**: template (monochrome) tray icon variant,
  launch-at-login via tauri-plugin-autostart.
