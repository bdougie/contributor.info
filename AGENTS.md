# contributor.info

React + TypeScript application that visualizes GitHub contributors and their contributions.

## General Rules

When editing code, always verify you are working in the correct repository before making changes. Confirm the repo path if multiple repos are checked out.

## Git Workflow

When working with git, always create a feature branch before committing. Never push directly to main unless explicitly told to.

## Environment Setup

This machine uses fnm (not nvm or nix) for Node.js version management. Run `eval "$(fnm env)"` before any npm/node commands. Go projects may need GOEXPERIMENT flag for tests.

## Code Review

When asked to "review a PR", read the PR description, comments, and diff first. Do not immediately try to build/test or check merge conflicts unless asked.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (database, auth, RLS)
- **Design**: Figma for collaboration and component documentation

### Key Directories

- `src/lib/supabase.ts` — Supabase client configuration
- `src/lib/progressive-capture/` — Background data processing and notifications
- `supabase/migrations/` — Database schema migrations
- `docs/` — Postmortems and reference docs
- `mintlify-docs/` — Public documentation site (Mintlify)
- `scripts/` — Documented, organized utility scripts

### Supabase

- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- RLS allows public read access — first search works without login
- MCP server configured in `.mcp.json` for direct database access
- Use Supabase Dashboard SQL Editor when Docker isn't running

## Repository Tracking

The application uses a **manual, user-initiated** repository tracking system:
- Users explicitly choose which repositories to track via "Track This Repository" button
- No automatic discovery or tracking happens without user action
- Untracked repositories show a tracking card instead of errors

## User Experience

This project follows an **invisible, Netflix-like user experience**:

1. **Database-first** — query cached data before API calls
2. **Auto-detection** — detect and fix data quality issues automatically
3. **Subtle notifications** — inform users without interrupting workflow
4. **Progressive enhancement** — core functionality works immediately, enhanced features load in background
5. **No manual intervention** — users never need to click "Load Data"

### Key UX Files
- `src/lib/progressive-capture/smart-notifications.ts` — auto-detection on page load
- `src/lib/progressive-capture/background-processor.ts` — invisible background work
- `src/lib/progressive-capture/ui-notifications.ts` — user-friendly notifications
- `/docs/user-experience/feature-template.md` — UX pattern template
- `/docs/user-experience/implementation-checklist.md` — auto-detection integration guide

## Contributing

### Code Style

- TypeScript with proper interfaces/types — no `any` or `unknown` as lazy fixes
- ES modules only — no `require()` calls
- Vitest for testing — never jest
- Bulletproof testing practices: `/docs/testing/BULLETPROOF_TESTING_GUIDELINES.md`
- Match the existing design language for all components
- Use `console.log('%s', owner)` not template literals for logging (security)

### Data & Security

- Never write env variables inline into scripts
- Use the Supabase MCP server for migrations
- RLS policies are critical — public read access, authenticated write

### Public Docs Site

Published docs live at `https://docs.contributor.info` (Mintlify). Source files are in `mintlify-docs/`.

When linking to docs pages, use the slug from `mintlify-docs/` — **not** the app route. For example:
- Docs: `https://docs.contributor.info/features/contributor-of-month` (matches `mintlify-docs/features/contributor-of-month.mdx`)
- App: `https://contributor.info/continuedev/continue` (matches route `/:owner/:repo`)

The app does **not** use a `/repo/` prefix in its routes. Routes are `/:owner/:repo`, `/:owner/:repo/health`, etc.

### Quality Standards

- Run `npm run build` before submitting — checks types and builds production bundle
- If you touch a file, improve it — don't just disable linters
- After visual changes, look for performance improvement opportunities
- No premature optimizations without testing
- E2e tests only when necessary
- Delete one-time-use scripts that are not referenced anywhere
