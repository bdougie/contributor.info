import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
// import { syncPullRequestReviewers } from '@/lib/sync-pr-reviewers'; // Temporarily disabled
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
  refreshInterval = 0,
  maxStaleMinutes = 60, // Increased to 60 minutes temporarily while edge function is being fixed
  autoSyncOnMount = false, // Disabled temporarily to avoid edge function errors
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
        console.log(`Found ${missingRepos.length} repos with no PR data, forcing sync`);
        return { needsSync: true, oldestSync: null };
      }

      // Find the oldest sync time across all repos
      const oldestSync = new Date(data[0].last_synced_at);
      const minutesSinceSync = (Date.now() - oldestSync.getTime()) / (1000 * 60);

      console.log(
        `Oldest PR data is ${minutesSinceSync.toFixed(1)} minutes old (threshold: ${maxStaleMinutes} minutes)`
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
        last_synced_at,
        reviewer_data,
        repositories!inner(
          id,
          name,
          owner,
          full_name
        ),
        contributors:author_id(
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
  interface DatabasePR {
    id: string;
    number: number;
    title: string;
    state: string;
    draft?: boolean;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    merged_at?: string;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    commits?: number;
    html_url: string;
    repositories?: {
      name: string;
      owner: string;
    };
    contributors?: {
      username: string;
      avatar_url: string;
    };
    reviewer_data?: {
      requested_reviewers?: Array<{
        username: string;
        avatar_url: string;
      }>;
      reviewers?: Array<{
        username: string;
        avatar_url: string;
        approved?: boolean;
        state?: string;
        submitted_at?: string;
      }>;
    };
    reviews?: Array<{
      contributors?: {
        username: string;
        avatar_url: string;
      };
      state: string;
      submitted_at: string;
    }>;
  }

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

    // Process reviews table data
    interface ReviewRecord {
      contributors?: {
        username: string;
        avatar_url: string;
      };
      state: string;
      submitted_at: string;
    }

    if (pr.reviews && Array.isArray(pr.reviews)) {
      pr.reviews.forEach((review: ReviewRecord) => {
        if (review.contributors) {
          const username = review.contributors.username;
          const isApproved = review.state === 'APPROVED';

          // Update or add reviewer
          reviewerMap.set(username, {
            username,
            avatar_url: review.contributors.avatar_url,
            approved: isApproved,
            state: review.state,
            submitted_at: review.submitted_at,
          });
        }
      });
    }

    reviewers.push(...Array.from(reviewerMap.values()));

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: (() => {
        if (pr.merged_at) return 'merged';
        if (pr.state === 'closed') return 'closed';
        if (pr.draft) return 'draft';
        return 'open';
      })(),
      repository: {
        name: pr.repositories?.name || 'unknown',
        owner: pr.repositories?.owner || 'unknown',
        avatar_url: pr.repositories?.owner
          ? `https://avatars.githubusercontent.com/${pr.repositories.owner}`
          : '',
      },
      author: {
        username: pr.contributors?.username || 'unknown',
        avatar_url: pr.contributors?.avatar_url || '',
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
          console.log(`Sync would run here but is disabled - ${syncReason}`);

          // TEMPORARILY DISABLED: Edge function needs GitHub token configuration
          // Uncomment this block once the edge function is properly configured
          /*
        // Sync each repository
        await Promise.all(
          filteredRepos.map(async (repo) => {
            try {
              await syncPullRequestReviewers(
                repo.owner,
                repo.name,
                workspaceId,
                {
                  includeClosedPRs: true,
                  maxClosedDays: 30,
                  updateDatabase: true,
                }
              );
            } catch (err) {
              console.error(`Failed to sync ${repo.owner}/${repo.name}:`, err);
            }
          })
        );

        setLastSynced(new Date());
        setIsStale(false);
        */

          // Don't update timestamps when sync is disabled
          // This prevents misleading UI state
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
      checkStaleness,
      fetchFromDatabase,
      transformPR,
      autoSyncOnMount,
    ]
  ); // Removed workspaceId and lastSynced to prevent infinite loop

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

  return {
    pullRequests,
    loading,
    error,
    lastSynced,
    isStale,
    refresh: () => fetchPullRequests(true),
  };
}
