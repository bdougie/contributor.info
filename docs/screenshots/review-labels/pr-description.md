<!-- Suggested title: Add workspace review labeling with tracked invitations -->
<!-- Before publishing this PR body, replace the relative screenshot references
with raw URLs pinned to the pushed commit or GitHub attachment URLs. -->

Workspace members can now label past review comments at `/review-labels`, using
Good, Bad, or Skip, and record an optional missed issue against a PR hunk.
Label reviews stays visible whenever a workspace is active. Reviewers see only
PRs they participated in, with comments from people and bots preserved verbatim.

Owners select repositories and create personal workspace invitations ending in
`/invite`. Link views and invite acceptance are recorded separately. Labels stay
personal, and the first Good, Bad, or Missed save records consent. JSONL exports
keep the reviewer, source hunk, original comment, context, and label together.

## Screenshots

These captures use synthetic PR fixtures. **QA** runs the actual local Auth,
API, and database; **Prototype** is a simulated design reference. The QA toolbar,
local setup instructions, and prototype are excluded from production builds.

**Human review:** a teammate's comment, original hunk, and Good/Bad/Skip actions.

![QA human review](04-qa-human-review.png)

**Bot pushback:** the original flag stays visible alongside a disagreeing reply,
resolution, and later approval.

![QA bot review with pushback](05-qa-bot-pushback.png)

**Missed issue:** one optional line, attached to a selected hunk.

![QA missed issue](06-qa-missed.png)

**Invitation tracking:** a viewed link is distinct from acceptance by the
invited account.

![QA invitation activity](07-qa-invite-tracking.png)

<details>
<summary>Invitation, prototype queue, and mobile screenshots</summary>

Implemented personal invitation:

![QA invitation](03-qa-invitation.png)

Prototype invitation and repository overview:

![Prototype invitation](01-prototype-invitation.png)

Prototype queue with human reviews selected:

![Prototype human-review queue](02-prototype-human-queue.png)

Prototype review flow at 390 pixels:

<img src="08-prototype-mobile-review.png" alt="Prototype mobile review" width="390" />

</details>

## Validation

- Local QA exercised invite creation, view deduplication, wrong-account
  rejection, acceptance, human labels, missed notes, reload persistence, and
  personal JSONL export.
- Screenshot capture additionally saved a human Good label, a bot Bad label,
  and a missed note, and verified distinct Viewed and Accepted states.
- Navigation was checked on desktop and mobile, including the always-visible
  action for active workspaces.
- Type checking, focused lint, production build, and 15 existing auth tests
  passed. Normal login was verified through the redirect to GitHub; local QA
  uses seeded accounts rather than exercising the external OAuth handshake.

## Rollout

Apply `20260907220000_review_labels.sql` to the intended database and configure
the server-only Supabase and GitHub credentials before deploying the frontend
and Netlify function. This work has not changed the shared database or deployed
the feature. Public repositories are supported; private repository access is
follow-up work. Training and automated model handoff are outside this feature.
