import { BaseCaptureScript } from './lib/base-capture.js';
import { ensureContributor } from './lib/contributor-utils.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class PRReviewsCaptureScript extends BaseCaptureScript {
  constructor() {
    super({
      repositoryId: process.env.REPOSITORY_ID,
      repositoryName: process.env.REPOSITORY_NAME,
      jobId: process.env.JOB_ID,
    });

    this.prNumbers =
      process.env.PR_NUMBERS?.split(',')
        .map((n) => parseInt(n.trim()))
        .filter((n) => !isNaN(n)) || [];
    this.timeRange = parseInt(process.env.TIME_RANGE || '30');

    console.log(`Initialized PR Reviews Capture for ${this.repositoryName}`);
    console.log(
      `PR Numbers: ${this.prNumbers.length > 0 ? this.prNumbers.join(', ') : 'All recent PRs'}`
    );
  }

  async getItemsToProcess() {
    if (this.prNumbers.length > 0) {
      // Specific PRs requested
      return this.prNumbers.map((number) => ({ number }));
    }

    // Get recent PRs from database
    const since = new Date();
    since.setDate(since.getDate() - this.timeRange);

    try {
      const { data: prs, error } = await this.supabase
        .from('pull_requests')
        .select('number')
        .eq('repository_id', this.repositoryId)
        .gt('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Database query error:', error);
        return [];
      }

      console.log(`Found ${prs?.length || 0} PRs to process reviews for`);
      return prs || [];
    } catch (error) {
      console.error('Failed to get PRs to process:', error);
      return [];
    }
  }

  async processItem(pr) {
    const [owner, repo] = this.repositoryName.split('/');

    this.log(`Processing reviews for PR #${pr.number}...`);

    try {
      // Fetch PR reviews using REST API
      // Note: This script intentionally uses REST API for reviews.
      // While GraphQL is available via hybridClient.getPRReviews(),
      // REST provides simpler pagination for batch processing.
      // See docs/data-fetching/api-strategy.md for details.
      const { data: reviews } = await this.octokit.rest.pulls.listReviews({
        owner,
        repo,
        pull_number: pr.number,
        per_page: 100,
      });

      // Fetch review comments (code comments)
      const { data: reviewComments } = await this.octokit.rest.pulls.listReviewComments({
        owner,
        repo,
        pull_number: pr.number,
        per_page: 100,
      });

      // Process reviews
      for (const review of reviews) {
        // Ensure review author exists and get UUID
        let reviewAuthorId = null;
        if (review.user) {
          const reviewAuthor = await ensureContributor(this.supabase, review.user, this.repositoryName);
          reviewAuthorId = reviewAuthor?.id || null;
        }

        const reviewRecord = {
          repository_id: this.repositoryId,
          github_id: review.id,
          pull_request_number: pr.number,
          state: review.state,
          body: review.body,
          author_id: reviewAuthorId, // Now using contributor UUID
          submitted_at: review.submitted_at,
          commit_id: review.commit_id,
          html_url: review.html_url,
        };

        const { error } = await this.supabase.from('reviews').upsert(reviewRecord, {
          onConflict: 'github_id',
        });

        if (error) {
          console.error(`Failed to upsert review ${review.id}:`, error);
        }
      }

      // Process review comments
      for (const comment of reviewComments) {
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
          type: 'review_comment',
        };

        const { error } = await this.supabase.from('comments').upsert(commentRecord, {
          onConflict: 'github_id',
        });

        if (error) {
          console.error(`Failed to upsert review comment ${comment.id}:`, error);
        }
      }

      this.log(
        `✓ Captured ${reviews.length} reviews and ${reviewComments.length} review comments for PR #${pr.number}`
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
    return this.prNumbers.length || 100;
  }
}

// Run the script
const script = new PRReviewsCaptureScript();
script.run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
