# Desktop App (Menu Bar / System Tray)

Keep an eye on your workspaces without opening a browser. The contributor.info
desktop app lives in your macOS menu bar or Linux system tray and shows each
workspace's headline metrics — open and merged PRs, PR velocity and merge time,
active and new contributors, open issues, and stars — right from the tray menu.

It's **workspaces-first**: you add the workspaces (teams of repos) you care
about, and each one gets its own submenu. A small dashboard window lets you
manage your workspaces and see the same numbers as tiles.

## Download

Get the latest build from the
[Releases page](https://github.com/bdougie/contributor.info/releases?q=desktop-v)
and pick the file for your platform:

| Platform | File | Notes |
| --- | --- | --- |
| macOS (Apple Silicon, M1 and newer) | `.dmg` | Unsigned — see first-run step below |
| Linux (x86_64) | `.deb` or `.AppImage` | `.deb` for Debian/Ubuntu; `.AppImage` runs anywhere |

> The builds are **unsigned** right now, so your OS will warn you the first time
> you open the app. That's expected — the steps below get you through it.

## Install and first run

### macOS

1. Open the downloaded `.dmg` and drag **contributor.info** to Applications.
2. The first time you launch it, macOS blocks unsigned apps. **Right-click** (or
   Control-click) the app in Applications and choose **Open**, then confirm.
   You only have to do this once.
3. The pixel-plant icon (🌱) appears in your menu bar. Click it to open the menu.

### Linux

- **`.deb`:** `sudo dpkg -i contributor.info_*.deb` (or open it with your
  software installer). You may need the tray dependency
  `libayatana-appindicator3-1` if it isn't already installed.
- **`.AppImage`:** make it executable and run it —
  `chmod +x contributor.info_*.AppImage && ./contributor.info_*.AppImage`.

The tray icon appears in your system tray; click it for the menu.

## Add a workspace

1. Click the tray icon → **Dashboard…**.
2. In the box at the top, paste a workspace slug or its `/i/…` URL from
   contributor.info (for example `my-team` or
   `https://contributor.info/i/my-team`) and click **Add**.
3. Its metrics show up as tiles in the dashboard and as a submenu in the tray.

The app refreshes every 60 seconds. Use **Refresh now** (tray) or the
**Refresh** button (dashboard) to update immediately.

## Sign in for private workspaces

Public workspaces work without signing in. To see your **private** workspaces:

1. Click **Sign in with GitHub** (in the tray menu or the dashboard header).
2. Your browser opens to authorize; approve it, then return to the app.
3. The tray now shows the private workspaces you own or belong to. Your session
   is saved securely and refreshes automatically; **Sign out** clears it.

## Troubleshooting

| What you see | What it means | What to do |
| --- | --- | --- |
| **"unconfigured"** | The app was built without its access key | Download an official release from the Releases page (dev builds may omit the key) |
| **"not found (private?)"** | The workspace slug didn't resolve | Check the slug; if it's a private workspace, sign in with GitHub |
| **"metrics unavailable"** | Metrics haven't been computed yet | Try again shortly, or open the workspace on the site to warm it up |
| **"offline"** | The app couldn't reach contributor.info | Check your internet connection |
| macOS won't open the app | It's unsigned | Right-click the app → **Open** (see first-run step above) |
| No tray icon on Linux | Missing tray support | Install `libayatana-appindicator3-1` and relaunch |

## Related

- Feature overview: [Desktop Tray App](../features/desktop-tray-app.md)
- For developers: [`desktop/README.md`](../../desktop/README.md) and
  [`desktop/RELEASING.md`](../../desktop/RELEASING.md)
