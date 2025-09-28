import { supabase } from './supabase';
import GitHubAPIService from '../services/github-api.service';

/**
 * Fetches commits from GitHub and stores them in the database
 * This function populates the commits table which is then analyzed
 * by the smart-commit-analyzer to determine direct commits
 */
export async function captureCommits(
  owner: string,
  repo: string,
  since?: Date
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    // Get repository ID first
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (repoError || !repoData) {
      return {
        success: false,
        count: 0,
        error: `Repository not found: ${owner}/${repo}`
      };
    }

    // Calculate date range - default to last 30 days
    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Fetch commits from GitHub
    console.log(`[Capture Commits] Fetching commits for ${owner}/${repo} since ${sinceDate.toISOString()}`);

    const githubApiService = new GitHubAPIService(process.env.VITE_GITHUB_TOKEN);
    const commits = await githubApiService.fetchCommits(owner, repo, {
      since: sinceDate.toISOString(),
      per_page: 100
    });

    if (!commits || commits.length === 0) {
      console.log(`[Capture Commits] No commits found for ${owner}/${repo}`);
      return { success: true, count: 0 };
    }

    console.log(`[Capture Commits] Found ${commits.length} commits to process`);

    // Get or create contributor records for commit authors
    const authorMap = new Map<string, string>();

    for (const commit of commits) {
      if (commit.author && !authorMap.has(commit.author.login)) {
        // Check if contributor exists
        const { data: contributor, error: contribError } = await supabase
          .from('contributors')
          .select('id')
          .eq('username', commit.author.login)
          .maybeSingle();

        if (!contribError && contributor) {
          authorMap.set(commit.author.login, contributor.id);
        } else if (!contribError) {
          // Create contributor if doesn't exist
          const { data: newContributor, error: insertError } = await supabase
            .from('contributors')
            .insert({
              username: commit.author.login,
              avatar_url: commit.author.avatar_url || '',
              profile_url: commit.author.html_url || ''
            })
            .select('id')
            .single();

          if (!insertError && newContributor) {
            authorMap.set(commit.author.login, newContributor.id);
          }
        }
      }
    }

    // Prepare commit records
    const commitRecords = commits.map(commit => ({
      repository_id: repoData.id,
      sha: commit.sha,
      author_id: commit.author ? authorMap.get(commit.author.login) : null,
      message: commit.commit.message,
      authored_at: commit.commit.author?.date || new Date().toISOString(),
      // Initially null - will be set by smart-commit-analyzer
      is_direct_commit: null,
      pull_request_id: null
    }));

    // Insert commits (using upsert to handle duplicates)
    const { error: insertError } = await supabase
      .from('commits')
      .upsert(commitRecords, {
        onConflict: 'repository_id,sha',
        ignoreDuplicates: false
      });

    if (insertError) {
      console.error('[Capture Commits] Error inserting commits:', insertError);
      return {
        success: false,
        count: 0,
        error: insertError.message
      };
    }

    console.log(`[Capture Commits] Successfully captured ${commitRecords.length} commits`);

    // Queue commit analysis jobs
    const analysisJobs = commitRecords.map(commit => ({
      repository_id: repoData.id,
      job_type: 'commit_pr_check',
      resource_id: commit.sha,
      priority: 'medium',
      status: 'pending',
      metadata: {
        message: commit.message?.substring(0, 100) // Store first 100 chars for debugging
      }
    }));

    const { error: jobError } = await supabase
      .from('progressive_capture_jobs')
      .upsert(analysisJobs, {
        onConflict: 'repository_id,job_type,resource_id',
        ignoreDuplicates: true
      });

    if (jobError) {
      console.warn('[Capture Commits] Warning: Could not queue analysis jobs:', jobError);
      // Don't fail the whole operation if job queuing fails
    }

    return {
      success: true,
      count: commitRecords.length
    };
  } catch (error) {
    console.error('[Capture Commits] Unexpected error:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}