---
name: verify
description: Verify desktop tray changes end-to-end on Linux — local endpoint + live dbusmenu observation, no screenshots needed
---

# Verifying the desktop tray on Linux

Recipe verified 2026-07-18 on Ubuntu GNOME (X11, `DISPLAY=:0`).

## Serve the site endpoint locally (no Netlify login needed)

The Supabase anon key is public-by-design and ships in the site bundle:

```bash
curl -s https://contributor.info/ | grep -oE '/js/index-[^"]+\.js'   # find bundle
curl -s https://contributor.info/js/index-<hash>.js | grep -oE 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' | sort -u
# pick the JWT whose payload has "ref":"egcxzonpmmcirmgqdrla" (not "supabase-demo")
VITE_SUPABASE_ANON_KEY=<key> SUPABASE_URL=https://egcxzonpmmcirmgqdrla.supabase.co \
  npx netlify functions:serve --port 9999   # from repo root, background
curl "http://localhost:9999/.netlify/functions/api-workspace-metrics?slug=<slug>&time_range=90d"
```

Known public workspace for testing: `open-source-repos`. The function has a
120s in-memory cache per `(workspace, time_range)` — vary `time_range` to bypass.

## Run the tray against the local endpoint

`SITE` is compile-time: launch with `VITE_CONTRIBUTOR_SITE=http://localhost:9999`.
Seed config first (documented per-machine key path):

```bash
# ~/.config/info.contributor.desktop/settings.json  (chmod 600)
{ "workspaces": ["open-source-repos"], "time_range": "90d",
  "supabase_url": "https://egcxzonpmmcirmgqdrla.supabase.co",
  "supabase_anon_key": "<key>" }

cd desktop && DISPLAY=:0 VITE_CONTRIBUTOR_SITE=http://localhost:9999 npm run tauri dev
```

## Observe the real tray menu via D-Bus (no screenshot tooling required)

```bash
PID=$(pgrep -f target/debug/contributor-info-desktop | head -1)
busctl --user list | grep $PID       # find :1.XXX connection
busctl --user call :1.XXX /org/ayatana/NotificationItem/tray_icon_tray_app_ci_tray/Menu \
  com.canonical.dbusmenu GetLayout iias 0 -- -1 0     # dumps the live menu tree
```

Labels come out UTF-8-escaped; literal `_` appears doubled (`__`) — that's GTK
mnemonic escaping on the wire, renders as a single underscore on screen.

Click a row for real (fires the app's on_menu_event handler, opens browser):

```bash
busctl --user call ... com.canonical.dbusmenu Event isvu <item-id> "clicked" s "" 0
```

Gotcha: the tray rebuilds its menu every 60s poll and **item ids rotate** —
re-run GetLayout and fire Event immediately after.

## Gotchas

- No `.env` on this machine and no Netlify login; the bundle-extraction path
  above is the way to get env for `functions:serve`.
- The live `issues` table has **no `html_url` column** (unlike `pull_requests`);
  the `github_issues` migration file does not match the live schema.
- gdbus can't pass `-1` positionally; use `busctl` with `--` before negative args.
