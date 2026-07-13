# Changelog

All notable changes to the contributor.info desktop app are documented in this
file. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This app is versioned and released independently of the web app: its tags use a
`desktop-v*` prefix (e.g. `desktop-v0.1.0`) and this changelog is maintained by
hand. See [RELEASING.md](./RELEASING.md).

## [Unreleased]

## [0.1.0] - 2026-07-12

First public release — contributor.info in your system tray / menu bar.

### 🚀 Features

- **Workspaces-first system tray app** (Tauri v2). Each configured workspace
  gets a submenu with its headline metrics — open/merged PRs, PR velocity and
  average merge time, active/new contributors, open issues, and stars. A
  dashboard window (hidden on close, not quit) manages workspaces and renders
  the same numbers as metric tiles. A Rust core polls every 60s, rebuilds the
  tray menu, and emits a snapshot to the dashboard; every fetch failure degrades
  to a status badge rather than an error.
- **GitHub sign-in for private workspaces** via Supabase's OAuth PKCE flow with
  a one-shot loopback listener on `127.0.0.1:1421`. The user JWT replaces the
  anonymous key on reads, widening access to private workspaces; sessions
  persist to `session.json` (mode 0600) with automatic refresh-token rotation
  and clean fallback to anonymous.
- **Live workspace metrics** sourced from the site's public
  `api-workspace-metrics` endpoint, aggregated on demand from the source tables.

### 🐛 Bug Fixes

- Normalize workspace input: accept a bare slug, a `/i/{slug}` URL, or a value
  with stray slashes, reducing it to the slug the API and deep links expect
  (previously a leading slash produced broken `/i//{slug}` links and failed
  lookups). Period-over-period trend arrows are marked deferred until the
  endpoint recomputes them.

### ♻️ Code Refactoring

- Drop the trending-repositories view from the tray — the app is organized
  around workspaces (teams of repos) only.

[Unreleased]: https://github.com/bdougie/contributor.info/compare/desktop-v0.1.0...HEAD
[0.1.0]: https://github.com/bdougie/contributor.info/releases/tag/desktop-v0.1.0
