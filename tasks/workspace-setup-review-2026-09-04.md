# Tapes and PCC Labs workspace setup review

Reviewed September 4, 2026 (America/Los_Angeles), against the live
[contributor.info site](https://contributor.info/workspaces) first.

Local source: `e3d9e813` in `/Users/bdougie/code/bdougie/contributor/contributor.info`.
The conversation's original checkout path `/Users/bdougie/code/contributor.info`
does not exist on this machine. The deployed commit has not been independently
matched to the checkout; source findings below are explicitly distinguished from
production reproductions.

## P1 implementation update

Both P1 fixes are implemented locally. The findings below describe the audited
baseline at `e3d9e813`; they are retained as reproduction evidence.

- Workspace creation now receives explicitly named `authUserId` and `appUserId`
  from both creation entry points. Billing uses the auth ID; workspace ownership
  uses the app ID. Subscription lookup errors stop creation instead of silently
  assigning the free tier, and explicit zero allowances are preserved.
- Workspace eligibility resolves the auth ID to the app ID before counting owned
  workspaces, and honors the stored subscription allowance.
- Repository eligibility and the management picker use the workspace's saved
  `max_repositories`. The picker counts memberships even when a joined repository
  is not visible, blocks selection when loading fails, includes pending selections
  in capacity checks, and updates capacity after partial success while retaining
  failed selections. Repository insertion stops if its count query fails.
- Commercial tier defaults were not changed. Capacity uses the existing finite
  database limit; no `-1` unlimited convention was introduced because the workspace
  schema constrains `current_repository_count <= max_repositories`.

Validation: 67 tests passed across the workspace service, subscription capacity
checks, repository picker, and subscription hook suites. Changed TypeScript files
passed ESLint; `npm run typecheck` and `npm run build` passed, including CSP
verification. The new regression cases cover different auth/app IDs, an existing
workspace, paid overrides, zero limits, failed billing/count queries, the fourth
repository on a three-slot workspace, five selected repos on an eight-slot team
workspace, and partial additions.

These changes have not been deployed. Previously created workspace records were
not rewritten; any account already assigned incorrect limits needs verification
before a targeted correction. The P2 findings remain open.

## Findings

### 1. P1: Workspace creation looks up billing with the wrong user ID

**Evidence: confirmed in local source; authenticated production reproduction pending.**

The creation page resolves the signed-in user to `app_users.id` before calling
`WorkspaceService.createWorkspace`. The service uses that ID both for
`workspaces.owner_id` (correct) and `subscriptions.user_id` (incorrect).
Subscriptions reference `auth.users.id`. When the IDs differ, the subscription
lookup returns no row and creation silently applies the free tier, a one-workspace
limit, and three repositories. An existing workspace can therefore prevent a paid
customer from creating the intended Tapes workspace.

References:

- `src/pages/workspace-new-page.tsx:57`
- `src/services/workspace.service.ts:137`
- `src/lib/auth-helpers.ts:13`
- `supabase/migrations/20250824000001_subscription_system.sql:11`
- `supabase/migrations/20251021000000_fix_workspace_user_relations.sql:98`

The production asset `workspace.service-Dbjc9zX2.js` also contains this same
subscription lookup and free-tier fallback. Its relevant code fragment is retained
in [deployed signatures](evidence/workspace-setup-2026-09-04/deployed-signatures.json).
This corroborates the shipped service logic but does not replace an authenticated
reproduction or inspection of the production schema.

The inverse mismatch exists in `src/lib/subscription-limits.ts:25`: the limits hook
passes the auth ID, and the workspace count compares it to `owner_id`, which uses
the app ID. The UI can report spare workspace capacity and then reject creation.

**Fix:** keep auth and app IDs explicit. Use the auth ID for billing and the app ID
for workspace ownership/membership. Do not silently downgrade on subscription
query errors. Test a paid account with different auth/app IDs, an existing
workspace, and subscription limit overrides.

### 2. P1: Repository picker capacity disagrees with persisted workspace capacity

**Evidence: confirmed in local source; authenticated production reproduction pending.**

`AddRepositoryModal` calculates capacity from its own tier table and ignores the
loaded workspace's `max_repositories`. Its table omits `team`, which falls back to
four slots. The service enforces the persisted `max_repositories` value.

| Tier | Picker limit | Creation fallback |
| --- | ---: | ---: |
| Free | 4 | 3 |
| Pro | 10 | 50 |
| Team | 4 (missing tier fallback) | 3 |
| Enterprise | 100 | 3 (default fallback) |

Creation uses a subscription override if its lookup succeeds; the picker still
ignores that override. These are implementation values, not a recommendation or
assertion about the intended commercial plans.

References:

- `src/components/features/workspace/AddRepositoryModal.tsx:57`
- `src/components/features/workspace/AddRepositoryModal.tsx:131`
- `src/services/workspace-permissions.service.ts:127`
- `src/services/workspace.service.ts:717`

**Reproduce after sign-in:** open a workspace whose stored limit is three and add
four repositories through the picker. It offers the fourth slot, but the service
rejects it. Conversely, a workspace with a higher purchased limit can be blocked
early by the picker.

**Fix:** display and enforce the effective workspace capacity consistently, with
one agreed tier policy and explicit unlimited handling. Test the fourth repo,
team workspaces, and subscription overrides. The five-repository core set below
cannot fit within the current free creation fallback.

### 3. P2: Workspace sign-in handoff uses an unrecognized return parameter

**Evidence: live outgoing URL confirmed; post-login consequence confirmed in source.**

1. Visit <https://contributor.info/workspaces> signed out.
2. Click **Get Started Free**.
3. The destination is `/login?redirect=/workspaces`.
4. The login page reads `redirectTo`, not `redirect`, and defaults to `/`.

An intercepted live OAuth request also used
`https://contributor.info/login?redirect=/workspaces` as its return URL.
The complete OAuth round trip was not exercised in that isolated check.

References: `src/pages/workspaces-page.tsx:165`,
`src/components/features/auth/login-page.tsx:52`.

**Fix:** use one shared, validated return-path convention. Verify that both workspace
marketing CTAs return to workspace setup after OAuth.

Evidence: [login landing page](evidence/workspace-setup-2026-09-04/workspaces-login.png).
The login copy also incorrectly describes repository search instead of workspace
setup.

### 4. P2: Signed-out visitors can submit a workspace form that cannot succeed

**Evidence: reproduced live.**

1. Open <https://contributor.info/workspaces/new> in a signed-out browser.
2. Enter `Tapes and PCC Labs` and a description.
3. Click **Create Workspace**.
4. The form reports `You must be logged in to create a workspace` and stays put.

Authentication is only checked on submission. There is no sign-in action in the
error. The form keeps its values only in component state, so an OAuth page
navigation loses the draft.

References: `src/pages/workspace-new-page.tsx:47`,
`src/components/features/workspace/WorkspaceCreateForm.tsx:40`.

**Fix:** establish authentication before allowing submission, retain the draft
through OAuth, and return the user to it. Exercise direct links and expired sessions.

Evidence: [signed-out submission](evidence/workspace-setup-2026-09-04/new-workspace-signed-out.png).

### 5. P2: The setup help link opens an unrelated GitHub organization

**Evidence: reproduced live.**

From `/workspaces/new`, click **documentation** under the form. It navigates to
<https://contributor.info/docs>, which renders the GitHub `docs` organization and
its repositories, not workspace instructions.

Reference: `src/pages/workspace-new-page.tsx:165`.

**Fix:** link to the actual workspace documentation at
`https://docs.contributor.info/workspaces/overview` (verified HTTP 200 and a
`Workspaces - contributor.info` page title during this audit).
Test the resulting page identity, not just a successful HTTP response.

Evidence: [incorrect help destination](evidence/workspace-setup-2026-09-04/workspace-help.png).

### 6. P2: Enter discards an exact repository query in the management picker

**Evidence: confirmed in local source; authenticated production reproduction pending.**

The picker gives `GitHubSearchInput` an `onSearch` handler that only logs the query.
Typing `papercomputeco/tapes` and pressing Enter without highlighting a suggestion
calls this handler, clears the input, and stages nothing. Clicking a suggestion or
highlighting it with the arrow keys takes a different, working selection path.

References: `src/components/features/workspace/AddRepositoryModal.tsx:638`,
`src/components/ui/github-search-input.tsx:183`,
`src/components/ui/github-search-input.tsx:231`.

**Fix:** resolve an exact `owner/repo` or GitHub URL and stage it on Enter; retain
input and show an actionable error when resolution fails. Test paste-and-Enter,
keyboard selection, and an unknown repository.

### 7. P2: Creating a workspace from a repository loses the selected repository

**Evidence: confirmed in local source; authenticated production reproduction pending.**

In **Add to Workspace**, selecting the new-workspace option closes the dialog and
navigates to `/workspaces/new` without forwarding `owner` or `repo`. Creation then
opens an empty workspace. The user must find and add Tapes again.

References: `src/components/features/workspace/AddToWorkspaceModal.tsx:203`,
`src/pages/workspace-new-page.tsx:98`.

**Fix:** preserve the pending repository through creation and resume the add step,
with an explicit result if tracking or adding fails.

## Repository scope and discovery

Suggested workspace name: **Tapes and PCC Labs**. Suggested visibility: **Public**,
since the requested scope is open source. Confirm the resulting slug through the
application; do not assume it is available.

The GitHub API and project READMEs were checked during this review. The core set
has explicit Tapes integrations:

| Repository | Relationship | License |
| --- | --- | --- |
| [papercomputeco/tapes](https://github.com/papercomputeco/tapes) | Primary project | Apache-2.0 |
| [pcc-labs/tapes-ai-sdk-example](https://github.com/pcc-labs/tapes-ai-sdk-example) | Vercel AI SDK integration | MIT |
| [pcc-labs/openclaw-in-a-box](https://github.com/pcc-labs/openclaw-in-a-box) | OpenClaw with Tapes telemetry | MIT |
| [pcc-labs/deepgram-demo](https://github.com/pcc-labs/deepgram-demo) | Voice agent with Tapes capture | MIT |
| [pcc-labs/memory-cassette](https://github.com/pcc-labs/memory-cassette) | Derived memory from Tapes sessions | MIT |

Additional active, licensed labs projects for a broader eight-repository portfolio:

- [pcc-labs/sweeper](https://github.com/pcc-labs/sweeper): agent maintenance tooling, Apache-2.0.
- [pcc-labs/empirical-evidence](https://github.com/pcc-labs/empirical-evidence): telemetry-driven model experiments, Apache-2.0.
- [pcc-labs/tetris](https://github.com/pcc-labs/tetris): agent/model benchmarking, MIT.

`pcc-labs/pokemon` is archived; `pokemon-kafka` is an active fork and can be included
if the broader experiments are desired. `.github` is the organization profile
repository and has no detected license; it is not in the proposed project set.

**Live discovery gap:** <https://contributor.info/pcc-labs> showed six collaborative
repositories and omitted `tapes-ai-sdk-example` and `empirical-evidence`. Both are
public, active, licensed repositories, with zero stars and forks at review time.
The page explicitly describes its collaboration filter, so this is a setup
coverage gap rather than an unexplained API failure. Offer a way to browse all
public org repositories or add exact URLs for workspace setup, including young
projects with no popularity signals.

Evidence: [live labs listing](evidence/workspace-setup-2026-09-04/pcc-labs.png).

`papercomputeco/tapes` already displays contributor analytics on the live site.
`pcc-labs/memory-cassette` displays an untracked state and requires sign-in to start
tracking. A successful setup must verify tracking completion as well as workspace
membership.

## Validation and remaining checks

- Live Chrome/Playwright checks used the production origin, not localhost.
- Reproduced signed-out form submission, both workspace entry routes, the help
  misroute, and the labs discovery gap; inspected Tapes, memory-cassette, and demo pages.
- Captured production screenshots without authentication tokens or credentials.
- Repeated the signed-out form check at 390px width. The page width remained
  390px without horizontal overflow; the authentication error reproduced there too.
  See [mobile form](evidence/workspace-setup-2026-09-04/new-workspace-mobile.png).
- Read source and schema migrations to trace identity, capacity, and repository
  selection behavior. Application code has not been changed.
- No full build or unit suite run: this change is an audit document and screenshots.
- Existing open issues were searched for workspace-related reports; no matching
  issue was identified in that search. No issues or external messages were posted.
- Authenticated creation, existing-workspace reuse, repository additions, and
  persistence after reload remain to be verified in the review browser.

Recommended fix order: identity mapping and capacity policy, login handoff and
draft recovery, repository selection continuity, help destination, then discovery.
After those checks, verify all five core repositories appear exactly once, new
repositories finish tracking, and the workspace survives a hard reload.
