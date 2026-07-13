# Releasing the desktop app

The desktop app is released **independently of the web app**. It uses its own
`desktop-v*` git tags and its own version number (currently `0.1.0`), and the
web app's semantic-release automation on `v*` tags never touches it.

Pushing a `desktop-v<version>` tag triggers
[`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml),
which builds unsigned macOS (Apple Silicon) and Linux artifacts and publishes
them to a GitHub Release. Distribution is GitHub Releases only.

## Prerequisites

- Push access to the repo (to push the tag).
- For a local build: Rust stable, Node 20+, and on Linux the Tauri system deps
  `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`.
- CI needs the repo secrets `VITE_SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL`
  (already configured — the anon key is public-by-design and gets baked into the
  binary at build time so the shipped app is configured out of the box).

## Steps

1. **Bump the version in lockstep** in both files (they must match):
   - `desktop/package.json` — `"version"`
   - `desktop/src-tauri/tauri.conf.json` — `"version"`

2. **Update the changelog.** In [`CHANGELOG.md`](./CHANGELOG.md), move the
   entries under `## [Unreleased]` into a new `## [<version>] - <YYYY-MM-DD>`
   section and refresh the compare/tag links at the bottom.

3. **Commit** the version bump and changelog:

   ```bash
   git add desktop/package.json desktop/src-tauri/tauri.conf.json desktop/CHANGELOG.md
   git commit -m "chore(desktop): release v<version>"
   ```

4. **Tag and push.** The tag is what triggers the release build:

   ```bash
   git tag desktop-v<version>
   git push origin desktop-v<version>
   ```

5. **Watch the build.** In the Actions tab, the "Desktop Release" workflow runs
   the macOS and Linux jobs and creates the GitHub Release with artifacts
   attached.

6. **Verify** the release has all three bundles:

   ```bash
   gh release view desktop-v<version>
   ```

   Expect a macOS `.dmg`, a Linux `.deb`, and a Linux `.AppImage`.

## Dry run before the real tag

To exercise the build without publishing a release, trigger the workflow
manually with a **blank** tag input (Actions → Desktop Release → Run workflow).
It builds both platforms and uploads the bundles as workflow artifacts instead
of creating a release. To rehearse the publish path, push a throwaway prerelease
tag such as `desktop-v<version>-rc.1`, confirm the release, then delete the tag
and release.

## Local build (fallback / smoke test)

```bash
cd desktop
npm ci
VITE_SUPABASE_ANON_KEY=… VITE_SUPABASE_URL=… npm run tauri build
```

Artifacts land in `desktop/src-tauri/target/release/bundle/` (`.app` + `.dmg` on
macOS, `.deb` + `.AppImage` on Linux). The frontend build (`npm run build` →
`desktop/dist`) runs automatically via the Tauri config's `beforeBuildCommand`.

## Notes

- **Unsigned artifacts.** There is no Apple code signing / notarization and no
  Windows signing. On macOS, first launch requires right-click → **Open** to get
  past Gatekeeper. This is called out in the release notes and the
  [install guide](../docs/user-guide/desktop-app.md).
- **No auto-updater.** The app ships without the Tauri updater, so no signing key
  is required and updates are manual downloads from GitHub Releases.
- **Targets.** The workflow builds macOS Apple Silicon (arm64) and Linux
  (x86_64) only. Intel-mac and Windows builds are intentionally out of scope for
  now; add matrix entries in the workflow if that changes.
