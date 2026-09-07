# Review labels

Implementation is present locally. The database migration and Netlify deployment
have not been applied to a shared environment.

## QA locally

For the normal app with your configured GitHub login and existing workspaces, run
`npm run dev -- --host 127.0.0.1 --port 5174 --strictPort`.
The review-label backend has not been deployed to the shared database; the
normal app's Review labels page links to the working local QA flow below.

In a separate terminal, run:

```sh
eval "$(fnm env)"
npm run qa:review-labels
```

Open `http://localhost:5175/review-labels?source=human`. The runner starts an
independent Supabase project (Auth, Postgres, PostgREST), applies the actual
review-label migration, seeds three local accounts, serves the actual API, and
starts Vite on 5175. The normal app stays on 5174 with its configured GitHub login
and existing workspaces. QA uses separate test accounts; its header says
**Choose QA account** instead of offering GitHub OAuth.
Browser query caches are separated by database, and authentication and review
records are not persisted in that cache.
The first run downloads Docker images. Prerequisites are Docker, `psql`, and a
GitHub CLI login (`gh auth login`) or server-side `GITHUB_TOKEN` for public account
and repository lookups. The pinned Supabase CLI is downloaded automatically.

1. Choose **Owner · bdougie** in the Local QA account selector.
2. Select `tapes` and/or `tapesctl`, save the repositories, and create an invite for
   `yeazelm` or `jpmcb`. Copy the link ending in `/invite`.
3. Open the link. Choose **John** for a Matt invitation and verify acceptance is
   rejected. Choose **Matt**, then **Join workspace**.
4. Label a human and a bot comment, add a Missed entry, and reload to check that
   labels persist. Export JSONL; every QA export row has `demo: true` and `qa: true`.
5. Switch back to **Owner** to inspect Viewed/Accepted timestamps and session
   counts. Reloading or switching accounts in the same browser tab should not
   add another view. A separate browser context may add another session.

This mode uses clearly marked synthetic PR fixtures with real local storage,
transactions, permission checks, and Supabase Auth sessions. It does not exercise
the external GitHub OAuth handshake or full-history backfill. The QA account
endpoint exists only in the local runner, listens on loopback, rejects foreign
origins, and is absent from Netlify/production bundles. Hosted credentials are
not loaded into the runner; it asserts the database's dedicated local ports.

Stop the UI/API with Ctrl-C. Local data survives restart. After stopping:

```sh
npm run qa:review-labels:stop   # stop the isolated database, keeping data
npm run qa:review-labels:reset  # erase only this QA database and restart clean
```

With the QA runner active, execute `npm run qa:review-labels:check` for the browser
check against real local services (no API mocks). Install its browser with
`npx playwright install chromium` if needed, or set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium executable.
Screenshots and local credentials stay in the gitignored `.review-labels-qa/`
directory. This check creates a new test collection and labels in that database.

The original screen on 5174 was failing because Vite proxied API calls to port
8888 while no backend was running. It now shows this QA command and a link to
the local QA app when that API is unavailable. `/review-labels/prototype` remains the
older sample UI; it does not test durable invite tracking.

## Entry and sharing

- `/review-labels` opens the authenticated workspace and personal labeling flow.
  A visible **Label reviews** header action is available whenever a workspace is
  active, on desktop and mobile, without opening a menu.
  The profile menu's **Label reviews** item, workspace menu, main navigation, and workspace settings link to
  `/review-labels?workspace=<workspace-id>`, preserving the selected workspace.
- Owners and admins save a collection of explicitly selected public Paper
  Compute workspace repositories. The server records a historical cutoff at
  creation; adding other workspace repositories does not expand that collection.
- Each invite resolves a GitHub login to its numeric ID. The sender copies
  `/review-labels/<64-character-random-token>/invite`. The last path segment is
  always `invite`. Links expire after seven days and can be revoked before use.
  Only a SHA-256 token hash is stored; the raw link is returned once to its creator.
- GitHub sign-in preserves the invite path. Acceptance checks the identity from
  Supabase Auth, creates an accepted contributor membership and personal
  enrollment atomically, and returns the user to their labeling queue. Existing
  members retain their role. Retries neither duplicate membership nor restore a
  member who was subsequently removed. Workspace tier limits still apply.
- No invitations are emailed or sent automatically.

## View and acceptance tracking

After a valid invitation screen loads, the browser posts a view event. A random
sessionStorage visit ID deduplicates refreshes, React remounts, and OAuth returns.
The database's `(invite_id, visit_id)` primary key makes this idempotent across
retries. A separate browser session can count again. No IP address, fingerprint,
or assumed recipient identity is stored in the view-event table.

Owners/admins see **Not viewed**, **Viewed**, **Accepted**, **Expired**, or
**Revoked**, plus first-view time, last-view time, browser-session count, and
acceptance time. The Refresh action reloads these values. Preview HTTP requests
and link-unfurl bots that do not run the UI do not count as browser views.

“Viewed” is a link visit; it does not prove the invited person opened it. The
`accepted_by` value comes from a verified Supabase session whose GitHub identity
matches the invite. Acceptance time changes only after membership/enrollment
succeeds. Viewing, joining, and skipping never activate training consent.

Invite pages use no-referrer/no-store headers. Review-label events are excluded
from PostHog/Sentry capture and invite tokens are scrubbed from later referrers
and breadcrumbs. Tracking uses the dedicated endpoint, independent of analytics.

## Review data and labels

The server walks all PRs in stable creation order, importing only PRs closed by
the collection cutoff. Participation is checked by GitHub numeric ID against PR
authorship, submitted reviews, inline comments, and discussion comments. There
is no author-only filter on the comments: human and bot root review comments are
both imported when their Go/Rust hunk is available.

REST pagination captures reviews, inline comments, discussion participation, and
files. GraphQL pagination captures thread resolution/outdated state. Source
snapshots are immutable once captured. Retrying a scan does not replace a
snapshot that may already have been labeled. The cursor advances only after a
successful capture; concurrent tabs use conditional cursor updates.

The UI shows one comment and its original hunk. It preserves comment/reply text,
shows later approvals without review text or inline comments, and puts bot
comments with follow-up evidence first. Thread resolution is shown as an
observation; the UI does not claim that resolution alone proves a fix was made
or that the code was unchanged. No model judges disagreement or suggests labels.

All/Human/Bot filters apply to the queue and comment flow. Finishing a filtered
set offers an explicit continuation to remaining authors. G/B/S shortcuts save
labels outside form controls. Previously labeled comments can be reopened to
change their label. Missed entries select a source hunk and allow one line of up
to 280 characters; one current missed entry is stored per hunk.

Source scanning continues while the reviewer keeps the page open and resumes
from its persisted cursor on return. The queue is usable during capture. GitHub
failures pause capture with Retry, never silently advance it. PRs exceeding
GitHub's 3,000-file limit are not imported as complete. Unavailable Go/Rust file
patches are called out in the PR so absent hunks are not invented.

Every label is built in the database from the immutable source snapshot. The
client can submit only the target ID, decision, optional missed note, and consent
notice version. Reviewer identity, hunk, comment, and timestamp are server-owned.
The first Good/Bad/Missed save atomically records the displayed consent version.
Exports are personal UTF-8 JSONL with one current record per label, including:

`schema_version`, `reviewer_login`, `reviewer_github_id`, `repo`, `pr_number`,
`pr_id`, `file_path`, `hunk`, `hunk_id`, `comment`, `label`, `note`, `timestamp`,
`consent_id`, `consent_version`, and `campaign_id`.

`comment` includes its author, verbatim body, original commit/line, replies,
resolution/outdated observations, and later approvals. Missed records have a
null comment and carry the selected hunk/note. Skip records do not create
consent. No training or automated twin-reviewer handoff runs in this feature.

Withdrawal atomically deletes the person's labels, clears consent, and records
a revocation keyed by consent ID. The person can download that manifest even
after losing workspace membership. Previously downloaded files must be handled
by the consumer; they cannot be recalled automatically.

## Runtime and deployment

The endpoint is `/.netlify/functions/api-review-labels`. It requires server-only
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GITHUB_TOKEN`. Use the existing
GitHub OAuth configuration for the browser. Never put the service key or GitHub
token in `VITE_*` variables.

Run Vite with Netlify Dev on port 8888 for real local API requests. Vite already
proxies `/.netlify/functions`. Vite alone shows the signed-out screen but cannot
serve the API. The sample flow remains available at `/review-labels/prototype`
without backend configuration in development.

For routine local QA, prefer the isolated runner above rather than configuring
the production handler with a hosted service-role key.

Before rollout:

1. Review and apply `supabase/migrations/20260907220000_review_labels.sql` using
   `supabase db push` against the intended environment; avoid applying unrelated
   pending migrations accidentally. Run Supabase security advisors afterward.
2. Verify the server-only variables and GitHub OAuth return configuration, then
   deploy the Netlify function and frontend together. No production invitation,
   enrollment, label, or consent has been created by this implementation work.
3. Select the real Paper Compute workspace and its public `tapes` / `tapesctl`
   repositories. Verify the workspace's member limit covers the pilot.
4. Create personal links for `yeazelm` and `jpmcb`, share them intentionally, and
   verify Viewed → Accepted with separate GitHub accounts before collecting labels.

All new tables enable RLS and revoke access from PUBLIC, anon, and authenticated.
Only the service role accesses them through the endpoint's authorization checks.
Even workspace owners cannot read another person's labels. The acceptance RPC
is service-only and checks `auth.identities` under a fixed search path; other
RPCs run with invoker privileges. The API rechecks workspace membership,
repository selection, cached privacy, and current GitHub privacy for review
reads, saves, and exports.

## Adding paper and other private repositories

`tapesctl` is public and uses the existing public path. `paper`, `paper-forest`,
and `cloud` need a separate rollout:

1. Confirm contributor.info's GitHub App installation covers each private repo
   and the workspace/reviewer is authorized. Use installation tokens through
   `getTokenForRepo`; do not extend the public shared-token path to private repos.
2. Apply the same current-access checks to capture, every read, and export;
   stop access when membership or the installation is revoked. Verify private
   snapshots cannot enter public data paths or caches.
3. Add the explicitly selected repos to a new collection, preserving the old
   collection's cutoff, labels, and consent scope. Issue fresh personal invites
   so new scope is clear and substantive labels record separate consent.
4. Test installation loss, repo transfer, member removal, private/public
   transitions, and consent withdrawal before enabling private selection.

## Validation

- `npm run typecheck` and `npm run build`.
- Focused ESLint for the changed frontend and server files.
- `npx vitest run netlify/functions/lib/__tests__/review-label-github.test.ts`:
  participation by ID, human/bot source fidelity, pushback context, Go/Rust hunks,
  URL suffix, and nested token redaction.
- `bash scripts/testing-tools/test-review-labels-migration.sh`: disposable local
  Postgres with minimal existing-table contracts plus the actual migration;
  checks identity binding, atomic/idempotent acceptance, member caps, visit
  deduplication, source fidelity, private labels, consent, withdrawal, and grants.
  This does not establish that every deployed workspace trigger is compatible.
- Browser checks with isolated API fixtures cover invitation reload/acceptance,
  link creation, human labeling, explicit bot continuation, missed persistence,
  and no horizontal overflow at 390, 853, and 1440 pixels.
- Read-only live GitHub capture verified `papercomputeco/tapes#54`: a human
  `jpmcb` review and 11 Go hunks. Nothing was stored in a deployed database.

Security-advisor tooling was not available in this session. Local role/grant
tests passed; deployment advisors still need to run after applying the migration.
