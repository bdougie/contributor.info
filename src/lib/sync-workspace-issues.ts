import { supabase } from '@/lib/supabase';

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  assignees: Array<{
    login: string;
    avatar_url: string;
  }>;
  labels: Array<{
    name: string;
    color: string;
  }>;
  comments: number;
}

interface GitHubAssignee {
  login: string;
  avatar_url: string;
}

interface GitHubIssueResponse extends GitHubIssue {
  pull_request?: Record<string, unknown>;
}

/**
 * Fetch issues from a GitHub repository
 */
async function fetchIssuesFromGitHub(
  owner: string,
  repo: string,
  githubToken: string
): Promise<GitHubIssue[]> {
  try {
    const issues: GitHubIssue[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
        {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Repository ${owner}/${repo} not found on GitHub`);
          return [];
        }
        if (response.status === 403) {
          console.error(`GitHub API rate limit exceeded for ${owner}/${repo}`);
          throw new Error('GitHub API rate limit exceeded');
        }
        throw new Error(`Failed to fetch issues: ${response.statusText}`);
      }

      const data: GitHubIssue[] = await response.json();

      if (data.length === 0) {
        hasMore = false;
      } else {
        // Filter out pull requests (they have pull_request property in GitHub API)
        const issuesOnly = data.filter((item: GitHubIssueResponse) => !item.pull_request);
        issues.push(...issuesOnly);

        // Only fetch the most recent issues (last 30 days worth to save API calls)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (new Date(data[data.length - 1].updated_at) < thirtyDaysAgo) {
          hasMore = false;
        }

        page++;
      }
    }

    return issues;
  } catch (error) {
    console.error(`Error fetching issues for ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Sync workspace issues with fresh data from GitHub
 * Updates assignees and other issue metadata
 */
export async function syncWorkspaceIssues(
  owner: string,
  repo: string,
  repoId: string,
  githubToken: string
): Promise<void> {
  if (!githubToken) {
    console.warn(`No GitHub token available for syncing issues in ${owner}/${repo}`);
    return;
  }

  try {
    console.log(`Syncing issues for ${owner}/${repo}`);

    // Fetch fresh issues from GitHub
    const githubIssues = await fetchIssuesFromGitHub(owner, repo, githubToken);

    if (githubIssues.length === 0) {
      console.log(`No issues found for ${owner}/${repo}`);
      return;
    }

    // Fetch existing issues from our database
    const { data: dbIssues, error: fetchError } = await supabase
      .from('issues')
      .select('id, number, repository_id')
      .eq('repository_id', repoId);

    if (fetchError) {
      throw new Error(`Failed to fetch existing issues: ${fetchError.message}`);
    }

    const dbIssuesByNumber = new Map((dbIssues || []).map((issue) => [issue.number, issue.id]));

    // Update or create issues with fresh data
    const updates = githubIssues.map((issue) => {
      const dbId = dbIssuesByNumber.get(issue.number);

      return {
        id: dbId,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        assignees: issue.assignees as GitHubAssignee[],
        labels: issue.labels,
        comments_count: issue.comments,
        repository_id: repoId,
        last_synced_at: new Date().toISOString(),
      };
    });

    // Batch upsert - insert or update issues
    const { error: upsertError } = await supabase.from('issues').upsert(updates, {
      onConflict: 'repository_id,number',
    });

    if (upsertError) {
      throw new Error(`Failed to upsert issues: ${upsertError.message}`);
    }

    console.log(`Successfully synced ${updates.length} issues for ${owner}/${repo}`);
  } catch (error) {
    console.error(`Error syncing issues for ${owner}/${repo}:`, error);
    throw error;
  }
}

/**
 * Sync multiple repositories in parallel
 */
export async function syncWorkspaceIssuesForRepositories(
  repositories: Array<{
    id: string;
    owner: string;
    name: string;
  }>,
  githubToken: string
): Promise<void> {
  const results = await Promise.allSettled(
    repositories.map((repo) => syncWorkspaceIssues(repo.owner, repo.name, repo.id, githubToken))
  );

  const failures = results.filter((r) => r.status === 'rejected');

  if (failures.length > 0) {
    console.error(`Failed to sync ${failures.length} repositories`);
  }

  const successes = results.filter((r) => r.status === 'fulfilled');
  console.log(`Successfully synced ${successes.length}/${repositories.length} repositories`);
}
