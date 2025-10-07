import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { syncPullRequestReviewers } from '@/lib/sync-pr-reviewers';
import type { PullRequest } from '@/components/features/workspace/WorkspacePullRequestsTable';
import type { Repository } from '@/components/features/workspace';

interface UseWorkspacePRsOptions {
  repositories: Repository[];
  selectedRepositories: string[];
  workspaceId: string;
  refreshInterval?: number; // In minutes, 0 to disable
  maxStaleMinutes?: number; // Consider data stale after this many minutes
  autoSyncOnMount?: boolean; // Auto-sync on component mount, defaults to true
}

interface UseWorkspacePRsResult {
  pullRequests: PullRequest[];
  loading: boolean;
  error: string | null;
  lastSynced: Date | null;
  isStale: boolean;
  refresh: () => Promise<void>;
}

// Enum for consistent PR state naming
enum PRState {
  OPEN = 'open',
  CLOSED = 'closed',
  MERGED = 'merged',
  DRAFT = 'draft',
}

// Explicit interface for database PR structure
interface DatabasePR {
  id: string;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  html_url: string;
  commits: number | null;
  additions: number | null;
  deletions: number | null;
  changed_files: number | null;
  repository_id: string;
  contributor_id: string | null;
  last_synced_at: string;
  github_id?: string;
  reviewer_data?: {
    reviewers?: Array<{
      username: string;
      avatar_url: string;
      approved?: boolean;
      state?: string;
      submitted_at?: string;
    }>;
    requested_reviewers?: Array<{
      username: string;
      avatar_url: string;
    }>;
  };
  reviews?: Array<{
    id: string;
    state: string | null;
    submitted_at: string | null;
    pull_request_id: string;
    reviewer_id: string | null;
    contributors?:
      | Array<{
          id: string;
          username: string;
          avatar_url: string;
        }>
      | {
          id: string;
          username: string;
          avatar_url: string;
        };
  }>;
  repositories?:
    | Array<{
        id: string;
        name: string;
        owner: string;
      }>
    | {
        id: string;
        name: string;
        owner: string;
      };
  contributors?:
    | Array<{
        id: string;
        username: string;
        avatar_url: string;
      }>
    | {
        id: string;
        username: string;
        avatar_url: string;
      };
}

/**
 * Custom hook for managing workspace PR data with smart caching
 * - Syncs on mount if data is stale
 * - Returns cached data if fresh
 * - Includes closed PRs for complete reviewer distribution
 */
export function useWorkspacePRs({
  repositories,
  selectedRepositories,
  workspaceId,
  refreshInterval = 60, // Default to hourly refresh
  maxStaleMinutes = 60, // Data considered stale after 60 minutes
  autoSyncOnMount = true, // Auto-sync on mount if data is stale
}: UseWorkspacePRsOptions): UseWorkspacePRsResult {
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Check if data needs refresh - more aggressive staleness check
  const checkStaleness = useCallback(
    async (repoIds: string[]) => {
      if (repoIds.length === 0) return { needsSync: false, oldestSync: null };

      // Check when each repo was last synced
      const { data } = await supabase
        .from('pull_requests')
        .select('last_synced_at, repository_id')
        .in('repository_id', repoIds)
        .order('last_synced_at', { ascending: true });

      // If any repo has no PRs, needs sync
      const reposWithData = new Set(data?.map((pr) => pr.repository_id) || []);
      const missingRepos = repoIds.filter((id) => !reposWithData.has(id));

      if (missingRepos.length > 0 || !data || data.length === 0) {
        console.log('Found %s repos with no PR data, forcing sync', missingRepos.length);
        return { needsSync: true, oldestSync: null };
      }

      // Find the oldest sync time across all repos
      const oldestSync = new Date(data[0].last_synced_at);
      const minutesSinceSync = (Date.now() - oldestSync.getTime()) / (1000 * 60);

      console.log(
        'Oldest PR data is %s minutes old (threshold: %s minutes)',
        minutesSinceSync.toFixed(1),
        maxStaleMinutes
      );

      return {
        needsSync: minutesSinceSync > maxStaleMinutes,
        oldestSync,
      };
    },
    [maxStaleMinutes]
  );

  // Fetch PRs from database
  const fetchFromDatabase = useCallback(async (repoIds: string[]) => {
    const { data, error } = await supabase
      .from('pull_requests')
      .select(
        `
        id,
        github_id,
        number,
        title,
        state,
        draft,
        created_at,
        updated_at,
        closed_at,
        merged_at,
        additions,
        deletions,
        changed_files,
        commits,
        html_url,
        repository_id,
        contributor_id:author_id,
        last_synced_at,
        reviewer_data,
        repositories!inner(
          id,
          name,
          owner,
          full_name
        ),
        contributors:author_id(
          id,
          username,
          avatar_url
        ),
        reviews (
          id,
          state,
          submitted_at,
          pull_request_id,
          reviewer_id,
          contributors:reviewer_id (
            id,
            username,
            avatar_url
          )
        )
      `
      )
      .in('repository_id', repoIds)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch PRs: ${error.message}`);
    }

    return data || [];
  }, []);

  // Transform database PR to component format
  const transformPR = useCallback((pr: DatabasePR): PullRequest => {
    // Build reviewers list from reviewer_data and reviews
    const reviewers: PullRequest['reviewers'] = [];
    const reviewerMap = new Map();

    // Process synced reviewer data
    interface ReviewerData {
      username: string;
      avatar_url: string;
      approved?: boolean;
      state?: string;
      submitted_at?: string;
    }

    if (pr.reviewer_data?.reviewers && Array.isArray(pr.reviewer_data.reviewers)) {
      pr.reviewer_data.reviewers.forEach((reviewer: ReviewerData) => {
        reviewerMap.set(reviewer.username, {
          username: reviewer.username,
          avatar_url: reviewer.avatar_url,
          approved: reviewer.approved || reviewer.state === 'APPROVED',
          state: reviewer.state,
          submitted_at: reviewer.submitted_at,
        });
      });
    }

    // Process reviews table data - handle both single and array contributors
    if (pr.reviews && Array.isArray(pr.reviews)) {
      pr.reviews.forEach((review) => {
        // Handle contributors as array (what Supabase returns)
        const contributor = Array.isArray(review.contributors)
          ? review.contributors[0]
          : review.contributors;

        if (contributor) {
          const username = contributor.username;
          const isApproved = review.state === 'APPROVED';

          // Update or add reviewer
          reviewerMap.set(username, {
            username,
            avatar_url: contributor.avatar_url,
            approved: isApproved,
            state: review.state,
            submitted_at: review.submitted_at,
          });
        }
      });
    }

    reviewers.push(...Array.from(reviewerMap.values()));

    // Handle repositories and contributors as arrays (what Supabase returns with joins)
    const repo = Array.isArray(pr.repositories) ? pr.repositories[0] : pr.repositories;
    const contributor = Array.isArray(pr.contributors) ? pr.contributors[0] : pr.contributors;

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: (() => {
        if (pr.merged_at) return PRState.MERGED;
        if (pr.state === 'closed') return PRState.CLOSED;
        if (pr.draft) return PRState.DRAFT;
        return PRState.OPEN;
      })(),
      repository: {
        name: repo?.name || 'unknown',
        owner: repo?.owner || 'unknown',
        avatar_url: repo?.owner ? `https://avatars.githubusercontent.com/${repo.owner}` : undefined,
      },
      author: {
        username: contributor?.username || 'unknown',
        avatar_url: contributor?.avatar_url || '',
      },
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at || undefined,
      merged_at: pr.merged_at || undefined,
      comments_count: 0,
      commits_count: pr.commits || 0,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changed_files: pr.changed_files || 0,
      labels: [],
      reviewers,
      requested_reviewers: pr.reviewer_data?.requested_reviewers || [],
      url: pr.html_url,
    };
  }, []);

  // Main fetch function
  const fetchPullRequests = useCallback(
    async (forceRefresh = false, skipSync = false) => {
      if (repositories.length === 0) {
        setPullRequests([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Filter repositories
        const filteredRepos =
          selectedRepositories.length > 0
            ? repositories.filter((r) => selectedRepositories.includes(r.id))
            : repositories;

        const repoIds = filteredRepos.map((r) => r.id);

        // Check if we need to sync
        const { needsSync, oldestSync } = await checkStaleness(repoIds);
        setLastSynced(oldestSync);
        setIsStale(needsSync);

        // Auto-sync on mount or when data is stale
        // Only sync if explicitly forced or data is truly stale
        const shouldSync = !skipSync && (forceRefresh || (needsSync && autoSyncOnMount));

        if (shouldSync) {
          let syncReason = 'First load';
          if (forceRefresh) {
            syncReason = 'Refresh forced';
          } else if (needsSync) {
            syncReason = 'Data is stale';
          }
          console.log('Syncing PR data - %s', syncReason);

          // Sync each repository
          await Promise.all(
            filteredRepos.map(async (repo) => {
              try {
                await syncPullRequestReviewers(repo.owner, repo.name, workspaceId, {
                  includeClosedPRs: true,
                  maxClosedDays: 30,
                  updateDatabase: true,
                });
              } catch (err) {
                console.error('Failed to sync %s/%s:', err, repo.owner, repo.name);
              }
            })
          );

          setLastSynced(new Date());
          setIsStale(false);
        }

        // Fetch from database (now with updated data if synced)
        const dbPRs = await fetchFromDatabase(repoIds);
        const transformedPRs = dbPRs.map(transformPR);

        setPullRequests(transformedPRs);
      } catch (err) {
        console.error('Error fetching PRs:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch pull requests');
        setPullRequests([]);
      } finally {
        setLoading(false);
      }
    },
    [
      repositories,
      selectedRepositories,
      workspaceId,
      checkStaleness,
      fetchFromDatabase,
      transformPR,
      autoSyncOnMount,
    ]
  );

  // Initial fetch - only run when key dependencies change
  useEffect(() => {
    // Only fetch if we have repositories
    if (repositories.length > 0) {
      fetchPullRequests();
    }
  }, [repositories.length, selectedRepositories.length, workspaceId, fetchPullRequests]);

  // Set up refresh interval if specified
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(
        () => {
          fetchPullRequests(true);
        },
        refreshInterval * 60 * 1000
      );

      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchPullRequests]);

  // Memoize the refresh function to prevent unnecessary re-renders
  const refresh = useCallback(() => fetchPullRequests(true), [fetchPullRequests]);

  return {
    pullRequests,
    loading,
    error,
    lastSynced,
    isStale,
    refresh,
  };
}
