import { BaseCaptureScript } from './lib/base-capture.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class PRDetailsGraphQLCaptureScript extends BaseCaptureScript {
  constructor() {
    super({
      repositoryId: process.env.REPOSITORY_ID,
      repositoryName: process.env.REPOSITORY_NAME,
      jobId: process.env.JOB_ID
    });
    
    this.prNumbers = process.env.PR_NUMBERS?.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)) || [];
    this.timeRange = parseInt(process.env.TIME_RANGE || '30');
    this.useGraphQL = process.env.USE_GRAPHQL !== 'false'; // Default to true
    
    // Configure hybrid client
    this.hybridClient.setGraphQLEnabled(this.useGraphQL);
    
    console.log(`Initialized GraphQL PR Details Capture for ${this.repositoryName}`);
    console.log(`PR Numbers: ${this.prNumbers.length > 0 ? this.prNumbers.join(', ') : 'All recent PRs'}`);
    console.log(`Time Range: ${this.timeRange} days`);
    console.log(`GraphQL Enabled: ${this.useGraphQL}`);
  }

  async getItemsToProcess() {
    if (this.prNumbers.length > 0) {
      // Specific PRs requested
      return this.prNumbers.map(number => ({ number }));
    }
    
    // Use GraphQL to get recent PRs that need details
    const [owner, repo] = this.repositoryName.split('/');
    const since = new Date();
    since.setDate(since.getDate() - this.timeRange);
    
    try {
      if (this.useGraphQL) {
        const recentPRs = await this.hybridClient.getRecentPRs(owner, repo, since.toISOString(), 100);
        
        // Filter to PRs that might need details (this is a simplified check)
        const filteredPRs = recentPRs.filter(pr => {
          // In a real implementation, you might query the database to see which PRs need updates
          return true; // For now, process all recent PRs
        });
        
        console.log(`Found ${filteredPRs.length} recent PRs via GraphQL`);
        return filteredPRs.map(pr => ({ number: pr.number }));
      } else {
        // Fallback to database query
        const { data: prs, error } = await this.supabase
          .from('pull_requests')
          .select('number')
          .eq('repository_id', this.repositoryId)
          .gt('created_at', since.toISOString())
          .is('additions', null) // Missing file change data
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('Database query error:', error);
          return [];
        }

        console.log(`Found ${prs?.length || 0} PRs needing details from database`);
        return prs || [];
      }
    } catch (error) {
      console.error('Failed to get PRs to process:', error);
      return [];
    }
  }

  async processItem(pr) {
    const [owner, repo] = this.repositoryName.split('/');
    
    this.log(`Processing PR #${pr.number} with ${this.useGraphQL ? 'GraphQL' : 'REST'}...`);
    
    try {
      // Use hybrid client to get complete PR data
      const completeData = await this.hybridClient.getPRCompleteData(owner, repo, pr.number);
      
      // Extract data from the response
      const prData = completeData.pullRequest;
      const files = completeData.files || [];
      const reviews = completeData.reviews || [];
      const issueComments = completeData.issueComments || [];
      const reviewComments = completeData.reviewComments || [];
      
      // Prepare PR record for database
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
        author_id: prData.user?.id,
        author_login: prData.user?.login,
        author_avatar_url: prData.user?.avatar_url,
        created_at: prData.created_at,
        updated_at: prData.updated_at,
        closed_at: prData.closed_at,
        merged_at: prData.merged_at,
        merged: prData.merged,
        mergeable: prData.mergeable,
        merged_by_id: prData.merged_by?.id,
        merged_by_login: prData.merged_by?.login,
        base_ref: prData.base?.ref,
        head_ref: prData.head?.ref,
        file_changes: files.map(f => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          status: f.status
        }))
      };
      
      // Single database transaction for all data
      const { error: prError } = await this.supabase
        .from('pull_requests')
        .upsert(prRecord, {
          onConflict: 'repository_id,number'
        });

      if (prError) {
        throw new Error(`Failed to upsert PR: ${prError.message}`);
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
          html_url: review.html_url
        };
        
        const { error } = await this.supabase
          .from('reviews')
          .upsert(reviewRecord, { onConflict: 'github_id' });
        
        if (error) {
          console.error(`Failed to upsert review ${review.id}:`, error);
        }
      }

      // Process comments
      const allComments = [
        ...issueComments.map(c => ({ ...c, type: 'issue_comment' })),
        ...reviewComments.map(c => ({ ...c, type: 'review_comment' }))
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
          diff_hunk: comment.diff_hunk,
          author_id: comment.user?.id,
          author_login: comment.user?.login,
          author_avatar_url: comment.user?.avatar_url,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          html_url: comment.html_url,
          in_reply_to_id: comment.in_reply_to_id,
          type: comment.type
        };
        
        const { error } = await this.supabase
          .from('comments')
          .upsert(commentRecord, { onConflict: 'github_id' });
        
        if (error) {
          console.error(`Failed to upsert comment ${comment.id}:`, error);
        }
      }
      
      // Log rate limit info if available
      if (completeData.rateLimit) {
        this.log(`Rate limit - Cost: ${completeData.rateLimit.cost}, Remaining: ${completeData.rateLimit.remaining}`);
      }
      
      this.log(`✓ Captured complete data for PR #${pr.number} (${files.length} files, ${reviews.length} reviews, ${allComments.length} comments)`);
      
    } catch (error) {
      if (error.status === 404) {
        this.log(`PR #${pr.number} not found (may have been deleted)`, 'warn');
      } else {
        throw error;
      }
    }
  }

  getTotalItems() {
    return this.prNumbers.length || 100; // Estimate for progress tracking
  }
}

// Run the script
const script = new PRDetailsGraphQLCaptureScript();
script.run().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});