# contributor.info desktop

contributor.info in your system tray / menu bar — a [RepoBar](https://repobar.app/)-style
glanceable companion, built with Tauri v2. **Workspaces-first**: the tray
surfaces your workspaces' aggregated team metrics, not individual repos.

The tray icon is the pixel plant 🌱. Each configured workspace gets a submenu
with its headline metrics (open/merged PRs + trend, PR velocity and merge
time, active/new contributors, open issues, stars), and the menu also carries
the site's 24h trending movers. A dashboard window manages workspaces and
renders the same numbers as metric tiles.

## Where the data comes from

| Data | Source |
| --- | --- |
| Workspace lookup | Supabase REST `workspaces?slug=eq.{slug}` (anon key) |
| Workspace metrics | Supabase REST `workspace_metrics_cache?workspace_id=eq.{id}&time_range=eq.7d` |
| Trending movers (24h) | `GET https://contributor.info/api/trending-repositories?period=24h&limit=5` |

RLS lets anonymous clients read **public** workspaces and their metrics cache
(one row per workspace + time range, refreshed by the site's aggregation
cron). Private workspaces resolve to `not found` until login lands — that
needs Supabase GitHub OAuth + a user JWT, and is the top follow-up.

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

- **Login for private workspaces**: Supabase GitHub OAuth via deep link
  (`tauri-plugin-deep-link`), store the session, send the user JWT instead of
  the anon key — RLS then scopes to workspace membership, unlocking private
  workspaces and repo lists (`workspace_repositories` requires a logged-in
  user even for public workspaces).
- **Notifications**: tauri-plugin-notification on metric transitions (open
  PRs jump, contributors trend down, metrics went stale).
- **Repo drill-down**: per-workspace repo list with the site's stat-card SVG
  widgets once authed.
- **macOS niceties**: template (monochrome) tray icon variant,
  launch-at-login via tauri-plugin-autostart.
