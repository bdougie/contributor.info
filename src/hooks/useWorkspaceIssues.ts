import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { syncWorkspaceIssuesForRepositories } from '@/lib/sync-workspace-issues';
import { executeWithRateLimit, graphqlRateLimiter } from '@/lib/rate-limiter';
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
  isSyncing: boolean;
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

// TTL for linked PRs cache: 1 hour for open issues
const LINKED_PRS_TTL_HOURS = 1;

/**
 * Sync linked PRs for issues in a repository that need updating
 * Only fetches for issues where:
 * - linked_prs_synced_at is null (never synced), OR
 * - linked_prs_synced_at is older than TTL
 * Closed issues are skipped entirely as they won't get new linked PRs
 */
async function syncLinkedPRsForRepository(
  owner: string,
  repo: string,
  githubToken: string,
  repoId: string
): Promise<void> {
  try {
    const staleThreshold = new Date(
      Date.now() - LINKED_PRS_TTL_HOURS * 60 * 60 * 1000
    ).toISOString();

    // Only fetch open issues that need linked PR sync:
    // - linked_prs_synced_at is null (never synced), OR
    // - linked_prs_synced_at is older than threshold
    const { data: issues, error: fetchError } = await supabase
      .from('issues')
      .select('id, number, linked_prs_synced_at')
      .eq('repository_id', repoId)
      .eq('state', 'open')
      .or(`linked_prs_synced_at.is.null,linked_prs_synced_at.lt.${staleThreshold}`)
      .limit(50); // Limit batch size to prevent overwhelming the API

    if (fetchError) {
      console.error(`Failed to fetch issues for %s/%s: %o`, owner, repo, fetchError);
      return;
    }

    if (!issues || issues.length === 0) {
      return;
    }

    console.log(
      `Syncing linked PRs for %d stale/new issues in %s/%s (throttled, max 10 concurrent)`,
      issues.length,
      owner,
      repo
    );

    // Fetch linked PRs for each issue using rate-limited queue
    // This prevents network saturation by limiting to 10 concurrent requests
    const tasks = issues.map((issue) => async () => {
      const linkedPRs = await fetchLinkedPRsForIssue(owner, repo, issue.number, githubToken);

      // Always return update with synced_at timestamp, even if no PRs found
      // This prevents re-fetching issues that genuinely have no linked PRs
      return {
        id: issue.id,
        linked_prs: linkedPRs,
      };
    });

    const rawUpdates = await executeWithRateLimit(tasks, graphqlRateLimiter);

    // Filter out null results from failed requests
    const updates = rawUpdates.filter(
      (update): update is { id: string; linked_prs: Issue['linked_pull_requests'] } =>
        update !== null
    );

    if (updates.length === 0) {
      return;
    }

    // Batch update the database using PostgreSQL function for better performance
    const updatePayload = updates.map((update) => ({
      id: update.id,
      linked_prs: update.linked_prs,
    }));

    const { data: updatedCount, error: batchError } = await supabase.rpc(
      'batch_update_issues_linked_prs',
      { updates: updatePayload }
    );

    if (batchError) {
      console.error(`Batch update failed for %s/%s: %o`, owner, repo, batchError);
      return;
    }

    console.log(
      `Successfully batch updated linked PRs for %d/%d issues in %s/%s`,
      updatedCount,
      updates.length,
      owner,
      repo
    );
  } catch (error) {
    console.error(`Error syncing linked PRs for %s/%s: %o`, owner, repo, error);
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
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce infrastructure for batching state updates
  interface PendingStateUpdate {
    issues?: Issue[];
    loading?: boolean;
    isSyncing?: boolean;
    error?: string | null;
    lastSynced?: Date | null;
    isStale?: boolean;
  }

  const pendingUpdateRef = useRef<PendingStateUpdate>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const DEBOUNCE_MS = 150;

  // Shallow compare for Issue arrays to skip no-op updates
  const issuesAreEqual = useCallback((a: Issue[], b: Issue[]): boolean => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || a[i].updated_at !== b[i].updated_at) {
        return false;
      }
    }
    return true;
  }, []);

  // Flush all pending state updates in a single batch
  const flushPendingUpdates = useCallback(() => {
    const pending = pendingUpdateRef.current;
    pendingUpdateRef.current = {};

    if (Object.keys(pending).length === 0) return;

    // Apply all state updates - React 18 batches these automatically
    if (pending.issues !== undefined) {
      setIssues((current) => {
        if (issuesAreEqual(current, pending.issues as Issue[])) {
          return current;
        }
        return pending.issues as Issue[];
      });
    }
    if (pending.loading !== undefined) setLoading(pending.loading);
    if (pending.isSyncing !== undefined) setIsSyncing(pending.isSyncing);
    if (pending.error !== undefined) setError(pending.error);
    if (pending.lastSynced !== undefined) setLastSynced(pending.lastSynced);
    if (pending.isStale !== undefined) setIsStale(pending.isStale);
  }, [issuesAreEqual]);

  // Queue a state update and schedule debounced flush
  const queueStateUpdate = useCallback(
    (update: PendingStateUpdate) => {
      pendingUpdateRef.current = {
        ...pendingUpdateRef.current,
        ...update,
      };

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        flushPendingUpdates();
      }, DEBOUNCE_MS);
    },
    [flushPendingUpdates]
  );

  // Immediate flush for critical updates (loading, error, sync indicators)
  const flushImmediately = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    flushPendingUpdates();
  }, [flushPendingUpdates]);

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

  // Fetch issues from database with optimized limits
  const fetchFromDatabase = useCallback(async (repoIds: string[]) => {
    // Fetch most recent 500 issues for better performance
    // This is still enough for meaningful analysis while being much faster
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
      .limit(500);

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

  // Get filtered repository IDs
  const getFilteredRepoIds = useCallback(() => {
    const filteredRepos =
      selectedRepositories.length > 0
        ? repositories.filter((r) => selectedRepositories.includes(r.id))
        : repositories;
    return filteredRepos.map((r) => r.id);
  }, [repositories, selectedRepositories]);

  // Get filtered repositories
  const getFilteredRepos = useCallback(() => {
    return selectedRepositories.length > 0
      ? repositories.filter((r) => selectedRepositories.includes(r.id))
      : repositories;
  }, [repositories, selectedRepositories]);

  // Background sync function - runs without blocking UI
  const backgroundSync = useCallback(
    async (repoIds: string[], forceSync = false) => {
      // Abort any in-flight sync
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      try {
        // Check staleness
        const { needsSync, oldestSync } = await checkStaleness(repoIds);
        queueStateUpdate({ lastSynced: oldestSync, isStale: needsSync });

        // Only sync if needed (or forced)
        if (!forceSync && !needsSync) {
          return;
        }

        if (!autoSyncOnMount && !forceSync) {
          return;
        }

        queueStateUpdate({ isSyncing: true });
        flushImmediately();

        // Get GitHub token
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const githubToken = session?.provider_token || env.GITHUB_TOKEN;

        if (!githubToken) {
          console.warn('No GitHub token available for syncing issues');
          return;
        }

        const filteredRepos = getFilteredRepos();

        // Sync issue data from GitHub
        await syncWorkspaceIssuesForRepositories(
          filteredRepos.map((repo) => ({
            id: repo.id,
            owner: repo.owner,
            name: repo.name,
          })),
          githubToken
        );

        // Sync linked PRs for each repository
        for (const repo of filteredRepos) {
          // Check if aborted
          if (abortControllerRef.current?.signal.aborted) {
            return;
          }
          try {
            await syncLinkedPRsForRepository(repo.owner, repo.name, githubToken, repo.id);
          } catch (err) {
            console.error(`Failed to sync linked PRs for %s/%s:`, repo.owner, repo.name, err);
          }
        }

        // Check if aborted before updating state
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        // Re-fetch from database with fresh data
        const dbIssues = await fetchFromDatabase(repoIds);
        const transformedIssues = dbIssues.map(transformIssue);

        queueStateUpdate({
          issues: transformedIssues,
          lastSynced: new Date(),
          isStale: false,
        });
      } catch (err) {
        // Don't log abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Background sync failed:', err);
      } finally {
        queueStateUpdate({ isSyncing: false });
        flushImmediately();
      }
    },
    [
      checkStaleness,
      fetchFromDatabase,
      transformIssue,
      getFilteredRepos,
      autoSyncOnMount,
      queueStateUpdate,
      flushImmediately,
    ]
  );

  // Main fetch function - shows cached data immediately, syncs in background
  const fetchIssues = useCallback(
    async (forceRefresh = false) => {
      if (repositories.length === 0) {
        queueStateUpdate({ issues: [], loading: false });
        flushImmediately();
        return;
      }

      try {
        queueStateUpdate({ loading: true, error: null });
        flushImmediately();

        const repoIds = getFilteredRepoIds();

        // 1. Immediately fetch and display cached data
        const dbIssues = await fetchFromDatabase(repoIds);
        const transformedIssues = dbIssues.map(transformIssue);
        queueStateUpdate({ issues: transformedIssues, loading: false });
        flushImmediately(); // UI unblocks here!

        // 2. Background sync (non-blocking unless forced)
        if (forceRefresh) {
          // Wait for sync to complete on manual refresh
          await backgroundSync(repoIds, true);
        } else {
          // Fire and forget for initial load
          backgroundSync(repoIds, false);
        }
      } catch (err) {
        console.error('Error fetching issues:', err);
        queueStateUpdate({
          error: err instanceof Error ? err.message : 'Failed to fetch issues',
          issues: [],
          loading: false,
        });
        flushImmediately();
      }
    },
    [
      repositories,
      getFilteredRepoIds,
      fetchFromDatabase,
      transformIssue,
      backgroundSync,
      queueStateUpdate,
      flushImmediately,
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

  // Cleanup on unmount - abort any in-flight sync and clear debounce timer
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const refresh = useCallback(() => fetchIssues(true), [fetchIssues]);

  return {
    issues,
    loading,
    isSyncing,
    error,
    lastSynced,
    isStale,
    refresh,
  };
}
