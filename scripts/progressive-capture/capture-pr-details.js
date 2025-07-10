import { BaseCaptureScript } from './lib/base-capture.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class PRDetailsCaptureScript extends BaseCaptureScript {
  constructor() {
    super({
      repositoryId: process.env.REPOSITORY_ID,
      repositoryName: process.env.REPOSITORY_NAME,
      jobId: process.env.JOB_ID
    });
    
    this.prNumbers = process.env.PR_NUMBERS?.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)) || [];
    this.timeRange = parseInt(process.env.TIME_RANGE || '30');
    
    console.log(`Initialized PR Details Capture for ${this.repositoryName}`);
    console.log(`PR Numbers: ${this.prNumbers.length > 0 ? this.prNumbers.join(', ') : 'All recent PRs'}`);
    console.log(`Time Range: ${this.timeRange} days`);
  }

  async getItemsToProcess() {
    if (this.prNumbers.length > 0) {
      // Specific PRs requested
      return this.prNumbers.map(number => ({ number }));
    }
    
    // Get recent PRs from database that need details
    const since = new Date();
    since.setDate(since.getDate() - this.timeRange);
    
    try {
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

      console.log(`Found ${prs?.length || 0} PRs needing details`);
      return prs || [];
    } catch (error) {
      console.error('Failed to get PRs to process:', error);
      return [];
    }
  }

  async processItem(pr) {
    const [owner, repo] = this.repositoryName.split('/');
    
    this.log(`Processing PR #${pr.number}...`);
    
    try {
      // Fetch PR details from GitHub
      const { data: prData } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: pr.number
      });
      
      // Fetch file changes
      const { data: files } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
        per_page: 100
      });
      
      // Prepare data for database
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
        file_changes: files.map(f => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          status: f.status,
          patch: f.patch
        }))
      };
      
      // Update database
      const { error } = await this.supabase
        .from('pull_requests')
        .upsert(prRecord, {
          onConflict: 'repository_id,number'
        });

      if (error) {
        throw new Error(`Database upsert failed: ${error.message}`);
      }
      
      this.log(`✓ Captured details for PR #${pr.number} (${files.length} files)`);
      
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
const script = new PRDetailsCaptureScript();
script.run().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});