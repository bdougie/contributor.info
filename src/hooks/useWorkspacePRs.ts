import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase-lazy';
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

// Helper functions extracted from the hook to keep it clean and testable

const checkStaleness = async (repoIds: string[], maxStaleMinutes: number) => {
  if (repoIds.length === 0) return { needsSync: false, oldestSync: null };

  const supabase = await getSupabase();
  const { data } = await supabase
    .from('pull_requests')
    .select('last_synced_at, repository_id')
    .in('repository_id', repoIds)
    .order('last_synced_at', { ascending: true });

  const reposWithData = new Set(data?.map((pr) => pr.repository_id) || []);
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
    url: pr.html_url || `https://github.com/${repo?.owner || 'unknown'}/${repo?.name || 'unknown'}/pull/${pr.number}`,
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
  const filteredRepos = useMemo(() =>
    selectedRepositories.length > 0
      ? repositories.filter((r) => selectedRepositories.includes(r.id))
      : repositories,
  [repositories, selectedRepositories]);

  const repoIds = useMemo(() => filteredRepos.map((r) => r.id), [filteredRepos]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['workspace-prs', workspaceId, repoIds],
    queryFn: async () => {
      if (repoIds.length === 0) {
        return { prs: [], lastSynced: null, isStale: false };
      }

      // Check if data is stale
      const { needsSync, oldestSync } = await checkStaleness(repoIds, maxStaleMinutes);

      let currentLastSynced = oldestSync;
      let currentIsStale = needsSync;

      // Auto-sync if needed
      if (needsSync && autoSyncOnMount) {
        try {
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
          currentLastSynced = new Date();
          currentIsStale = false;
        } catch (e) {
          console.error('Sync failed, falling back to DB data', e);
        }
      }

      const dbPRs = await fetchFromDatabase(repoIds);
      const prs = dbPRs.map(transformPR);

      return { prs, lastSynced: currentLastSynced, isStale: currentIsStale };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 30 * 60 * 1000, // 30 minutes garbage collection
    refetchInterval: refreshInterval > 0 ? refreshInterval * 60 * 1000 : false,
    enabled: repositories.length > 0,
  });

  return {
    pullRequests: data?.prs || [],
    loading: isLoading,
    error: error ? (error as Error).message : null,
    lastSynced: data?.lastSynced ? new Date(data.lastSynced) : null,
    isStale: data?.isStale || false,
    refresh: async () => {
      await refetch();
    },
  };
}
