# Paper Compute workspace capture audit

## September 5: GitHub-backed My Work

The workspace overview now uses `GitHubMyWorkCard` and
`useGitHubWorkspaceWork`, not the stored activity queue. Supabase still supplies
workspace membership and the signed-in session, but no Supabase activity rows
are queried by this card. The legacy queue fetch is disabled in the workspace
page; other tabs and their response tooling retain their existing behavior.

The card uses the current session's GitHub provider token only, sent in an
Authorization header directly to `api.github.com`. There is no shared-token
fallback, token copy, separate token store, service-role credential, or database
write. The initial separate reconnect UI was removed after review of the existing
authentication docs: normal Supabase sign-in supplies GitHub authorization.
The callback handler no longer rebuilds and discards provider fields; the shared
auth storage retains them across refreshes of the same login session. See
`docs/authentication/deploy-preview-setup.md` for the implementation and limits.

Four independent searches fetch open `review-requested:@me`, authored PRs,
assigned issues, and `involves:@me` reply candidates. Every query is scoped to the visible workspace repository
names, batches scope qualifiers within GitHub's search length limit, and
paginates results. Team review requests are resolved by GitHub's search semantics,
not by assigning every team request to every workspace member. Results are
deduplicated, retain their category labels, and have no creation-age cutoff.
The default Priority view puts suggested replies first, then review requests.
Reply candidates are checked against current GitHub comments and unresolved review
threads; bot-only activity and conversations last answered by the viewer are excluded.
Repository owner logos and linked comment previews identify each conversation.
Discussion history remains outside this view. See `docs/features/my-work-dashboard.md`
for the reply heuristic and inspection limits.

A separate in-memory React Query client keeps personal results out of the app's
persisted offline cache. Query keys include the user, workspace, repository scope,
and category; obsolete queries are canceled/removed. Each category renders as it
arrives, API failures remain visible, and refreshing a failed category labels any
retained results as earlier GitHub data. There is a 60-second cache, focus refresh,
and a manual refresh button; requests have a 15-second timeout and no automatic
retry loop. Incomplete/capped GitHub search results show a warning.

The same query builder and result mapper were exercised against live GitHub using
the existing CLI authorization transport, without extracting/copying credentials.
For the four current workspace repositories the result was 1 review request
(stereOS #33), 5 authored open PRs (Tapes #341/#342 and contributor.info
#1829/#1830/#1831), and 0 assigned issues. This is API verification, not proof of
the user's in-app browser provider authorization. The user subsequently confirmed
that My Work works in their existing signed-in browser. The new Priority layout has
not been independently inspected with browser-control tooling.
These changes do not repair the background ingestion defects documented below.

Latest live reply inspection found suggested follow-ups on Tapes #175,
Masterblaster #24, and contributor.info #1631, without incomplete results.

Validation: 41 focused GitHub-work tests passed. The full simple suite passed
1,774 tests with 26 skips using `--poolOptions.forks.singleFork=false --bail=0`.
The default shared-fork run exposed cross-file mock leakage in unrelated date-helper
and workspace-context tests. Changed-file ESLint, typecheck, and the production
build passed. Tests cover scoped query batching and pagination,
auth failures, partial results, account/repository changes, StrictMode, safe
GitHub navigation, filters, and UI pagination. The existing localhost server
remains available on port 5174. These changes are being submitted separately above
the existing onboarding PR; they are not merged or deployed.

GitHub documents team-inclusive review-request search in
[Searching issues and pull requests](https://docs.github.com/en/search-github/searching-on-github/searching-issues-and-pull-requests).

## Original Capture Audit

Checked September 4, 2026 (America/Los_Angeles), using authenticated GitHub CLI
reads and read-only Supabase queries with the application's public client.
No users, workspace memberships, or stored activity were changed by this audit.
The signed-in in-app browser was not controlled or inspected with browser tooling.

Workspace: `Paper Compute`, `/i/open-source-repos`.
Current members: `papercomputeco/masterblaster`, `papercomputeco/tapes`,
`papercomputeco/stereOS`, `bdougie/contributor.info`. PCC Labs repositories are
not yet members, so workspace-scoped queries do not include them.

## Live discrepancies

| Repository | GitHub open PRs | Stored open PRs | GitHub open issues | Stored open issues |
| --- | ---: | ---: | ---: | ---: |
| papercomputeco/masterblaster | 2 | 3 | 5 | 2 |
| papercomputeco/tapes | 4 | 8 | 9 | 7 |
| papercomputeco/stereOS | 2 | 3 | 4 | 5 |
| bdougie/contributor.info | 3 | 15 | 5 | 31 |

GitHub reads used `/repos/{owner}/{repo}/pulls?state=open&per_page=100` and
`/repos/{owner}/{repo}/issues?state=open&per_page=100`, excluding items with
`pull_request` from issue counts. Each response was below 100 items. Database
queries were scoped to the workspace's repository IDs and `state = open`.

- GitHub's `is:pr is:open review-requested:bdougie` search restricted to the
  four workspace repositories returns [stereOS #33](https://github.com/papercomputeco/stereOS/pull/33).
  Its PR response has a request for team `engineering` and no individually
  requested reviewers. The database row has `reviewer_data: {}`.
- [Tapes #341](https://github.com/papercomputeco/tapes/pull/341) and
  [#342](https://github.com/papercomputeco/tapes/pull/342), authored by bdougie,
  are open on GitHub and stored. Their `author_id` correctly joins to bdougie,
  but `author_login` is null and `reviewer_data` is empty.
- Tapes #68, #69, #72, and #86 are extra stored-open PRs absent from GitHub's
  open list. Direct detail reads confirm #68 and #86 closed on August 5;
  their stored snapshots were last synced in April and May respectively.
- Contributor.info #1830 and #1831 exist on GitHub but are absent from the DB.
- Missing open issues: masterblaster #2/#24/#30; Tapes #53/#56;
  contributor.info #1631/#1669/#1814/#1815. stereOS has an extra stored-open #18.

## How capture works

1. `netlify/functions/api-track-repository.mts` inserts the repository/tracking
   record and sends `capture/repository.sync.graphql` through Inngest.
2. `src/lib/inngest/functions/capture-repository-sync-graphql.ts` fetches recent
   PRs through `src/lib/inngest/graphql-client.ts`, upserts authors and PRs,
   then queues detail/review work. The default window is 30 days, capped at 30.
3. Detail capture writes PR details and submitted reviews. Submitted reviews are
   different from outstanding review requests.
4. `useWorkspacePRs` reads stored PRs and separately invokes `sync-pr-reviewers`.
   That edge function fetches current requests and attempts a database upsert.
5. `useMyWork` only reads the database. It selects requested reviews, assigned
   issues, unanswered discussions, follow-ups, and comments. There is no query
   for authored open PRs, despite the `authored` item type existing.
6. Issues also have separate capture/comment jobs and a browser-side sync helper.
   The latter upserts via the browser client, not the server service role.

## Confirmed code defects

### P1: Main capture omits outstanding review requests

The GraphQL list query does not select `reviewRequests`, and its PR upsert does
not populate `reviewer_data` or `author_login`. Detail capture stores submitted
reviews, not pending requests. The workspace's personal queue relies on the
missing `reviewer_data.requested_reviewers` field. This matches stereOS #33.

Even the separate edge sync encodes teams as `username: team:<name>`, while
`useMyWork` only matches a username equal to the current GitHub login. Team
requests need authenticated membership resolution or a viewer-specific GitHub
review queue; they must not be assigned to every workspace member.

### P1: Workspace refresh targets a different schema

`supabase/functions/workspace-sync/index.ts` updates
`tracked_repositories.sync_requested_at` and `sync_priority`, and selects
`owner,name`. Read-only probes against the live table return PostgreSQL 42703
for these columns. It also compares `tracked_repositories.id` with repository
IDs, but the Tapes tracking ID differs from its `repository_id`.

The function returns HTTP 200 even when all per-repository operations fail;
`WorkspaceAutoSync` treats any HTTP 200 as success and records a fresh local
timestamp. The checked-in implementation cannot perform its intended update
against the observed live schema. Its deployed version was not verified by a
mutating request in this audit.

### P1: Older PR state changes are missed

`GraphQLClient.getRecentPRs` orders by `CREATED_AT` and filters by `createdAt`,
not `updatedAt`. An old PR closed or re-requested for review today is excluded
from normal recent capture. There is no complete open-state reconciliation in
this path. The extra stored-open Tapes PRs demonstrate unreconciled state;
identifying which historical worker last wrote each row would require job logs.

### P2: My Work excludes authored open PRs and truncates before personal filtering

Authored PRs are absent unless they happen to match a different queue category.
The original reviewer and assignee queries take 20 workspace-wide rows before
applying the personal JSON filters. This can omit the user's relevant rows even
when they are correctly captured. The personal queue also hides partial query
failures behind an empty state.

### P2: Refresh failures are hidden

The PR sync helper can fall back to a client fetch without persisting results;
the hook ignores those returned rows and previously marked the DB fresh anyway.
The edge function ignores its upsert error. Issue bulk sync logs failed writes
without rejecting. Per-item snapshot times are not repository reconciliation
timestamps and should not be replaced with the time a refresh was attempted.

## Local status and next verification

Uncommitted presentation/query changes expose partial errors, show cached PRs
while refresh is pending, retain stored timestamps, filter personal requests
before the query limit, and explain/link the personal queue versus full lists.
These do not repair ingestion, resolve team review requests, add an authored-PR
queue, or backfill the database. Do not describe capture as fixed.

Validation of these local safeguards: typecheck, changed-file ESLint, and the
production build passed. Five focused suites passed with 28 passing tests and
5 existing skips. New tests cover cache-first PR rendering, unchanged stored
freshness after fallback, failed refresh visibility, manual refresh with auto
sync disabled, personal queue navigation, and distinguishing errors from empty
results. No signed-in browser end-to-end verification or production repair was
performed. These changes remain uncommitted and are not in the existing PRs.

Next implementation should add pending user/team requests to durable capture,
reconcile current open PR/issue state independently of creation age, replace the
broken workspace-refresh path with authorized job enqueueing, and add authored
PRs to the personal view using `author_id`. Verify against the cases above after
deployment and a scoped sync. Preserve team privacy and existing RLS; do not
solve this by exposing service-role credentials or permitting client bulk writes.
