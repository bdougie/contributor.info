import { BaseCaptureScript } from './lib/base-capture.js';
import { ensureContributor } from './lib/contributor-utils.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class PRCommentsCaptureScript extends BaseCaptureScript {
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

    console.log(`Initialized PR Comments Capture for ${this.repositoryName}`);
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

      console.log(`Found ${prs?.length || 0} PRs to process comments for`);
      return prs || [];
    } catch (error) {
      console.error('Failed to get PRs to process:', error);
      return [];
    }
  }

  async processItem(pr) {
    const [owner, repo] = this.repositoryName.split('/');

    this.log(`Processing comments for PR #${pr.number}...`);

    try {
      // Fetch issue comments using REST API
      // Note: This script intentionally uses REST API for comments.
      // While GraphQL is available via hybridClient.getPRComments(),
      // REST provides cleaner separation between comment types.
      // See docs/data-fetching/api-strategy.md for details.
      const { data: issueComments } = await this.octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: pr.number,
        per_page: 100,
      });

      // Process issue comments
      for (const comment of issueComments) {
        // Ensure comment author exists and get UUID
        let commentAuthorId = null;
        if (comment.user) {
          commentAuthorId = await ensureContributor(this.supabase, comment.user, this.repositoryName);
        }

        const commentRecord = {
          repository_id: this.repositoryId,
          github_id: comment.id,
          pull_request_number: pr.number,
          body: comment.body,
          commenter_id: commentAuthorId, // Now using contributor UUID
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          html_url: comment.html_url,
          type: 'issue_comment',
        };

        const { error } = await this.supabase.from('comments').upsert(commentRecord, {
          onConflict: 'github_id',
        });

        if (error) {
          console.error(`Failed to upsert comment ${comment.id}:`, error);
        }
      }

      this.log(`✓ Captured ${issueComments.length} issue comments for PR #${pr.number}`);
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
const script = new PRCommentsCaptureScript();
script.run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
