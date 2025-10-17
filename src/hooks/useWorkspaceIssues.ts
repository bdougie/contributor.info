import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { syncWorkspaceIssuesForRepositories } from '@/lib/sync-workspace-issues';
import type { Issue } from '@/components/features/workspace/WorkspaceIssuesTable';
import type { Repository } from '@/components/features/workspace';

interface UseWorkspaceIssuesOptions {
  repositories: Repository[];
  selectedRepositories: string[];
  workspaceId: string;
  refreshInterval?: number; // In minutes, 0 to disable
  maxStaleMinutes?: number; // Consider data stale after this many minutes
  autoSyncOnMount?: boolean; // Auto-sync on component mount, defaults to true
}

interface UseWorkspaceIssuesResult {
  issues: Issue[];
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  isStale: boolean;
  refresh: () => Promise<void>;
}

interface DBLabel {
  name: string;
  color: string;
}

interface DBAssignee {
  login: string;
  username?: string;
  avatar_url: string;
}

interface DBRepository {
  id: string;
  name: string;
  owner: string;
  full_name: string;
  avatar_url: string;
}

interface DBContributor {
  username: string;
  avatar_url: string;
}

interface DBIssue {
  id: string;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: DBLabel[];
  assignees: DBAssignee[];
  comments_count: number;
  repository_id: string;
  responded_by: string | null;
  responded_at: string | null;
  linked_prs: Issue['linked_pull_requests'];
  repositories: DBRepository | DBRepository[];
  contributors: DBContributor | DBContributor[];
}

// GraphQL query to fetch linked PRs for an issue using timeline events
const TIMELINE_QUERY = `
  query($owner: String!, $repo: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $issueNumber) {
        timelineItems(first: 100, itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT]) {
          nodes {
            ... on CrossReferencedEvent {
              source {
                ... on PullRequest {
                  number
                  url
                  state
                  merged
                }
              }
            }
            ... on ConnectedEvent {
              subject {
                ... on PullRequest {
                  number
                  url
                  state
                  merged
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface GraphQLLinkedPR {
  number: number;
  url: string;
  state: string;
  merged: boolean;
}

/**
 * Fetch linked PRs for an issue using GitHub's GraphQL API
 */
async function fetchLinkedPRsForIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  githubToken: string
): Promise<Issue['linked_pull_requests']> {
  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${githubToken}`,
      },
      body: JSON.stringify({
        query: TIMELINE_QUERY,
        variables: {
          owner,
          repo,
          issueNumber,
        },
      }),
    });

    if (!response.ok) {
      console.error(`Failed to fetch linked PRs for issue #${issueNumber}: ${response.statusText}`);
      return undefined;
    }

    const result = await response.json();

    if (result.errors) {
      console.error(`GraphQL errors for issue #${issueNumber}:`, result.errors);
      return undefined;
    }

    const timelineItems = result.data?.repository?.issue?.timelineItems?.nodes || [];
    const linkedPRs: GraphQLLinkedPR[] = [];
    const seenPRs = new Set<number>();

    // Extract PRs from timeline events
    for (const item of timelineItems) {
      let pr: GraphQLLinkedPR | null = null;

      // Handle CrossReferencedEvent
      if (item.source?.__typename === 'PullRequest') {
        pr = item.source;
      }
      // Handle ConnectedEvent
      else if (item.subject?.__typename === 'PullRequest') {
        pr = item.subject;
      }

      // Add to list if we haven't seen it before
      if (pr && !seenPRs.has(pr.number)) {
        seenPRs.add(pr.number);
        linkedPRs.push(pr);
      }
    }

    if (linkedPRs.length === 0) {
      return undefined;
    }

    // Transform to expected format
    return linkedPRs.map((pr) => ({
      number: pr.number,
      url: pr.url,
      state: pr.merged ? 'merged' : (pr.state.toLowerCase() as 'open' | 'closed' | 'merged'),
    }));
  } catch (error) {
    console.error(`Error fetching linked PRs for issue #${issueNumber}:`, error);
    return undefined;
  }
}

/**
 * Sync linked PRs for all issues in a repository
 */
async function syncLinkedPRsForRepository(
  owner: string,
  repo: string,
  githubToken: string,
  repoId: string
): Promise<void> {
  try {
    // Fetch all issues for this repository from our database
    const { data: issues, error: fetchError } = await supabase
      .from('issues')
      .select('id, number')
      .eq('repository_id', repoId)
      .eq('state', 'open'); // Only sync open issues to reduce API calls

    if (fetchError) {
      console.error(`Failed to fetch issues for ${owner}/${repo}:`, fetchError);
      return;
    }

    if (!issues || issues.length === 0) {
      return;
    }

    console.log(`Syncing linked PRs for ${issues.length} issues in ${owner}/${repo}`);

    // Fetch linked PRs for each issue
    const updates = await Promise.all(
      issues.map(async (issue) => {
        const linkedPRs = await fetchLinkedPRsForIssue(owner, repo, issue.number, githubToken);

        // Only update if we got data
        if (linkedPRs) {
          return {
            id: issue.id,
            linked_prs: linkedPRs,
          };
        }
        return null;
      })
    );

    // Filter out null results and update database
    const validUpdates = updates.filter((u) => u !== null);

    if (validUpdates.length === 0) {
      return;
    }

    // Batch update the database
    for (const update of validUpdates) {
      if (update) {
        await supabase
          .from('issues')
          .update({
            linked_prs: update.linked_prs,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', update.id);
      }
    }

    console.log(
      `Successfully synced linked PRs for ${validUpdates.length} issues in ${owner}/${repo}`
    );
  } catch (error) {
    console.error(`Error syncing linked PRs for ${owner}/${repo}:`, error);
  }
}

/**
 * Custom hook for managing workspace issue data with smart caching
 * Similar pattern to useWorkspacePRs
 */
export function useWorkspaceIssues({
  repositories,
  selectedRepositories,
  workspaceId,
  refreshInterval = 60,
  maxStaleMinutes = 60,
  autoSyncOnMount = true,
}: UseWorkspaceIssuesOptions): UseWorkspaceIssuesResult {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Check if data needs refresh
  const checkStaleness = useCallback(
    async (repoIds: string[]) => {
      if (repoIds.length === 0) return { needsSync: false, oldestSync: null };

      const { data } = await supabase
        .from('issues')
        .select('last_synced_at, repository_id')
        .in('repository_id', repoIds)
        .order('last_synced_at', { ascending: true });

      const reposWithData = new Set(data?.map((issue) => issue.repository_id) || []);
      const missingRepos = repoIds.filter((id) => !reposWithData.has(id));

      if (missingRepos.length > 0 || !data || data.length === 0) {
        return { needsSync: true, oldestSync: null };
      }

      const oldestSync = new Date(data[0].last_synced_at);
      const minutesSinceSync = (Date.now() - oldestSync.getTime()) / (1000 * 60);

      return {
        needsSync: minutesSinceSync > maxStaleMinutes,
        oldestSync,
      };
    },
    [maxStaleMinutes]
  );

  // Fetch issues from database
  const fetchFromDatabase = useCallback(async (repoIds: string[]) => {
    const { data, error } = await supabase
      .from('issues')
      .select(
        `
        id,
        github_id,
        number,
        title,
        body,
        state,
        created_at,
        updated_at,
        closed_at,
        labels,
        assignees,
        comments_count,
        repository_id,
        responded_by,
        responded_at,
        linked_prs,
        last_synced_at,
        repositories(
          id,
          name,
          owner,
          full_name,
          avatar_url
        ),
        contributors:author_id(
          username,
          avatar_url
        )
      `
      )
      .in('repository_id', repoIds)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) {
      throw new Error(`Failed to fetch issues: ${error.message}`);
    }

    return data || [];
  }, []);

  // Transform database issue to component format
  const transformIssue = useCallback((dbIssue: DBIssue): Issue => {
    const repo = Array.isArray(dbIssue.repositories)
      ? dbIssue.repositories[0]
      : dbIssue.repositories;
    const contributor = Array.isArray(dbIssue.contributors)
      ? dbIssue.contributors[0]
      : dbIssue.contributors;

    return {
      id: dbIssue.id,
      number: dbIssue.number,
      title: dbIssue.title,
      state: dbIssue.state,
      repository: {
        name: repo?.name || 'unknown',
        owner: repo?.owner || 'unknown',
        avatar_url:
          repo?.avatar_url || `https://avatars.githubusercontent.com/${repo?.owner || 'unknown'}`,
      },
      author: {
        username: contributor?.username || 'unknown',
        avatar_url: contributor?.avatar_url || '',
      },
      created_at: dbIssue.created_at,
      updated_at: dbIssue.updated_at,
      closed_at: dbIssue.closed_at || undefined,
      comments_count: dbIssue.comments_count || 0,
      labels: Array.isArray(dbIssue.labels)
        ? dbIssue.labels
            .map((label: DBLabel) => ({
              name: label.name,
              color: label.color || '000000',
            }))
            .filter((l) => l.name)
        : [],
      assignees: Array.isArray(dbIssue.assignees)
        ? dbIssue.assignees.map((assignee: DBAssignee) => ({
            login: assignee.login || assignee.username || 'unknown',
            avatar_url: assignee.avatar_url || '',
          }))
        : [],
      linked_pull_requests: dbIssue.linked_prs || undefined,
      url:
        repo?.full_name && dbIssue.number
          ? `https://github.com/${repo.full_name}/issues/${dbIssue.number}`
          : '',
      responded_by: dbIssue.responded_by,
      responded_at: dbIssue.responded_at,
    };
  }, []);

  // Main fetch function
  const fetchIssues = useCallback(
    async (forceRefresh = false, skipSync = false) => {
      if (repositories.length === 0) {
        setIssues([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const filteredRepos =
          selectedRepositories.length > 0
            ? repositories.filter((r) => selectedRepositories.includes(r.id))
            : repositories;

        const repoIds = filteredRepos.map((r) => r.id);

        const { needsSync, oldestSync } = await checkStaleness(repoIds);
        setLastSynced(oldestSync);
        setIsStale(needsSync);

        const shouldSync = !skipSync && (forceRefresh || (needsSync && autoSyncOnMount));

        if (shouldSync) {
          // Get GitHub token
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const githubToken = session?.provider_token || env.GITHUB_TOKEN;

          if (!githubToken) {
            console.warn('No GitHub token available for syncing issues');
          } else {
            try {
              // Sync issue data (assignees, labels, etc.) from GitHub
              await syncWorkspaceIssuesForRepositories(
                filteredRepos.map((repo) => ({
                  id: repo.id,
                  owner: repo.owner,
                  name: repo.name,
                })),
                githubToken
              );

              // Also sync linked PRs for each repository
              await Promise.all(
                filteredRepos.map(async (repo) => {
                  try {
                    await syncLinkedPRsForRepository(repo.owner, repo.name, githubToken, repo.id);
                  } catch (err) {
                    console.error(`Failed to sync linked PRs for ${repo.owner}/${repo.name}:`, err);
                  }
                })
              );

              setLastSynced(new Date());
              setIsStale(false);
            } catch (err) {
              console.error('Error during sync:', err);
              // Don't throw - let the hook continue with cached data
            }
          }
        }

        // Fetch from database (now with updated data if synced)
        const dbIssues = await fetchFromDatabase(repoIds);
        const transformedIssues = dbIssues.map(transformIssue);

        setIssues(transformedIssues);
      } catch (err) {
        console.error('Error fetching issues:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch issues');
        setIssues([]);
      } finally {
        setLoading(false);
      }
    },
    [
      repositories,
      selectedRepositories,
      checkStaleness,
      fetchFromDatabase,
      transformIssue,
      autoSyncOnMount,
    ]
  );

  // Initial fetch
  useEffect(() => {
    if (repositories.length > 0) {
      fetchIssues();
    }
  }, [repositories.length, selectedRepositories.length, workspaceId, fetchIssues]);

  // Set up refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(
        () => {
          fetchIssues(true);
        },
        refreshInterval * 60 * 1000
      );

      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchIssues]);

  const refresh = useCallback(() => fetchIssues(true), [fetchIssues]);

  return {
    issues,
    loading,
    error,
    lastSynced,
    isStale,
    refresh,
  };
}
