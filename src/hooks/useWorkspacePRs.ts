import { useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase-lazy';
import { syncPullRequestReviewersWithStatus } from '@/lib/sync-pr-reviewers';
import type { PullRequest } from '@/components/features/workspace/WorkspacePullRequestsTable';
import { summarizeFreshness } from '@/lib/workspace/sync-freshness';
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
  isSyncing: boolean;
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

// Helper functions extracted from the hook to keep it clean and testable

const checkStaleness = async (repoIds: string[], maxStaleMinutes: number) => {
  if (repoIds.length === 0) return { needsSync: false, oldestSync: null };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('pull_requests')
    .select('last_synced_at, repository_id')
    .in('repository_id', repoIds)
    .order('last_synced_at', { ascending: true });

  if (error) throw new Error(`Failed to check PR freshness: ${error.message}`);

  return summarizeFreshness(repoIds, data || [], maxStaleMinutes);
};

const fetchFromDatabase = async (repoIds: string[]) => {
  const supabase = await getSupabase();
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

  return (data || []) as unknown as DatabasePR[];
};

const transformPR = (pr: DatabasePR): PullRequest => {
  const reviewers: PullRequest['reviewers'] = [];
  const reviewerMap = new Map();

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

  if (pr.reviews && Array.isArray(pr.reviews)) {
    pr.reviews.forEach((review) => {
      const contributor = Array.isArray(review.contributors)
        ? review.contributors[0]
        : review.contributors;

      if (contributor) {
        const username = contributor.username;
        const isApproved = review.state === 'APPROVED';

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
    url:
      pr.html_url ||
      `https://github.com/${repo?.owner || 'unknown'}/${repo?.name || 'unknown'}/pull/${pr.number}`,
  };
};

/**
 * Custom hook for managing workspace PR data with smart caching using React Query
 */
export function useWorkspacePRs({
  repositories,
  selectedRepositories,
  workspaceId,
  refreshInterval = 60,
  maxStaleMinutes = 60,
  autoSyncOnMount = true,
}: UseWorkspacePRsOptions): UseWorkspacePRsResult {
  const filteredRepos = useMemo(
    () =>
      selectedRepositories.length > 0
        ? repositories.filter((r) => selectedRepositories.includes(r.id))
        : repositories,
    [repositories, selectedRepositories]
  );

  const repoIds = useMemo(() => filteredRepos.map((r) => r.id), [filteredRepos]);

  const queryClient = useQueryClient();
  const forceSync = useRef(false);
  const queryKey = ['workspace-prs', workspaceId, repoIds];
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const manualSync = forceSync.current;
      forceSync.current = false;
      if (repoIds.length === 0) {
        return { prs: [], lastSynced: null, isStale: false, syncError: null };
      }

      const dbPRs = await fetchFromDatabase(repoIds);
      const cached = {
        prs: dbPRs.map(transformPR),
        lastSynced: null as Date | null,
        isStale: true,
        syncError: null as string | null,
      };

      let needsSync: boolean;
      try {
        const freshness = await checkStaleness(repoIds, maxStaleMinutes);
        cached.lastSynced = freshness.oldestSync;
        cached.isStale = freshness.needsSync;
        needsSync = freshness.needsSync;
      } catch (e) {
        // Saved PRs are still worth showing when only the freshness lookup failed.
        console.error('PR freshness check failed, showing saved data', e);
        if (!manualSync) {
          return { ...cached, syncError: 'Could not check PR freshness. Showing saved PRs.' };
        }
        needsSync = true;
      }

      // Publish the cache before waiting on slower GitHub requests.
      queryClient.setQueryData(queryKey, cached);

      if (manualSync || (needsSync && autoSyncOnMount)) {
        try {
          const results = await Promise.allSettled(
            filteredRepos.map((repo) =>
              syncPullRequestReviewersWithStatus(repo.owner, repo.name, workspaceId, {
                includeClosedPRs: true,
                maxClosedDays: 30,
                updateDatabase: true,
              })
            )
          );
          const refreshedPRs = await fetchFromDatabase(repoIds);
          const failed = results.some((result) => result.status === 'rejected');
          const persisted = results.every(
            (result) => result.status === 'fulfilled' && result.value.persisted
          );
          if (persisted) {
            // Every repository was stored just now, including any with no PRs to keep.
            return {
              prs: refreshedPRs.map(transformPR),
              lastSynced: new Date(),
              isStale: false,
              syncError: null,
            };
          }
          // A fallback fetch returned PRs without storing them; the snapshot is only as
          // fresh as the rows on disk.
          const freshness = await checkStaleness(repoIds, maxStaleMinutes).catch(() => ({
            needsSync: true,
            oldestSync: cached.lastSynced,
          }));
          return {
            prs: refreshedPRs.map(transformPR),
            lastSynced: freshness.oldestSync,
            isStale: failed || freshness.needsSync,
            syncError: failed
              ? 'Some repositories could not be refreshed. Showing saved PRs.'
              : null,
          };
        } catch (e) {
          console.error('Sync failed, falling back to DB data', e);
          return { ...cached, isStale: true, syncError: 'Refresh failed. Showing saved PRs.' };
        }
      }

      return cached;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
    refetchInterval: refreshInterval > 0 ? refreshInterval * 60 * 1000 : false,
    enabled: repositories.length > 0,
  });

  const refresh = useCallback(async () => {
    forceSync.current = true;
    await refetch();
  }, [refetch]);

  return {
    pullRequests: data?.prs || [],
    loading: isLoading,
    isSyncing: isFetching && !isLoading,
    error: error ? error.message : data?.syncError || null,
    lastSynced: data?.lastSynced ? new Date(data.lastSynced) : null,
    isStale: data?.isStale || false,
    refresh,
  };
}
