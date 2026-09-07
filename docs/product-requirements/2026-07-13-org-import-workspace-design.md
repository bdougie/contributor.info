# Org Import into Workspace — Design

**Date:** 2026-07-13
**Status:** Approved

## Problem

Adding an organization's repositories (e.g. `papercomputeco`, `pcc-labs`) to a workspace currently requires searching and adding each repo one at a time. Users need a way to opt in an org's repos in one action.

## Decisions

- **Sync model:** One-time bulk import. New repos added to the org later are added manually. No workspace↔org link is stored.
- **Entry point:** A new "Import from org" mode inside the existing `AddRepositoryModal`.
- **Limits:** Selection is capped at the workspace's remaining `max_repositories` slots; the most recently active repos are pre-selected. An upgrade notice appears when the org doesn't fit.
- **Repo scope:** Public and private repos. Private repos are listed when the user's GitHub session can see them; tracking a private repo still requires the org to have the contributor.info GitHub App installed (existing `app_installation_required` flow).
- **Backend:** Extend the existing flow (client-orchestrated). No new endpoint, no background job.

## UI: AddRepositoryModal

`src/components/features/workspace/AddRepositoryModal.tsx`

- Add a tab/toggle: **Search** (existing) | **Import from org**.
- Org mode: org-name input → fetch repos → checkbox list showing name, private/public badge, stars, last-pushed date. Sorted by most recently pushed.
- Forks and archived repos are hidden behind a "show forks/archived" toggle (off by default).
- Repos already in the workspace render disabled with an "already added" state.
- Private repos in orgs without the GitHub App installed render greyed-out with an "Install GitHub App" link — visible but not selectable.
- Default selection: all eligible repos, capped at remaining slots (most recently active first). Counter: "N of M selected — workspace has K slots left", with the existing upgrade CTA when capped.
- Selected repos feed the existing staging cart, merging with search-picked repos into one submit flow.

## Data fetching: org repo list

Extend `src/hooks/use-org-repos.ts` (or add a sibling `useOrgReposForImport`):

- Paginate `octokit.rest.repos.listForOrg` (currently `per_page: 30`, no pagination) up to a ceiling of 200 repos.
- Authenticate Octokit with the user's GitHub session token when available so private repos the user can see are listed; anonymous fallback lists public repos only, with a sign-in hint.
- Cross-reference `github_app_installations` for the org to flag which private repos are trackable.
- Cross-reference the workspace's current repos to flag "already added".

## Backend / services

New `WorkspaceService.addRepositoriesToWorkspace(workspaceId, userId, repositoryIds[])` in `src/services/workspace.service.ts`:

- One permission check (same roles as single add).
- One limit check: current count + requested ≤ `workspace.max_repositories`. The DB trigger (`maintain_repository_count`) remains the backstop; a trigger rejection surfaces as a clear "workspace is full" error.
- One bulk insert into `workspace_repositories` (skipping duplicates).
- One `current_repository_count` resync.
- One `workspace/priorities.sync` and one `workspace.repository.changed` Inngest event for the whole batch (instead of N each).

Tracking stays per-repo: the modal's submit calls the existing `trackAndResolveRepository()` → `/api/track-repository` for each staged repo, with a concurrency pool of 3–4 instead of the current serial loop. App-installation checks and sync-event dispatch stay in `netlify/functions/api-track-repository.mts`, untouched.

## Error handling

- Org not found / GitHub rate limit → inline error in the org tab.
- Partial failure on submit: repos that fail tracking are reported ("3 added, 1 failed: repo-x — app installation required"); successfully tracked repos are still added to the workspace.
- Limit race (concurrent adds by another member): the bulk service re-checks the count at insert time and returns "workspace is full"; the DB trigger is the final guard.

## Testing

Vitest unit tests (per `docs/testing/BULLETPROOF_TESTING_GUIDELINES.md`):

- `addRepositoriesToWorkspace`: permission denial, duplicate skipping, limit math (exact fit, overflow, race re-check), event dispatch (one batch event).
- Org repo hook: pagination, fork/archived filtering, already-in-workspace and app-not-installed flagging.
- Component test for the org tab: selection cap, pre-selection ordering, disabled states.

No e2e tests.

## Out of scope

- Auto-sync of new org repos (no workspace↔org link is stored; can be layered on later).
- Tier-limit changes. Note: three inconsistent tier-limit constants exist (DB migration: free=10/pro=50/private=999; `workspace-permissions.service.ts`: free=3/pro=50/team=3; `AddRepositoryModal.tsx` `TIER_LIMITS`: free=4/pro=10/enterprise=100). Actual enforcement uses `workspaces.max_repositories`. Only the modal constant is touched if needed; reconciling the three is a separate cleanup.
- Server-side bulk import endpoint or Inngest background import job.
