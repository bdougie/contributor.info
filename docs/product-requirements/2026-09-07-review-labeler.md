# Review labeler for Paper Compute

Status: Public-repository implementation is complete locally; database migration and server deployment are pending.
Date: 2026-09-07.

The real flow is at `/review-labels`. Personal share links are
`/review-labels/<opaque-token>/invite`, ending in `/invite`. Workspace owners and
maintainers select public Paper Compute repos, create GitHub-bound invitations,
and see first/last view times, browser-session counts, and acceptance times.
A view is an observed browser visit, not verified recipient identity. Acceptance
verifies the invited GitHub ID and atomically establishes membership/enrollment.
Neither operation grants training consent.

The implementation includes real GitHub history capture, human/bot filters,
personal Good/Bad/Skip labels, optional one-line Missed entries, persisted JSONL
records, and consent withdrawal. Capture resumes while the reviewer keeps the
page open. Public `tapes` and `tapesctl` are supported; private repo rollout remains
separate. The original sample UI is preserved at `/review-labels/prototype` in
development only. It is excluded from production bundles.

See [the implementation and rollout guide](../features/review-labels.md) for the
current schema, runtime requirements, tests, and deployment steps. The remaining
sections preserve the broader design plan, including follow-ups such as private
capture, background scheduling, revision history/undo, and richer export anchors;
those follow-ups should not be mistaken for shipped behavior.

## Product decision

Add **Label reviews** at the top-level route `/review-labels`. This route includes
the invitation to join the Paper Compute workspace, followed by the personal
labeling queue. Workspace owners choose the repositories and invite reviewers.
Each signed-in reviewer gets an independent queue of past PRs they
participated in, containing inline review comments from every author. The first
reviewers are Matt (`yeazelm`) and John (`jpmcb`).

The unit of judgment is **one comment, its original hunk, and the surrounding
review evidence**. The only judgments are `good`, `bad`, `skip`, and an optional
`missed` entry attached to a hunk. There are no categories, explanations for
labels, model suggestions, or other people's labels.

Default interpretation of the brief: “all PRs for selected repos” means all
eligible historical PRs for each person. The detailed participation rule takes
precedence over assigning unrelated PRs to everyone. If Matt and John both
participated in a PR, both label it independently; one person's progress never
removes work from the other's queue.

The output is a versioned JSONL contract for `pcc-labs/twin-reviewer`. Training,
model building, and reviewing new PRs remain outside this feature.

## Existing foundations and gaps

These findings are from the local contributor.info and gh-datapipe checkouts,
plus GitHub repository metadata checked on 2026-09-07. They do not establish the
state of deployed migrations, app installations, or production data.

| Foundation | Reuse | Required change |
| --- | --- | --- |
| Workspace invitations | Members settings, expiring invitations, GitHub login, acceptance flow | Bind labeling invitations to a verified GitHub account; embed workspace invitation acceptance in `/review-labels` |
| Workspace repositories | Explicit repository selection and tracking | Save a labeler-specific subset and a historical cutoff; adding unrelated workspace repos must not expand the labeling scope |
| Contributor Reviews tab and JSONL export | Existing review/comment types and JSONL download mechanics | New PR-first query; the existing fetch filters both reviews and comments to their author and therefore omits teammate/bot feedback |
| Captured comments | Body, path, diff hunk, commit, parent-comment references exist in some capture paths | Complete pagination, canonical review/thread IDs, original line anchors, and an immutable snapshot of what was labeled |
| Private repository support | Tracking endpoint, GitHub App installation tokens on supported Node/Inngest paths, private-repo RLS | Verify deployed installation coverage, private backfill path, revocation behavior, and authorization for labeler reads/exports |
| gh-datapipe backfill | Historical PR discovery and paginated review extraction | Its unified comment writer currently omits hunk/path/reply fields; it also needs reliable comment type and repo-scoped PR linkage |

Relevant implementation locations:

- `src/services/workspace.service.ts`: `inviteMember` and `acceptInvitation`.
- `src/pages/invitation-acceptance-page.tsx` and workspace settings member components.
- `src/lib/contributors/fetch-contributor-reviews.ts`: existing author-scoped reads.
- `src/lib/contributors/contributor-reviews.ts`: review-to-comment heuristic.
- `src/lib/utils/csv-export.ts`: existing JSONL download.
- `src/App.tsx`: register the top-level `/review-labels` route; workspace navigation
  can link to it while repo selection stays in workspace settings.
- `src/lib/github-app/installation-token.ts` and `netlify/functions/api-track-repository.mts`.
- `supabase/migrations/20260713000000_private_repo_read_protection.sql`.
- `src/lib/inngest/functions/capture-pr-details-graphql.ts`,
  `src/lib/inngest/github-client.ts`, and `supabase/functions/inngest-prod/index.ts`.
- Companion repo: `gh-datapipe/src/github_comments.py` and
  `gh-datapipe/scripts/unified_workspace_backfill.py`.

The existing export documentation says GitHub does not provide a review ID on a
review comment. GitHub REST supplies `pull_request_review_id`, and the datapipe
extractor already reads it. Persist that ID and the GraphQL thread ID; use the
existing time/commit heuristic only to display legacy history, not to construct
new labeling evidence.

## Invitation and consent flow

1. An owner selects the labeling repositories inside the Paper Compute workspace.
   Show repository coverage and a personal PR/comment count once capture is ready.
2. Invite Matt and John using their GitHub logins. Resolve each login server-side
   to a stable GitHub user ID and create an expiring, single-use invite link bound
   to that ID. The link opens `/review-labels` with an opaque invitation token
   (`/review-labels/<token>/invite`). Reuse invitation token handling and
   member acceptance; add a GitHub-bound invite variant rather than requiring
   their public email addresses. Let the owner copy the links. Email delivery
   can reuse the existing flow when an address is supplied.
3. `/review-labels` guides the invitee through GitHub sign-in and displays their
   invitation to join the Paper Compute workspace on the same page. Preserve the
   invitation through sign-in. The server verifies the invited GitHub ID; the
   person chooses **Join workspace**, and successful acceptance opens their queue
   at `/review-labels`. A forwarded link cannot enroll a different account.
4. Before the first substantive label, show this notice:
   “Your labels will be exported to pcc-labs/twin-reviewer to train a model of
   how you judge Go and Rust changes. Saving Good, Bad, or Missed opts you in.
   Joining this workspace or skipping comments does not.”
5. Record the displayed consent version, its repository scope, the actor, and
   acceptance time atomically with the first `good`, `bad`, or `missed` save.
   `skip` can be saved without activating training consent. No default selections
   and no consent inferred from workspace membership, an invitation, a GitHub
   approval, or someone else's label.
6. Allow the person to withdraw consent and delete their labels from settings.
   Withdrawal immediately disables further training exports. Previously downloaded
   files cannot be recalled automatically; communicate withdrawal to the consumer
   through a revocation manifest keyed by consent ID when the handoff is used.

The top-level route handles all entry states. Existing enrolled members resume
their queue directly. A signed-in person visiting `/review-labels` without a
token can see a pending invitation matched server-side to their GitHub identity.
A person with neither enrollment nor a valid invitation sees an invitation-required
state, without access to workspace content. Expired, revoked, or wrong-account
invitations show a recoverable error on this route. Workspace membership and
labeling enrollment must both be established before queue access; accepting the
workspace invitation does not record training consent.

Use the trusted Supabase-to-GitHub identity mapping, with provider verification
on enrollment. Never accept a client-provided `reviewer_login`, editable profile
metadata, or the selected contributor profile as authority to write labels.
Store GitHub numeric IDs for authorization and logins for display/export.

Workspace contributor/viewer members need permission to label **their own**
queue; they do not need repository-management rights. Check the actual workspace
member, repository, and history-retention limits before rollout. The pilot needs
at least the owner plus two reviewers, eventually five repos, and access to the
agreed historical range. Do not silently truncate history to a tier's dashboard
window or change billing as part of this plan.

## Queue and review interaction

### Eligibility

For each selected repository, enumerate PRs closed or merged before an explicit
UTC cutoff saved when labeling is enabled. Start with the full available history
through that cutoff, loading recent PRs first while older PRs backfill. A bounded
pilot window may be selected explicitly; never silently cap the corpus at 30,
90, or 120 PRs. New/open PRs are outside v1.

A person participated if GitHub records them as the PR author, an author of a
submitted review (including an empty approval), or an author of an inline or PR
discussion comment. Assignment, a review request, organization membership, or
repository access alone does not count. Persist the source IDs establishing
participation. Resolve identities by ID, including across login renames.

Within each eligible PR, include every inline comment on a `.go` or `.rs` file,
from humans and bots, including replies with a valid inherited hunk. Keep each
GitHub comment ID as one candidate; thread context must not create duplicates.
PR-level review summaries and discussion comments can provide context and
participation evidence but are not standalone label targets without a reliable
hunk. A PR with Go/Rust changes and no inline comments still gets a missed pass.

### Screen

- Header: repo, PR number/title, PR author, link to GitHub, and personal progress.
- Code: original diff hunk with filename, line numbers, side, and source commit.
  Allow opening more of the file/diff without leaving the task.
- Comment: author and complete verbatim body, with literal source available.
  Render safely without modifying stored text or executing embedded HTML.
- Context: chronological thread replies, thread resolution state, relevant
  subsequent reviews, and evidence about changes to the flagged lines.
- Actions: **Good — this comment was worth making**, **Bad — this comment should
  not have been made, or was wrong**, **Skip — not sure or not mine to judge**.
  Support keyboard shortcuts and undo/change of the last decision.
- After the PR's comments: show its Go/Rust diff and optional **Missed** action.
  The person selects a hunk or line range and writes one line describing what
  the review missed. Multiple missed entries may be saved on a PR, each with its
  own hunk and one-line note. No reason fields elsewhere.
- **Next PR** completes the missed pass without requiring an entry. An interrupted
  session resumes at the saved comment or missed pass.

Save before advancing, report save failures in place, and use idempotency keys
so retries/double clicks cannot produce duplicate decisions. A skipped comment
counts as processed, stays distinguishable from bad, and can be revisited.

Default order: PRs with Greptile follow-up evidence first, newest PRs within each
group, with stable comment order inside a PR. Keep every eligible PR reachable;
prioritization must not filter out quiet threads. Record queue policy/version in
export metadata so downstream sampling can account for partial completion bias.
Use GitHub App/bot IDs to recognize Greptile rather than body text matching.

Do not show team label distributions, agreement scores, rankings, or individual
teammates' decisions. Owners may see invitation and ingestion status. Label values
and personal exports remain private even from workspace owners.

## Preserve evidence; let the person decide

| Evidence | What to show | What it means |
| --- | --- | --- |
| Replies after a Greptile comment | Full replies, authors, timestamps, and parent links | Human can recognize agreement/disagreement; v1 does not classify reply sentiment |
| Resolved thread | Current resolved state, resolver when available, capture time | Resolution alone does not establish that a comment was wrong or ignored |
| Later empty approval | Reviewer, review ID, timestamp, commit, empty body | A later approval is context, not a judgment about each bot comment |
| Change at the flagged hunk | Original and subsequent commit anchors; comparison result and coverage | Only claim unchanged when exact mapping/comparison supports it; otherwise unknown |

Show all human replies to Greptile comments, so disagreement remains visible
without an LLM or a fragile keyword classifier. Prioritize these threads without
preselecting good or bad.

GitHub's current thread state does not necessarily supply a historical resolution
timestamp or the exact commit at resolution. A hunk unchanged at the final PR
head can have changed and reverted earlier. Store `unknown` when the relevant
history cannot be reconstructed; never describe a missing diff or a resolved
thread as “resolved without a change.” If only the original-to-final comparison
is available, label it exactly that way. A bodyless approval may also contain
inline comments: call it silent only when both body and attached comments are
empty. Context must preserve ordering and commit IDs so an approval after a fix
is not presented as approval of unchanged code.

Freeze the comment body, source `updated_at`, hunk, and evidence snapshot that
the person actually saw. Later edits, thread replies, or force pushes must not
change an earlier label's exported meaning. Refreshing source data creates a new
snapshot, not an automatic new assignment for an already labeled comment.

## Data and authorization

Suggested new records (names may follow existing conventions during implementation):

| Record | Contents |
| --- | --- |
| `review_labeling_sets` | Workspace, selected repo IDs, cutoff, scope version, queue policy, ingestion status |
| `review_labeling_enrollments` | Invited GitHub ID, accepted app/auth user, active/revoked state |
| `review_labeling_consents` | Person, purpose/text version, covered repos/scope version, accepted/revoked timestamps |
| `review_labeling_prs` | Set, repo/PR IDs, base/head SHAs, per-resource capture completeness |
| `review_labeling_participants` | PR, GitHub user ID, participation source IDs |
| `review_labeling_snapshots` | Immutable comment or missed-hunk source, stable GitHub IDs, path/side/lines/commits, verbatim hunk/body, evidence JSON, digest |
| `review_labels` | Actor, set, PR, snapshot ID, `good/bad/skip/missed`, missed note only when applicable, consent ID, server timestamp, revision/idempotency key |
| `review_labeling_progress` | Person/PR comment cursor and missed-pass completion |

Schema invariants: `good/bad/skip` require a comment snapshot and prohibit notes;
`missed` requires a valid Go/Rust hunk and a non-empty single-line note, with no
invented comment author/body. Use a modest server-validated note length limit
(proposed: 280 characters). Latest decisions are unique by person, set, and
comment ID. Keep revisions for undo/audit; normal JSONL exports emit the current
decision once, not contradictory historical labels. Repeated missed-save retries
deduplicate by request ID without collapsing distinct notes on the same hunk.

Centralize an authorization predicate used for queue reads, source reads, writes,
and exports: authenticated identity + active enrollment + workspace membership
+ selected repo + current repository authorization + participation in that PR.
Private repositories also require active GitHub App coverage and a current
per-person repository grant. App installation is permission for the service to
read; historical participation alone is not proof that the person still has
access. Establish/revalidate the grant server-side through a GitHub API supported
for the installation; fail closed if it cannot be verified. Revoke grants on
membership/repository/installation changes and recheck before private exports.

Apply owner-only RLS to labels, progress, and consents. Use “owner” here to mean
the label's author, not the workspace owner. Source snapshots require the PR
authorization predicate. Audit existing permissive policies before adding new
ones: Postgres combines permissive policies with OR. Service-role endpoints
must explicitly enforce the same predicate, since that role bypasses RLS.
Do not expose service credentials or private content through analytics, logging,
public storage, shared caches, or global search. Cache keys must include the
authorized user and scope, and logout/revocation must clear cached private data.

Suggested API surface: get personal queue; get authorized PR/snapshot; save or
revise a label; complete a PR; export my labels; withdraw consent. Workspace
owners manage repo selection and invitations through existing settings. The
server derives the actor and source fields; the browser submits a snapshot ID
and decision, plus a note only for missed. No arbitrary hunk/body/reviewer fields
on comment-label writes. Missed hunks must also resolve to captured PR diffs.

## JSONL contract and handoff

Export one UTF-8 JSON object per current saved label. The person downloads their
own file; v1 needs no shared owner export and no automatic training integration.
An explicitly authorized downstream consumer may ingest those files. Do not
extend the existing bulk contributor-history export to reveal private labels.

Each row includes `schema_version`, `record_id`, `revision`, reviewer GitHub ID
and login, repo GitHub ID and full name, PR number and dates, language, source
commit/line anchors, verbatim hunk and comment, observed pushback/context,
decision, server timestamp, snapshot digest, set/scope version, and consent
provenance. PR dates allow downstream grouping without mixing one PR across
training/evaluation splits. These are provenance fields, not labeling categories.

Illustrative JSONL shapes below use synthetic code/comments and placeholder IDs;
they are not actual Paper Compute data:

```jsonl
{"schema_version":1,"record_id":"label-example-1","revision":1,"reviewer":{"github_id":"matt-id","login":"yeazelm"},"repo":{"github_id":"repo-id","full_name":"papercomputeco/tapes"},"pr":{"number":123,"created_at":"2026-08-01T10:00:00Z","closed_at":"2026-08-02T10:00:00Z"},"language":"go","anchor":{"file_path":"store.go","commit_sha":"source-sha","side":"RIGHT","start_line":12,"end_line":12},"hunk":"@@ -12 +12 @@\n-return nil\n+return err","comment":{"github_id":"comment-id","review_id":"review-id","thread_id":"thread-id","author":"greptile[bot]","body":"Check whether this error can be returned here.","updated_at":"2026-08-01T11:00:00Z"},"pushback":{"replies":[{"github_id":"reply-id","author":"jpmcb","body":"This is already handled by the caller.","created_at":"2026-08-01T12:00:00Z"}],"resolution":{"is_resolved":true,"resolved_at":null,"observed_at":"2026-09-07T19:00:00Z"},"later_approvals":[],"change_at_resolution":"unknown"},"label":"bad","note":null,"labeled_at":"2026-09-07T20:00:00Z","snapshot_digest":"sha256:example","labeling_set":{"id":"set-id","scope_version":1,"queue_policy":"greptile-context-first-v1"},"consent":{"id":"consent-id","version":1,"accepted_at":"2026-09-07T20:00:00Z"}}
{"schema_version":1,"record_id":"label-example-2","revision":1,"reviewer":{"github_id":"john-id","login":"jpmcb"},"repo":{"github_id":"repo-id","full_name":"papercomputeco/tapes"},"pr":{"number":123,"created_at":"2026-08-01T10:00:00Z","closed_at":"2026-08-02T10:00:00Z"},"language":"go","anchor":{"file_path":"store.go","base_sha":"base-sha","commit_sha":"head-sha","side":"RIGHT","start_line":18,"end_line":18},"hunk":"@@ -18 +18 @@\n-close(ch)\n+close(done)","comment":null,"pushback":null,"label":"missed","note":"Concurrent callers can close this channel twice.","labeled_at":"2026-09-07T20:02:00Z","snapshot_digest":"sha256:example-2","labeling_set":{"id":"set-id","scope_version":1,"queue_policy":"greptile-context-first-v1"},"consent":{"id":"consent-id-2","version":1,"accepted_at":"2026-09-07T20:02:00Z"}}
```

JSON escaping preserves newlines in verbatim source strings. A `skip` row uses
the same comment shape; a skipped-only person has no accepted training consent.
All saved labels are exportable to their author. The training handoff excludes
non-consenting/revoked records and treats skip as abstention, never as bad.
Training consent must not be inferred from `comment.author`: Matt can label
John's or Greptile's comment, but that grants consent only for Matt's judgments.

The existing twin-reviewer plan mentions category labeling and redaction. This
brief supersedes its category proposal: the labeler contract has only four
decisions. Keep verbatim source in this authorized export. Any downstream
redaction is a separate transformation with provenance, not a mutation of the
source label. No training, synthetic labels, or inferred personal twins here.

## Repository rollout

| Repository | Verified visibility | Path |
| --- | --- | --- |
| `papercomputeco/tapes` | Public | Initial end-to-end pilot |
| `papercomputeco/tapesctl` | Public | Add to selected repos, backfill history, prepare per-person queues |
| `papercomputeco/paper` | Private | Verify GitHub App installation coverage and private capture/authorization before enabling |
| `papercomputeco/paper-forest` | Private | Same private path when selected |
| `papercomputeco/cloud` | Private | Same private path when selected |

### Adding tapesctl

Track `papercomputeco/tapesctl` using the existing user-initiated flow, add it to
the labeler set, enumerate its historical PRs, capture reviews/threads and Go/Rust
diffs, and compute eligibility for each reviewer. No private-repo integration is
needed. “No eligible PRs” must distinguish an empty history or no participation
from an unfinished backfill. Adding a repo increments scope and presents that
addition before the person's first substantive label in its new scope.

### Adding paper

1. An organization admin installs or updates contributor.info's GitHub App with
   `paper` selected. Confirm the exact repo is enabled and the installation is
   active; organization-wide installation existence alone is insufficient.
2. Confirm deployed token configuration and use the supported installation-token
   capture path for PRs, comments, contents/diffs, and review threads. Request
   only needed read permissions on the token. The existing App also has write
   features/default PR comments: ensure adding it for ingestion does not enable
   automated review comments on these repos.
3. Create/verify repository metadata with `is_private = true` before any content
   insert. Every child row must carry a valid repository ID. The unified backfill
   must not create private repositories with a default/unknown public visibility
   or insert content with a null repository ID.
4. Validate workspace membership and per-person repo grants for Matt and John.
   Exercise source access, personal writes, and exports with both identities;
   prove anonymous and unauthorized accounts cannot retrieve the same records.
5. Backfill using repo-scoped installation auth. The private-repo implementation
   notes identify PAT-only Deno paths; the labeler must not accidentally dispatch
   private capture there. Do not assume the unified datapipe path has the same
   installation-token support as its other extractors.
6. Confirm snapshot and nested-pagination completeness, then enable `paper` in
   the labeler scope. Repeat for `paper-forest` and `cloud` as selected.
7. Test removal/suspension: stop reads, labeling, and exports for private content,
   cancel capture work, and invalidate caches/grants. Quarantine stored snapshots
   under the agreed retention policy; withdrawal/purge must cover duplicated
   snapshot text as well as source tables.

## Implementation sequence

### Phase 1 — complete source capture and export contract

- Extend one canonical capture path to preserve direct review/thread/comment IDs,
  original/current paths and line sides, commit IDs, original hunks, reply chains,
  review submissions, and PR/file diffs for missed entries.
- Fix the unified backfill writer's dropped metadata and PR linking by
  `(repository_id, PR number)`. A PR number alone is not globally unique. Distinguish
  PR discussion comments from inline comments using the source endpoint/type.
- Walk every page of PRs, reviews, comments, files, threads, and comments within
  threads. Persist cursors/completeness; retries resume without duplication.
  Treat failed pages, API truncation, unavailable commits, and missing anchors as
  incomplete, not as empty content or finished capture.
- Use immutable source snapshots and an explicit finite corpus cutoff. Ready
  PRs can be labeled while older ones load; a PR is ready only when its required
  comment/context enumeration is complete. Quarantine unanchorable candidates
  with visible aggregate coverage rather than fabricate a hunk.
- Agree on the JSONL schema above and an import fixture with twin-reviewer.

### Phase 2 — identity, own-label storage, and invitations

- Add labeling scope, enrollment, consent, snapshot, label, and progress records.
  Apply constrained writes, RLS, and server-derived actor identity.
- Extend invitations to support GitHub-bound links opening `/review-labels` and
  workspace invitation acceptance within that route, including sign-in return.
- Build queue, save/revise, progress, own-export, and consent withdrawal endpoints.
- Make all source/write/export endpoints share authorization and scope checks.
  Verify there is no workspace-admin exception to other people's labels.

### Phase 3 — reviewer experience and public pilot

- Add the top-level `/review-labels` page with sign-in, workspace invitation,
  acceptance, and resume states, followed by original hunk/comment display,
  evidence context, Good/Bad/Skip, keyboard interaction, undo, saved progress,
  and the missed pass.
- Add loading, partial-capture, zero-eligible, complete, and save-failure states.
- Prepare a tapes/tapesctl pilot for Matt and John using invitation links.
  Deliver invitations only when the owner explicitly requests sending them.
- Have each reviewer complete a historical PR and download their own JSONL.
  Verify the consuming contract without starting a training run.

### Phase 4 — private repositories

- Complete the `paper` steps above and validate installation/grant revocation.
- Add `paper-forest` and `cloud` through the same checked path when selected.
- Preserve previous labels/progress as new repo scope and consent versions are
  added; do not make new repos silently trainable under the old scope.

## Acceptance criteria and validation

- `/review-labels` is the canonical entry point. New invitees can sign in, accept
  their workspace invitation, and begin labeling through this flow. Existing
  enrolled members resume directly; a direct visit can resolve their pending
  invitation by verified identity. Invitation context survives authentication,
  and invalid invitations never grant queue access or training consent.
- Matt cannot label as John; a wrong-account invite, forged actor, unrelated PR,
  unselected repo, or unapproved snapshot is rejected server-side.
- Both people can label the same PR/comment independently without seeing each
  other's labels, including through direct database/API queries and exports.
- Historical authors, review submitters, empty approvers, and comment participants
  get the expected PRs. Requested-only reviewers do not. GitHub renames preserve
  identity. Both Go and Rust files work; other files are excluded.
- Replies preserve their original body, ID, author, parent link, and hunk. A
  later source edit cannot change a previously saved label's exported snapshot.
- Greptile pushback is visible without suggested labels. Resolved threads, missing
  history, approvals after fixes, and bodyless reviews with inline feedback do
  not acquire false negative labels or unsupported “unchanged” claims.
- A PR with no inline comments can still receive a missed entry. Notes reject
  multiple lines; missing/unverifiable hunks cannot be submitted.
- Retried saves produce one decision; undo/relabel exports the current revision;
  pagination exceeds API/default database limits without omissions. Partial
  ingestion never masquerades as complete personal progress.
- JSONL parses line-by-line and round-trips verbatim body/hunk strings, Unicode,
  quotes, and newlines. Every substantive training row has personal consent;
  skip is abstention and no row trains the comment author's twin by implication.
- All five selected repos are supported by the applicable path. Private metadata
  and content remain inaccessible to anonymous/nonmembers, and losing repo/app
  access blocks reads/writes/exports even when old participation exists.
- Run focused Vitest tests for selection, evidence, state transitions, and export;
  database authorization tests for RLS/invitation/identity isolation; and a small
  integration test for `/review-labels` → sign in → join workspace → label →
  missed → resume → export. Run
  `npm run build` before submitting implementation. Run Supabase security advisors
  after DDL, as required by AGENTS.md. No runtime checks are implied by this plan.

Operational launch facts still to verify: target workspace and limits, selected
historical cutoff, deployed App coverage/configuration, private user-grant API
behavior, deployed RLS/revocation state, and actual ready-corpus counts. These do
not prevent implementing and validating the public pilot locally.
