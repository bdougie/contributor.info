# Contributor Reviews and Export

The contributor profile modal in a workspace has a **Reviews** tab. It lists every
review the contributor submitted on pull requests in the workspace's tracked
repositories, newest first, and lets you export that history for use outside
the product, for example as a labeling corpus.

## What it shows

- One row per submitted review: PR number and title, repository, submission
  date, review state, and the review summary body.
- A count of inline review comments attached to that review.
- Header totals: reviews, approvals, changes requested, inline comments.

Data is read on demand when the tab is opened, not when the modal opens.

## Export

### Several contributors at once

On the workspace Contributors tab, tick the contributors you want and use
**Export Reviews** in the selection bar. It fetches each person's full review
history and downloads one combined file, JSONL or CSV, named
`review-corpus_reviews_<date>.<ext>`. Every record carries a `reviewer` field
so the file can be split per person later.

### One contributor

Two buttons in the Reviews tab header of the profile modal:

- **CSV** flattens one row per review with a comment count. Good for
  spreadsheets.
- **JSONL** writes one JSON object per line with inline comments nested,
  including `path`, `position`, `diff_hunk`, and `in_reply_to_id`. This is the
  shape a labeling tool consumes.

Filenames follow `<username>_reviews_<date>.<ext>`.

## Where the data comes from

- `reviews` filtered on `author_id`. That column is set by every writer. The
  older `reviewer_id` column is null on more than half of rows, so it is not
  used.
- `comments` filtered on `commenter_id` and `comment_type = 'review_comment'`.
- Both reads page through results in batches of 1,000, and the comment read is
  chunked by pull request id, so long histories export completely.

GitHub does not store a review id on review comments. Comments are attached to
a review on the same pull request by commit id first, then by picking the
earliest review submitted at or after the comment. See
`src/lib/contributors/contributor-reviews.ts`.

## Completeness

The tab only shows what has been captured. Review capture in this repo is
dispatched per pull request with per-sync caps, so older PRs may be missing
until a backfill runs. The `gh-datapipe` unified backfill writes to the same
tables and, since its pagination fix, walks the full PR history for a date
range.

## Files

- `src/hooks/useContributorReviews.ts`
- `src/lib/contributors/fetch-contributor-reviews.ts` (shared fetch used by the hook and the bulk export)
- `src/lib/contributors/contributor-reviews.ts`
- `src/components/features/workspace/ContributorReviewsTab.tsx`
- `src/lib/utils/csv-export.ts` (review CSV and JSONL exports)
