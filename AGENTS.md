# contributor.info

React + TypeScript application that visualizes GitHub contributors and their contributions.

## General Rules

When editing code, always verify you are working in the correct repository before making changes. Confirm the repo path if multiple repos are checked out.

## Git Workflow

When working with git, always create a feature branch before committing. Never push directly to main unless explicitly told to.

## Environment Setup

This machine uses fnm (not nvm or nix) for Node.js version management. Run `eval "$(fnm env)"` before any npm/node commands. Go projects may need GOEXPERIMENT flag for tests.

For first-time local development setup, run `npm run setup`. This handles prerequisites, environment files, Supabase, and migrations in one command. Use `npm run setup:verify` to check health and `npm run setup:reset` to start fresh.

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
- `supabase db push` is the canonical migration path; fall back to MCP `apply_migration` only if the CLI can't connect. After applying via MCP, rename the local migration file to match the recorded `version_name` so the local history stays aligned.

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

#### Secrets

- Never inline env variables into scripts. Especially never inline `SUPABASE_*` keys or URLs.
- `VITE_*` is browser-public; everything else is server-only. Service-role keys live exclusively in Netlify functions, Inngest, and edge functions.
- Logging: use `console.log('%s', value)`, never template literals — string interpolation of unsanitized values is a log-injection / format-string vulnerability.

#### RLS mental model

Postgres `OR`s permissive policies. One `USING (true)` clause overrides every stricter policy beside it. Treat any of these as a publicly exploitable bypass when granted to `anon` or `authenticated`:

- `USING (true)` on SELECT / UPDATE / DELETE
- `WITH CHECK (true)` on INSERT / UPDATE
- `qual = 'true'` rows in `pg_policies`

`service_role` has `BYPASSRLS = true` (verified in `pg_roles`). That means:

- Service-role-only policies with `USING (true)` are redundant — drop them, the role still works.
- Any backend that writes via `SUPABASE_SERVICE_ROLE_KEY` is unaffected by tightening or dropping permissive policies. Most `gh-datapipe`, Inngest, and edge-function paths fall here.
- Frontend writes that previously relied on a permissive policy must move through a Netlify function that holds the service-role key (see `netlify/functions/api-track-repository.mts` for the pattern).

#### `public` is the API surface

PostgREST automatically exposes everything in `public` to anyone holding the publishable key. Before adding to `public`, ask whether anon should be able to call/read it.

- **Tables** — must have RLS enabled and a policy that isn't `USING (true)`. New partitions of an RLS'd table must enable RLS themselves and recreate policies; `ENABLE RLS` does not propagate from the parent.
- **Views** — default to SECURITY DEFINER and bypass RLS on underlying tables. Always create with `WITH (security_invoker = true)` so the view respects the caller's context.
- **Materialized views** — can't carry RLS. Either revoke from `anon`/`authenticated` entirely (use service_role for refresh) or wrap in a `security_invoker = true` view that joins to an RLS'd table for filtering. See `workspace_preview_stats_secure` for the wrapper pattern.
- **SECURITY DEFINER functions** — must `SET search_path = public, pg_catalog, pg_temp` (or `''` with fully-qualified bodies) to block search_path shadowing. Validate the caller in the body (`auth.uid() = p_user_id`). REVOKE EXECUTE from `anon`/`authenticated` for anything admin-only, cron-only, or trigger-only.
- **Extensions** — install into `extensions`, not `public`. The `extensions` schema is granted USAGE to all four roles; types and functions resolve normally if you reference them as `extensions.foo`.
- **Storage buckets** — public buckets serve via direct URL and do not need a SELECT policy on `storage.objects`. A broad SELECT policy lets any client `.list()` and enumerate every file. Move admin diagnostic listings server-side.

#### Workflow

- Run `mcp__supabase__get_advisors` with `type: 'security'` after any DDL change. The advisor catalogues `rls_disabled_in_public`, `rls_policy_always_true`, `security_definer_view`, `materialized_view_in_api`, `*_security_definer_function_executable`, `extension_in_public`, `public_bucket_allows_listing`, etc.
- One advisor category per PR keeps blast radius small and rollback simple. Recent precedent: #1788–#1798 each closed a single category.
- Every security PR's test plan re-runs the advisor and confirms the count for that category drops. Include the before/after numbers in the PR body.
- Triage docs for multi-PR efforts live in `docs/security/` (see `security-definer-audit.md` for the rollout pattern).

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
