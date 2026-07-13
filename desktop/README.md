# contributor.info desktop

contributor.info in your system tray / menu bar — a [RepoBar](https://repobar.app/)-style
glanceable companion, built with Tauri v2. **Workspaces-first**: the tray is
organized around your workspaces (teams of repos), not individual repos.

The tray icon is the pixel plant 🌱. Each configured workspace gets a submenu.
A dashboard window manages workspaces and renders the same numbers as metric
tiles.

**Status:** workspace identity (name + `contributor.info/i/{slug}` link) is
live, and signing in unlocks private workspaces. The per-workspace metric tiles
(open/merged PRs + trend, PR velocity and merge time, active/new contributors,
open issues, stars) are built but not yet populated — the metrics data source
needs wiring up (see [Next steps](#next-steps)). Until then, resolved
workspaces render in a `metrics coming soon` state.

## Where the data comes from

| Data | Source | Status |
| --- | --- | --- |
| Workspace lookup | Supabase REST `workspaces?slug=eq.{slug}` (anon key, or user JWT when signed in) | live |
| Workspace metrics | none yet — see [Next steps](#next-steps) | pending |

RLS lets anonymous clients read **public** workspaces, so workspace identity
resolves with just the anon key. Signing in widens RLS to the workspaces you
own or belong to, including private ones.

Workspace metrics have **no live source**: the old `workspace_metrics_cache`
table was dropped (migration `20260428000007_drop_dead_tables`) and never held
data. The metric-rendering code is in place and reads through
`Supabase::metrics` — wiring that to a real endpoint is the top next step.

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

## Next steps

- **Workspace metrics endpoint** (unblocks the metric tiles): add a public
  `api-workspace-metrics` Netlify function on contributor.info that aggregates
  a workspace's repos server-side (reusing `workspace-aggregation.service.ts`)
  and returns JSON — mirroring the trending function, so no secret ships in the
  client. Then repoint `Supabase::metrics` (the seam in `supabase.rs`) at it.
  The old `workspace_metrics_cache` table is gone, so REST-against-Supabase is
  a dead end for a client with only the anon key.
- **Notifications**: tauri-plugin-notification on metric transitions (open
  PRs jump, contributors trend down, metrics went stale).
- **Repo drill-down**: per-workspace repo list with the site's stat-card SVG
  widgets (`workspace_repositories` is readable once signed in).
- **Keychain storage**: move `session.json` into the OS keychain
  (e.g. the `keyring` crate), matching how RepoBar stores tokens.
- **macOS niceties**: template (monochrome) tray icon variant,
  launch-at-login via tauri-plugin-autostart.
