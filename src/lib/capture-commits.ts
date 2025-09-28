import { supabase } from './supabase';
import GitHubAPIService from '../services/github-api.service';
import type { RestEndpointMethodTypes } from '@octokit/rest';

// Type for GitHub commit from the API
type GitHubCommit = RestEndpointMethodTypes['repos']['listCommits']['response']['data'][0];

/**
 * Fetches commits from GitHub and stores them in the database
 * This function populates the commits table which is then analyzed
 * by the smart-commit-analyzer to determine direct commits
 */
export async function captureCommits(
  owner: string,
  repo: string,
  since?: Date,
  options?: {
    batchSize?: number;
    maxPages?: number;
    githubToken?: string; // Optional token - will use user's session token if not provided
  }
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

    // Configuration with defaults
    const batchSize = options?.batchSize ||
      parseInt(process.env.VITE_GITHUB_COMMITS_BATCH_SIZE || '100', 10);
    const maxPages = options?.maxPages ||
      parseInt(process.env.VITE_GITHUB_COMMITS_MAX_PAGES || '10', 10);

    // Calculate date range - default to last 30 days
    const sinceDate = since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get GitHub token - use provided token or get from user's session
    let githubToken = options?.githubToken;

    if (!githubToken) {
      // Get token from authenticated user's session
      const { data: { session } } = await supabase.auth.getSession();
      githubToken = session?.provider_token || undefined;

      if (!githubToken) {
        // Fallback to server-side environment variables
        githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN;
      }
    }

    if (!githubToken) {
      return {
        success: false,
        count: 0,
        error: 'No GitHub token available. Please authenticate or provide a token.'
      };
    }

    // Fetch commits from GitHub
    console.log('[Capture Commits] Fetching commits for %s/%s since %s', owner, repo, sinceDate.toISOString());
    console.log('[Capture Commits] Batch size: %d, Max pages: %d', batchSize, maxPages);

    const githubApiService = new GitHubAPIService(githubToken);

    // Fetch multiple pages if needed
    let allCommits: GitHubCommit[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const commits = await githubApiService.fetchCommits(owner, repo, {
        since: sinceDate.toISOString(),
        per_page: batchSize,
        page
      });

      if (!commits || commits.length === 0) {
        hasMore = false;
      } else {
        allCommits = allCommits.concat(commits);
        console.log('[Capture Commits] Fetched page %d with %d commits', page, commits.length);

        // GitHub API returns less than per_page when no more results
        if (commits.length < batchSize) {
          hasMore = false;
        }
        page++;
      }
    }

    const commits = allCommits;

    if (!commits || commits.length === 0) {
      console.log('[Capture Commits] No commits found for %s/%s', owner, repo);
      return { success: true, count: 0 };
    }

    console.log('[Capture Commits] Found %d commits to process', commits.length);

    // Get unique authors from commits to batch process
    const uniqueAuthors = Array.from(
      new Set(commits
        .filter(c => c.author?.login)
        .map(c => c.author!.login))
    );

    // Batch fetch existing contributors
    const authorMap = new Map<string, string>();

    if (uniqueAuthors.length > 0) {
      const { data: existingContributors, error: fetchError } = await supabase
        .from('contributors')
        .select('id, username')
        .in('username', uniqueAuthors);

      if (!fetchError && existingContributors) {
        existingContributors.forEach(contrib => {
          authorMap.set(contrib.username, contrib.id);
        });
      }

      // Prepare new contributors to insert (those not found in DB)
      const newContributorUsernames = uniqueAuthors.filter(
        username => !authorMap.has(username)
      );

      if (newContributorUsernames.length > 0) {
        // Batch insert new contributors
        const newContributors = newContributorUsernames.map(username => {
          const commit = commits.find(c => c.author?.login === username);
          return {
            username,
            avatar_url: commit?.author?.avatar_url || '',
            profile_url: commit?.author?.html_url || ''
          };
        });

        const { data: insertedContributors, error: insertError } = await supabase
          .from('contributors')
          .insert(newContributors)
          .select('id, username');

        if (!insertError && insertedContributors) {
          insertedContributors.forEach(contrib => {
            authorMap.set(contrib.username, contrib.id);
          });
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

    console.log('[Capture Commits] Successfully captured %d commits', commitRecords.length);

    // Queue commit analysis jobs with correct schema
    const analysisJobs = commitRecords.map(commit => ({
      repository_id: repoData.id,
      job_type: 'commit_pr_check',
      processor_type: 'smart-commit-analyzer',
      status: 'pending',
      metadata: {
        sha: commit.sha,
        message: commit.message?.substring(0, 100) // Store first 100 chars for debugging
      }
    }));

    const { error: jobError } = await supabase
      .from('progressive_capture_jobs')
      .insert(analysisJobs);

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