# Contributor profiles: design and UX review

Reviewed September 7, 2026 on `/i/open-source-repos/contributors`, using the running local app at desktop and 390px/320px mobile widths.

The profile contains substantial value—contribution history, reviews, AI insights, and relationship context—but the contributors page presents it primarily as a management table. A person scanning the page sees Add Contributors, Manage Groups, and Export CSV before learning that each contributor has an interactive profile.

| Finding | Change implemented |
| --- | --- |
| Names looked like ordinary table text; View Profile was also inside the overflow menu. | Persistent, accented “View profile” text beside each identity, in both table and grid views. Introductory copy explains what is inside. |
| Grid avatars opened group management while names opened profiles. | Both identity targets open the profile. Group management has its own labeled action. |
| Opening the modal and changing tabs left the URL unchanged. | `?contributor=bdougie&profileTab=reviews` identifies the profile and section. Copy link shares that location. |
| Refresh and browser navigation discarded the profile. | The URL controls selection. Opening pushes one history entry; tabs replace it. Back closes, Forward restores, and a shared link closes within its workspace. Other query parameters and hashes are retained. |
| Six equal-width tabs collided on mobile. | Two rows of three tabs on small screens; six columns on desktop. The tab bar stays visible while scrolling. |
| Biography and account management preceded contribution value. | Contribution Summary appears first. The unrelated Login Required label was removed from the profile identity area. |
| An empty “Groups:” line occupied space above the table. | Group filters appear when groups exist. |
| URL changes refetched the logged-out workspace, resetting list search and view. | Stabilized the empty workspace value. Closing also restores focus to the current profile trigger, including when table cells remount. |
| Grid cards were displaced below their container by a duplicated page offset. | Subtracted the scroll margin when positioning virtual rows. |

The next design iteration should prioritize data confidence. `src/hooks/useWorkspaceContributors.ts` currently generates commits, comments, and contribution trends with `Math.random()`. These values change on reload and can contradict the impression of an evidence-based profile. Replace them with measured values or explicit unavailable states before promoting those metrics more widely. This data correction is separate from the navigation and discovery changes above.

Further opportunities: open profiles from contributor identities in workspace activity and review views; make a review count a direct entry to the Reviews section; reduce empty social fields for readers; explain the time period and repository scope beside statistics. Measure profile opens per contributors-page visit and transitions into Reviews/AI Insights to assess whether discovery improves. These are recommendations, not implemented features.

Profile resolution currently uses contributors loaded for the selected workspace repositories. A missing username produces an explicit unavailable state with a route back to the contributors list. Private notes and AI features retain their existing permission checks.

Validation covers navigation state tests, existing workspace hook tests, TypeScript, lint, formatting, production build, and browser checks for shared links, clipboard, refresh, Back/Forward, dismissal, focus, preserved search/view, grid placement, and mobile tab usability. Browser checks used a logged-out session; member-only note and group edits were not exercised against live data.
