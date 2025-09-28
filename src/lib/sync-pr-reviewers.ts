import { supabase } from '@/lib/supabase';
import { getGitHubAPIAdapter } from '@/lib/github-api-adapter';

export interface PRWithReviewers {
  github_id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  repository_owner: string;
  repository_name: string;
  author: {
    username: string;
    avatar_url: string;
  };
  requested_reviewers: Array<{
    username: string;
    avatar_url: string;
  }>;
  reviewers: Array<{
    username: string;
    avatar_url: string;
    approved: boolean;
    state: string;
    submitted_at: string;
  }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

export interface SyncOptions {
  includeClosedPRs?: boolean;
  maxClosedDays?: number; // How many days back to fetch closed PRs
  updateDatabase?: boolean; // Whether to update database with fetched data
  useLocalBackoff?: boolean; // Use local exponential backoff instead of edge function
}

/**
 * Fetches the latest PR data from GitHub including requested reviewers
 * Now with exponential backoff support for improved reliability
 * @param owner Repository owner
 * @param repo Repository name
 * @param workspaceId Optional workspace ID for tracking
 * @param options Sync options for controlling what data to fetch
 * @returns Array of PRs with reviewer data
 */
export async function syncPullRequestReviewers(
  owner: string,
  repo: string,
  workspaceId?: string,
  options: SyncOptions = {}
): Promise<PRWithReviewers[]> {
  try {
    const {
      includeClosedPRs = true,
      maxClosedDays = 30,
      updateDatabase = true,
      useLocalBackoff = false
    } = options;

    console.log('Syncing PR reviewers for %s/%s', owner, repo, { includeClosedPRs, maxClosedDays, useLocalBackoff });

    // Use local exponential backoff if specified or if edge function fails
    if (useLocalBackoff) {
      const adapter = getGitHubAPIAdapter();
      const prs = await adapter.fetchPullRequestsWithReviewers(owner, repo, {
        includeClosedPRs,
        maxClosedDays,
      });

      // Update database if requested
      if (updateDatabase && prs.length > 0) {
        // TODO: Update database with PR data
        console.log('Local backoff sync complete. Database update pending implementation.');
      }

      return prs;
    }

    // Default: Use edge function (which will also be updated to use exponential backoff)
    const { data, error } = await supabase.functions.invoke('sync-pr-reviewers', {
      body: {
        owner,
        repo,
        workspace_id: workspaceId,
        include_closed: includeClosedPRs,
        max_closed_days: maxClosedDays,
        update_database: updateDatabase,
      },
    });

    if (error) {
      console.error('Error syncing PR reviewers via edge function:', error);
      console.log('Falling back to local exponential backoff');

      // Fallback to local backoff on edge function failure
      const adapter = getGitHubAPIAdapter();
      return await adapter.fetchPullRequestsWithReviewers(owner, repo, {
        includeClosedPRs,
        maxClosedDays,
      });
    }

    if (!data.success) {
      console.error('Sync failed:', data.error);
      console.log('Falling back to local exponential backoff');

      // Fallback to local backoff on sync failure
      const adapter = getGitHubAPIAdapter();
      return await adapter.fetchPullRequestsWithReviewers(owner, repo, {
        includeClosedPRs,
        maxClosedDays,
      });
    }

    console.log(
      'Successfully synced %d PRs (%d open, %d closed)',
      data.prs?.length || 0,
      data.openCount || 0,
      data.closedCount || 0
    );
    return data.prs || [];
  } catch (error) {
    console.error('Failed to sync PR reviewers:', error);

    // Final fallback to local backoff
    try {
      console.log('Final fallback to local exponential backoff');
      const adapter = getGitHubAPIAdapter();
      return await adapter.fetchPullRequestsWithReviewers(owner, repo, {
        includeClosedPRs: options.includeClosedPRs ?? true,
        maxClosedDays: options.maxClosedDays ?? 30,
      });
    } catch (fallbackError) {
      console.error('Local backoff also failed:', fallbackError);
      return [];
    }
  }
}

interface TransformedPR {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  repository: {
    owner: string;
    name: string;
  };
  author: {
    username: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  requested_reviewers: Array<{
    username: string;
    avatar_url: string;
  }>;
  reviewers: Array<{
    username: string;
    avatar_url: string;
    approved: boolean;
    state: string;
    submitted_at: string;
  }>;
  comments_count: number;
  commits_count: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: string[];
  url: string;
}

/**
 * Transforms the PR data from the edge function to match our PullRequest interface
 */
export function transformPRData(pr: PRWithReviewers): TransformedPR {
  return {
    id: pr.github_id.toString(),
    number: pr.number,
    title: pr.title,
    state: pr.draft ? 'draft' : (pr.state as 'open' | 'closed' | 'merged'),
    repository: {
      owner: pr.repository_owner,
      name: pr.repository_name,
    },
    author: {
      username: pr.author.username,
      avatar_url: pr.author.avatar_url,
    },
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    closed_at: pr.closed_at,
    merged_at: pr.merged_at,
    // Include both requested reviewers and actual reviewers
    requested_reviewers: pr.requested_reviewers,
    reviewers: pr.reviewers,
    // Default values for missing fields
    comments_count: 0,
    commits_count: 0,
    additions: 0,
    deletions: 0,
    changed_files: 0,
    labels: [],
    url: `https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`,
  };
}
