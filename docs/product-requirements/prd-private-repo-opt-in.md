# PRD: Private Repository Opt-In via GitHub App

**Status:** Implemented (v1) · **Date:** 2026-07-13

> Implementation notes: phases 1–4 below are built. Sync uses installation
> tokens on the Inngest/Node path (GraphQL sync, PR details/reviews/comments,
> issues, commits). RLS migration: `20260713000000_private_repo_read_protection.sql`.
> Still open: Deno edge functions (`github-sync`, `repository-sync-graphql`)
> remain PAT-only; billing/tier gating (`allows_private_repos`) is NOT enforced
> yet — any user can opt in a repo the app is installed on; Netlify env needs
> `CONTRIBUTOR_APP_ID`/`CONTRIBUTOR_APP_KEY` for installation-token sync.

## Summary

Allow paying users to track private repositories. Authorization and data access ride on the
existing **contributor.info GitHub App installation token** — not on expanding OAuth scopes.
The user proves access by installing the app on the repo; billing entitlement
(`tier_limits.allows_private_repos`) gates who may do it.

## Why the GitHub App (not OAuth `repo` scope)

- Login OAuth is deliberately public-only (`public_repo read:user user:email`,
  `src/hooks/use-github-auth.ts:158`; documented promise in
  `mintlify-docs/features/authentication.mdx:38`). Adding `repo` scope would grant
  contributor.info write access to *all* of a user's private repos and break that promise.
- The app already has what's needed: `contents: read`, `metadata: read`, installation
  webhooks, and per-repo "selected repositories" installs (`app/config/app.ts`).
- Installation tokens are org-scoped, revocable per-repo by the customer, and survive
  the user's session — the right primitive for background sync.
- Install plumbing already exists end-to-end: install button
  (`src/components/features/repository/github-app-install-button.tsx`), installation webhook
  handlers that store private repos (`app/webhooks/installation.ts:222-261`), and tables
  `github_app_installations` + `app_enabled_repositories`
  (`supabase/migrations/20250114000001_github_app_schema.sql`).

## Current blockers (what actually prevents private repos today)

1. **Hard 403** on tracking any private repo:
   `netlify/functions/api-track-repository.mts:338-357`.
2. **All sync uses a shared PAT** (`GITHUB_TOKEN`) or the user's public-scoped
   `provider_token` — never the app installation token:
   - `supabase/functions/github-sync/index.ts:40`
   - `supabase/functions/repository-sync-graphql/index.ts:244`
   - Inngest jobs in `src/lib/inngest/functions/*`
3. **Installation-status endpoint is stubbed**:
   `netlify/functions/github-app-installation-status.mts:51-53` hard-codes
   bdougie/contributor.info.
4. **Feature flag off**: `app/config/app.ts:118` `FEATURES.private_repos = false`.
5. **Public-only assumptions** downstream: metrics cron filters `.eq('is_private', false)`
   (`src/lib/inngest/functions/capture-repository-metrics-cron.ts:66,360`), repo view assumes
   public (`src/components/features/repository/repo-view.tsx:172`), RLS/visibility rules never
   restrict who can *view* a synced private repo.

## Design

### Opt-in flow

1. User (on a tier with `allows_private_repos`) adds a private repo to a workspace.
2. `api-track-repository` sees `private: true` → instead of 403:
   - check entitlement (`subscriptions`/`tier_limits.allows_private_repos`);
   - check `app_enabled_repositories` for an active installation covering the repo;
   - if no installation → return `409 installation_required` with the app install URL
     (`https://github.com/apps/contributor-info/installations/new`); frontend shows the
     existing install button flow.
3. `installation_repositories` webhook (already handled) records the repo; tracking is
   confirmed either by the webhook completing the pending track request or by the user
   retrying (now passing the check).
4. Sync jobs resolve a token per repo: **installation token if the repo is private**
   (via `app_enabled_repositories → github_app_installations.installation_id` →
   `githubAppAuth.getInstallationOctokit()` from `app/lib/auth.ts`), else existing
   PAT path. Centralize this in one `getTokenForRepo(repoId)` helper shared by the
   Supabase edge functions and Inngest jobs.

### Access control for viewing synced private data (critical, net-new)

Syncing is only half the problem — a synced private repo must not be publicly visible:

- Add RLS policies so `repositories` with `is_private = true` (and all child rows:
  PRs, contributors-in-repo, issues, embeddings) are readable only by members of a
  workspace containing that repo.
- Private repos must be excluded from: trending/search/discovery endpoints, sitemaps,
  social cards, public widgets/badges, `not-found.tsx` suggestions, and any
  logged-out API surface.
- Embeddings/similarity services must not leak private issue/PR content across repos
  (`cross_repo_insights` stays off for private repos).

### Revocation

- `installation_repositories.removed` / `installation.deleted` webhooks (already handled in
  `app/webhooks/installation.ts`) must also: disable tracking, and either delete or
  quarantine already-synced private data per the data-retention policy.
- Subscription downgrade (Polar webhook) → private repos become read-disabled, then purged
  after grace period.

### Entitlement mapping

`tier_limits.allows_private_repos` already exists (enterprise = TRUE; free/pro = FALSE,
`supabase/migrations/20250824000001_subscription_system.sql:226-228`). Decide whether the
$99 Team tier (docs/pricing-structure.md says "Private & Public") should map to TRUE — the
seed data and the pricing doc currently disagree.

## Implementation phases

1. **Foundations** — real installation-status lookup (replace the stub with a query on
   `app_enabled_repositories`/`github_app_installations`); `getTokenForRepo()` helper;
   RLS policies for private repos.
2. **Opt-in path** — replace the 403 with entitlement + installation checks and the
   `installation_required` response; frontend wiring in `AddRepositoryModal` /
   `repository-tracking-card` to the existing install button.
3. **Sync via installation tokens** — thread `getTokenForRepo` through
   `github-sync`, `repository-sync-graphql`, and the Inngest capture jobs; remove
   `.eq('is_private', false)` filters where private repos should now participate.
4. **Leak-proofing & lifecycle** — audit public surfaces (widgets, social cards,
   sitemap, trending, search); revocation + downgrade handling; docs update
   (authentication.mdx keeps its "OAuth never sees private repos" promise; the private-repo
   story is explicitly the App).
5. **Flip `FEATURES.private_repos`** for entitled tiers.

## Open questions

- Team vs enterprise tier mapping for `allows_private_repos` (pricing doc vs seed data).
- Rate limits: installation tokens get 5k req/hr *per installation* — likely an improvement
  over the shared PAT, but large-org syncs should be tested.
- Should private repos be workspace-only (no standalone `/owner/repo` page)? Simplest safe
  answer: yes — private repos exist only inside workspaces, which already have membership.
