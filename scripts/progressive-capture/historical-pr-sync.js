import { BaseCaptureScript } from './lib/base-capture.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class HistoricalPRSyncScript extends BaseCaptureScript {
  constructor() {
    super({
      repositoryId: process.env.REPOSITORY_ID,
      repositoryName: process.env.REPOSITORY_NAME,
      jobId: process.env.JOB_ID,
    });

    this.daysBack = parseInt(process.env.DAYS_BACK || '30');
    this.maxItems = parseInt(process.env.MAX_ITEMS || '1000');

    console.log(`Initialized Historical PR Sync for ${this.repositoryName}`);
    console.log(`Days back: ${this.daysBack}, Max items: ${this.maxItems}`);
  }

  async getItemsToProcess() {
    const [owner, repo] = this.repositoryName.split('/');

    // Calculate date range
    const since = new Date();
    since.setDate(since.getDate() - this.daysBack);

    this.log(`Fetching PRs from GitHub since ${since.toISOString()}`);

    try {
      // Get PRs from GitHub that are older than 24 hours (historical data)
      const cutoffTime = new Date();
      cutoffTime.setDate(cutoffTime.getDate() - 1); // 24 hours ago

      const { data: prs } = await this.octokit.rest.pulls.list({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        since: since.toISOString(),
      });

      // Filter PRs that are older than 24 hours
      const historicalPRs = prs
        .filter((pr) => {
          const prDate = new Date(pr.updated_at);
          return prDate < cutoffTime;
        })
        .slice(0, this.maxItems);

      this.log(`Found ${historicalPRs.length} historical PRs to process`);

      return historicalPRs.map((pr) => ({
        number: pr.number,
        updated_at: pr.updated_at,
        state: pr.state,
      }));
    } catch (error) {
      console.error('Failed to fetch PRs from GitHub:', error);
      return [];
    }
  }

  async processItem(pr) {
    const [owner, repo] = this.repositoryName.split('/');

    this.log(`Processing historical data for PR #${pr.number}...`);

    try {
      // Check if PR already exists in database
      const { data: existingPR } = await this.supabase
        .from('pull_requests')
        .select('number, updated_at')
        .eq('repository_id', this.repositoryId)
        .eq('number', pr.number)
        .single();

      // Skip if PR is already up to date
      if (existingPR && new Date(existingPR.updated_at) >= new Date(pr.updated_at)) {
        this.log(`PR #${pr.number} already up to date, skipping`);
        return;
      }

      // Fetch comprehensive PR data
      const [
        { data: prData },
        { data: files },
        { data: reviews },
        { data: issueComments },
        { data: reviewComments },
      ] = await Promise.all([
        this.octokit.rest.pulls.get({ owner, repo, pull_number: pr.number }),
        this.octokit.rest.pulls.listFiles({ owner, repo, pull_number: pr.number, per_page: 100 }),
        this.octokit.rest.pulls.listReviews({ owner, repo, pull_number: pr.number, per_page: 100 }),
        this.octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: pr.number,
          per_page: 100,
        }),
        this.octokit.rest.pulls.listReviewComments({
          owner,
          repo,
          pull_number: pr.number,
          per_page: 100,
        }),
      ]);

      // Process PR details
      const prRecord = {
        repository_id: this.repositoryId,
        github_id: prData.id,
        number: prData.number,
        title: prData.title,
        body: prData.body,
        state: prData.state,
        draft: prData.draft,
        additions: prData.additions,
        deletions: prData.deletions,
        changed_files: prData.changed_files,
        commits: prData.commits,
        author_id: prData.user.id,
        author_login: prData.user.login,
        author_avatar_url: prData.user.avatar_url,
        created_at: prData.created_at,
        updated_at: prData.updated_at,
        closed_at: prData.closed_at,
        merged_at: prData.merged_at,
        merged: prData.merged,
        mergeable: prData.mergeable,
        merged_by_id: prData.merged_by?.id,
        merged_by_login: prData.merged_by?.login,
        base_ref: prData.base.ref,
        head_ref: prData.head.ref,
        head_sha: prData.head.sha,
        file_changes: files.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          status: f.status,
          patch: f.patch,
        })),
      };

      // Upsert PR
      const { error: prError } = await this.supabase
        .from('pull_requests')
        .upsert(prRecord, { onConflict: 'repository_id,number' });

      if (prError) {
        console.error(`Failed to upsert PR ${pr.number}:`, prError);
      }

      // Process reviews
      for (const review of reviews) {
        const reviewRecord = {
          repository_id: this.repositoryId,
          github_id: review.id,
          pull_request_number: pr.number,
          state: review.state,
          body: review.body,
          author_id: review.user?.id,
          author_login: review.user?.login,
          author_avatar_url: review.user?.avatar_url,
          submitted_at: review.submitted_at,
          commit_id: review.commit_id,
          html_url: review.html_url,
        };

        const { error } = await this.supabase
          .from('reviews')
          .upsert(reviewRecord, { onConflict: 'github_id' });

        if (error) {
          console.error(`Failed to upsert review ${review.id}:`, error);
        }
      }

      // Process comments (both issue and review comments)
      const allComments = [
        ...issueComments.map((c) => ({ ...c, type: 'issue_comment' })),
        ...reviewComments.map((c) => ({ ...c, type: 'review_comment' })),
      ];

      for (const comment of allComments) {
        const commentRecord = {
          repository_id: this.repositoryId,
          github_id: comment.id,
          pull_request_number: pr.number,
          review_id: comment.pull_request_review_id,
          body: comment.body,
          path: comment.path,
          position: comment.position,
          original_position: comment.original_position,
          commit_id: comment.commit_id,
          original_commit_id: comment.original_commit_id,
          diff_hunk: comment.diff_hunk,
          author_id: comment.user?.id,
          author_login: comment.user?.login,
          author_avatar_url: comment.user?.avatar_url,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          html_url: comment.html_url,
          in_reply_to_id: comment.in_reply_to_id,
          type: comment.type,
        };

        const { error } = await this.supabase
          .from('comments')
          .upsert(commentRecord, { onConflict: 'github_id' });

        if (error) {
          console.error(`Failed to upsert comment ${comment.id}:`, error);
        }
      }

      this.log(
        `✓ Synced PR #${pr.number} with ${reviews.length} reviews and ${allComments.length} comments`
      );
    } catch (error) {
      if (error.status === 404) {
        this.log(`PR #${pr.number} not found (may have been deleted)`, 'warn');
      } else {
        throw error;
      }
    }
  }

  getTotalItems() {
    return this.maxItems;
  }
}

// Run the script
const script = new HistoricalPRSyncScript();
script.run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
