import { useParams, useNavigate, useLocation } from 'react-router';
import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import type { User } from '@supabase/supabase-js';
import { getFallbackAvatar } from '@/lib/utils/avatar';
import { logger } from '@/lib/logger';
import { getAppUserId } from '@/lib/auth-helpers';
import { resolveWorkspaceOwnership } from '@/lib/workspace-ownership';
import { useWorkspaceEvents } from '@/hooks/use-workspace-events';
import { TIME_RANGE_DAYS, getStartDateForTimeRange } from '@/lib/utils/time-range';
import {
  calculateWorkspaceMetrics,
  calculateTrendData,
  generateActivityData,
  type MergedPR,
} from '@/services/workspace-metrics.service';
import { WorkspaceDashboard, WorkspaceDashboardSkeleton } from '@/components/features/workspace';
import type { CurrentItem } from '@/components/features/workspace/ResponsePreviewModal';
import type { SimilarItem } from '@/services/similarity-search';
import { WorkspaceErrorBoundary } from '@/components/error-boundaries/workspace-error-boundary';
import { parseWorkspaceIdentifier, getWorkspaceQueryField } from '@/types/workspace-identifier';
import {
  useSimilaritySearchCache,
  useDebouncedSimilaritySearch,
} from '@/hooks/use-similarity-search-cache';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import type { Discussion } from '@/components/features/workspace/WorkspaceDiscussionsTable';
import { type Issue } from '@/components/features/workspace/WorkspaceIssuesTable';
import { AddRepositoryModal } from '@/components/features/workspace/AddRepositoryModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useWorkspaceGitHubAppStatus } from '@/hooks/use-workspace-github-app-status';
import { toast } from 'sonner';
import { type TimeRange } from '@/components/features/workspace/TimeRangeSelector';
import type {
  WorkspaceMetrics,
  WorkspaceTrendData,
  Repository,
  ActivityDataPoint,
} from '@/components/features/workspace';
import type { Workspace, WorkspaceMemberWithUser } from '@/types/workspace';
import { WorkspaceService } from '@/services/workspace.service';
import { useMyWork } from '@/hooks/use-my-work';
import type { MyWorkItem } from '@/components/features/workspace/MyWorkCard';
import type { WorkspaceActivityTabProps as WorkspaceActivityProps } from '@/components/features/workspace/WorkspaceActivityTab';
import { fetchGitHubUserProfile } from '@/services/github-profile';
import { abbreviateBios } from '@/lib/llm/abbreviate-bios';
import { useIsSlowConnection } from '@/hooks/useOnlineStatus';
import { useWorkspaceDetailSSRData } from '@/hooks/use-ssr-data';
// Analytics imports disabled - will be implemented in issue #598
// import { AnalyticsDashboard } from '@/components/features/workspace/AnalyticsDashboard';

// Lazy load tab components for better TTI - only "overview" tab loads immediately
// Other tabs load on-demand when user navigates to them
const WorkspaceContributorsTab = lazy(() =>
  import('@/components/features/workspace/WorkspaceContributorsTab').then((m) => ({
    default: m.WorkspaceContributorsTab,
  }))
);
const WorkspacePRsTab = lazy(() =>
  import('@/components/features/workspace/WorkspacePRsTab').then((m) => ({
    default: m.WorkspacePRsTab,
  }))
);
const WorkspaceIssuesTab = lazy(() =>
  import('@/components/features/workspace/WorkspaceIssuesTab').then((m) => ({
    default: m.WorkspaceIssuesTab,
  }))
);
const WorkspaceSpamTab = lazy(() =>
  import('@/components/features/workspace/WorkspaceSpamTab').then((m) => ({
    default: m.WorkspaceSpamTab,
  }))
);
const WorkspaceActivityTab = lazy(() =>
  import('@/components/features/workspace/WorkspaceActivityTab').then((m) => ({
    default: m.WorkspaceActivityTab,
  }))
);
const WorkspaceDiscussionsTable = lazy(() =>
  import('@/components/features/workspace/WorkspaceDiscussionsTable').then((m) => ({
    default: m.WorkspaceDiscussionsTable,
  }))
);
const WorkspaceSettingsComponent = lazy(() =>
  import('@/components/features/workspace/settings/WorkspaceSettings').then((m) => ({
    default: m.WorkspaceSettings,
  }))
);
// import { WorkspaceExportService } from '@/services/workspace-export.service';
// import type {
//   AnalyticsData,
//   ActivityItem,
//   ContributorStat,
//   RepositoryMetric,
//   TrendDataset,
// } from '@/components/features/workspace/AnalyticsDashboard';

// Extracted workspace page components
import {
  WorkspaceHeader,
  WorkspaceTabNavigation,
  WorkspaceModals,
  UpgradePrompt,
} from '@/components/features/workspace-page/components';

// Tab loading skeleton for lazy-loaded tabs
const TabSkeleton = () => (
  <div className="container max-w-7xl mx-auto space-y-4">
    <div className="h-8 w-48 bg-muted animate-pulse rounded" />
    <div className="border rounded-lg p-6 space-y-4">
      <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
      <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </div>
    </div>
  </div>
);

// ActivityItem type definition used in this page for hover cards and analytics
interface ActivityItem {
  id: string;
  type: 'pr' | 'issue' | 'commit' | 'review' | 'comment' | 'star' | 'fork';
  title: string;
  author: {
    username: string;
    avatar_url: string;
  };
  repository: string;
  created_at: string;
  // Status is only relevant for PRs, issues, and reviews
  status?: 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';
  url: string;
  metadata?: {
    additions?: number;
    deletions?: number;
    change_amount?: number;
    current_value?: number;
  };
}

interface WorkspaceRepository {
  id: string;
  is_pinned: boolean;
  repositories: {
    id: string;
    full_name: string;
    name: string;
    owner: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    avatar_url: string | null;
  };
}

// Type definitions moved to workspace-metrics.service.ts

// WorkspaceActivity component and props moved to WorkspaceActivityTab.tsx

function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { syncWithUrl } = useWorkspaceContext();
  const isSlowConnection = useIsSlowConnection();
  const ssrData = useWorkspaceDetailSSRData();
  const ssrDataRef = useRef(ssrData);
  const ssrConsumedRef = useRef(false);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const skipNextFetchRef = useRef(false);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(true);

  // My Work filter and pagination state
  const [myWorkPage, setMyWorkPage] = useState(1);
  const [myWorkItemsPerPage] = useState(10);
  const [myWorkSelectedTypes, setMyWorkSelectedTypes] = useState<
    Array<'pr' | 'issue' | 'discussion'>
  >(['pr', 'issue', 'discussion']);
  const [myWorkActiveTab, setMyWorkActiveTab] = useState<
    'needs_response' | 'follow_ups' | 'replies'
  >('needs_response');

  // Memoize filter object to prevent unnecessary re-renders
  const myWorkFilters = useMemo(
    () => ({
      selectedTypes: myWorkSelectedTypes,
      activeTab: myWorkActiveTab,
    }),
    [myWorkSelectedTypes, myWorkActiveTab]
  );

  // Fetch live My Work data
  // Use workspace?.id (UUID) instead of workspaceId (which is a slug)
  const {
    items: myWorkItems,
    totalCount: myWorkTotalCount,
    tabCounts: myWorkTabCounts,
    loading: myWorkLoading,
    refresh: refreshMyWork,
    optimisticallyRemoveItem,
    restoreItem,
    syncComments,
    isSyncingComments,
    commentSyncStatus,
  } = useMyWork(workspace?.id, myWorkPage, myWorkItemsPerPage, myWorkFilters);
  const [fullPRData, setFullPRData] = useState<WorkspaceActivityProps['prData']>([]);
  const [fullIssueData, setFullIssueData] = useState<WorkspaceActivityProps['issueData']>([]);
  const [fullReviewData, setFullReviewData] = useState<WorkspaceActivityProps['reviewData']>([]);
  const [fullCommentData, setFullCommentData] = useState<WorkspaceActivityProps['commentData']>([]);
  const [fullStarData, setFullStarData] = useState<WorkspaceActivityProps['starData']>([]);
  const [fullForkData, setFullForkData] = useState<WorkspaceActivityProps['forkData']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([]);
  const [addRepositoryModalOpen, setAddRepositoryModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMember, setCurrentMember] = useState<WorkspaceMemberWithUser | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [reviewerModalOpen, setReviewerModalOpen] = useState(false);
  const [githubAppModalOpen, setGithubAppModalOpen] = useState(false);
  const [selectedRepoForModal, setSelectedRepoForModal] = useState<Repository | null>(null);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
  const [responseMessage, setResponseMessage] = useState('');
  const [loadingSimilarItems, setLoadingSimilarItems] = useState(false);
  const [currentRespondItem, setCurrentRespondItem] = useState<CurrentItem | null>(null);

  // Initialize similarity search cache and debouncing
  const similarityCache = useSimilaritySearchCache({ maxSize: 20, ttlMs: 5 * 60 * 1000 });
  const { debouncedSearch, cleanup: cleanupDebounce } = useDebouncedSimilaritySearch(300);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => cleanupDebounce();
  }, [cleanupDebounce]);

  // Fetch event-based metrics for accurate star trends
  // Use workspace?.id (UUID) instead of workspaceId (which could be a slug)
  const { metrics: eventMetrics } = useWorkspaceEvents({
    workspaceId: workspace?.id,
    timeRange,
    enabled: !!workspace?.id,
  });

  // Check GitHub App installation status across all workspace repos
  const repositoryIds = useMemo(
    () => repositories.map((r) => r.id).filter(Boolean),
    [repositories]
  );

  // Memoize repository lookup map
  const repositoryMap = useMemo(() => {
    const map = new Map<string, Repository>();
    repositories.forEach((repo) => {
      if (repo?.id) {
        map.set(repo.id, repo);
      }
    });
    return map;
  }, [repositories]);

  // Build activities from workspace data for hover cards
  const activities: ActivityItem[] = useMemo(() => {
    const getRepoName = (repoId: string | undefined): string => {
      if (!repoId) return 'Unknown Repository';
      const repo = repositoryMap.get(repoId);
      return repo?.full_name || 'Unknown Repository';
    };

    const allActivities: ActivityItem[] = [];

    // Convert PRs to activities
    fullPRData.forEach((pr, index) => {
      allActivities.push({
        id: `pr-${pr.id}-${index}`,
        type: 'pr',
        title: pr.title || `PR #${pr.number}`,
        created_at: pr.created_at,
        author: {
          username: pr.author_login || 'Unknown',
          avatar_url: pr.author_login
            ? `https://avatars.githubusercontent.com/${pr.author_login}`
            : '',
        },
        repository: getRepoName(pr.repository_id),
        status: (() => {
          if (pr.merged_at) return 'merged';
          if (pr.state === 'open') return 'open';
          return 'closed';
        })(),
        url: pr.html_url || '#',
        metadata: {
          additions: pr.additions || 0,
          deletions: pr.deletions || 0,
        },
      });
    });

    // Convert issues to activities
    fullIssueData.forEach((issue, index) => {
      allActivities.push({
        id: `issue-${issue.id}-${index}`,
        type: 'issue',
        title: issue.title || `Issue #${issue.number}`,
        created_at: issue.created_at,
        author: {
          username: issue.author_login || 'Unknown',
          avatar_url: issue.author_login
            ? `https://avatars.githubusercontent.com/${issue.author_login}`
            : '',
        },
        repository: getRepoName(issue.repository_id),
        status: issue.closed_at ? 'closed' : 'open',
        url: issue.html_url || '#',
        metadata: {},
      });
    });

    // Convert reviews to activities
    fullReviewData.forEach((review, index) => {
      allActivities.push({
        id: `review-${review.id}-${index}`,
        type: 'review',
        title: review.pr_title ? `Review on: ${review.pr_title}` : 'Review on PR',
        created_at: review.submitted_at,
        author: {
          username: review.reviewer_login || 'Unknown',
          avatar_url: review.reviewer_login
            ? `https://avatars.githubusercontent.com/${review.reviewer_login}`
            : '',
        },
        repository: review.repository_name || 'Unknown Repository',
        status: review.state.toLowerCase() as ActivityItem['status'],
        url: '#',
        metadata: {},
      });
    });

    // Convert comments to activities
    fullCommentData.forEach((comment, index) => {
      allActivities.push({
        id: `comment-${comment.id}-${index}`,
        type: 'comment',
        title: comment.pr_title ? `Comment on: ${comment.pr_title}` : 'Comment on PR',
        created_at: comment.created_at,
        author: {
          username: comment.commenter_login || 'Unknown',
          avatar_url: comment.commenter_login
            ? `https://avatars.githubusercontent.com/${comment.commenter_login}`
            : '',
        },
        repository: comment.repository_name || 'Unknown Repository',
        status: undefined,
        url: '#',
        metadata: {},
      });
    });

    return allActivities;
  }, [fullPRData, fullIssueData, fullReviewData, fullCommentData, repositoryMap]);

  const appStatus = useWorkspaceGitHubAppStatus(repositoryIds);

  // Determine active tab from URL
  const pathSegments = location.pathname.split('/');
  const activeTab = pathSegments[3] || 'overview';

  // Development environment check - log helpful message about Netlify dev server
  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.info(
        '🚀 Workspace Page - Development Mode',
        '\n\n' +
          '📋 API endpoints require Netlify Dev server to be running.\n' +
          '   Run: npm start\n\n' +
          '   This starts:\n' +
          '   • Vite dev server (port 5174)\n' +
          '   • Netlify Functions (port 8888)\n' +
          '   • Inngest dev server\n\n' +
          '❌ If you see 500 errors, make sure all services are running.\n'
      );
    }
  }, []);

  // Query limit based on connection speed
  const queryLimit = isSlowConnection ? 100 : 500;

  // Phase A: Fetch workspace metadata + repositories (renders skeleton -> real layout)
  const fetchWorkspaceCore = useCallback(async () => {
    if (!workspaceId) {
      setError('No workspace ID provided');
      setLoading(false);
      return null;
    }

    try {
      const supabase = await getSupabase();
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);

      // Parse workspace identifier with type safety
      const identifier = parseWorkspaceIdentifier(workspaceId);
      const { field, value } = getWorkspaceQueryField(identifier);

      // Fetch workspace details using the appropriate field
      const { data: workspaceData, error: wsError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('is_active', true)
        .eq(field, value)
        .maybeSingle();

      if (wsError) {
        logger.error('Error fetching workspace:', wsError);
        setError(`Failed to load workspace: ${wsError.message}`);
        setLoading(false);
        return null;
      }

      if (!workspaceData) {
        setError('Workspace not found');
        setLoading(false);
        return null;
      }

      // Get app_users.id for workspace ownership and membership checks
      const resolvedAppUserId = await getAppUserId();
      setAppUserId(resolvedAppUserId);

      // Check if current user is the workspace owner
      const ownership = resolveWorkspaceOwnership(
        workspaceData.owner_id,
        resolvedAppUserId,
        user?.id ?? null
      );
      setIsWorkspaceOwner(ownership.isOwner);

      if (ownership.matchType === 'auth_fallback') {
        logger.warn(
          '[Workspace] owner_id matches auth.users.id instead of app_users.id — data needs migration',
          { workspaceId: workspaceData.id }
        );
      }

      // Fetch current member info and member count
      if (resolvedAppUserId) {
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .eq('user_id', resolvedAppUserId)
          .maybeSingle();

        if (memberData && user) {
          // Fetch user details for the current member
          const { data: userData } = await supabase
            .from('app_users')
            .select('auth_user_id, email, display_name, avatar_url')
            .eq('auth_user_id', user.id)
            .maybeSingle();

          const memberWithUser: WorkspaceMemberWithUser = {
            ...memberData,
            user: userData
              ? {
                  id: userData.auth_user_id,
                  email: userData.email,
                  display_name: userData.display_name || userData.email?.split('@')[0],
                  avatar_url: userData.avatar_url,
                }
              : {
                  id: user.id,
                  email: user.email || '',
                  display_name: user.email?.split('@')[0] || 'User',
                  avatar_url: null,
                },
          };
          setCurrentMember(memberWithUser);
        }

        const { count } = await supabase
          .from('workspace_members')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceData.id);

        setMemberCount(count || 0);
      }

      // Fetch repositories with their details (use the actual workspace ID)
      const { data: repoData, error: repoError } = await supabase
        .from('workspace_repositories')
        .select(
          `
            *,
            repositories (
              id,
              full_name,
              name,
              owner,
              description,
              language,
              stargazers_count,
              forks_count,
              open_issues_count,
              avatar_url
            )
          `
        )
        .eq('workspace_id', workspaceData.id);

      if (repoError) {
        logger.error('Error fetching repositories:', repoError);
      }

      // Transform repository data to match the Repository interface
      logger.debug('Fetched workspace repositories:', repoData?.length, repoData);
      const transformedRepos: Repository[] = (repoData || [])
        .filter((r) => r.repositories)
        .map((r: WorkspaceRepository) => ({
          id: r.repositories.id,
          full_name: r.repositories.full_name,
          owner: r.repositories.owner,
          name: r.repositories.name,
          description: r.repositories.description ?? undefined,
          language: r.repositories.language ?? undefined,
          stars: r.repositories.stargazers_count,
          forks: r.repositories.forks_count,
          open_prs: 0, // Will be populated in Phase B
          open_issues: r.repositories.open_issues_count,
          contributors: 0, // Will be populated in Phase B
          last_activity: new Date().toISOString(),
          is_pinned: r.is_pinned,
          avatar_url:
            r.repositories?.avatar_url ||
            (r.repositories?.owner
              ? `https://avatars.githubusercontent.com/${r.repositories.owner}`
              : getFallbackAvatar()),
          html_url: `https://github.com/${r.repositories.full_name}`,
        }));
      logger.debug('Transformed repositories:', transformedRepos.length, transformedRepos);

      // Phase A complete — render workspace + repos with zero metrics + loading
      setWorkspace(workspaceData);
      setRepositories(transformedRepos);
      // Show zero metrics immediately so the dashboard layout renders
      setMetrics(calculateWorkspaceMetrics(transformedRepos));
      setTrendData({ labels: [], datasets: [] });

      // Also ensure the workspace context is synced with the fetched data
      if (workspaceData) {
        syncWithUrl(workspaceData.slug || workspaceData.id);
      }

      // End initial loading — dashboard is now visible with repos + skeleton metrics
      setLoading(false);

      return { workspaceData, transformedRepos, user };
    } catch (err) {
      setError('Failed to load workspace');
      logger.error('Error:', err);
      setLoading(false);
      return null;
    }
  }, [workspaceId, syncWithUrl]);

  // Phase B: Fetch metrics data (PRs, issues, reviews, comments) in parallel with limits
  const fetchWorkspaceMetrics = useCallback(
    async (transformedRepos: Repository[]) => {
      if (transformedRepos.length === 0) {
        setMetricsLoading(false);
        return;
      }

      try {
        const supabase = await getSupabase();

        // Filter repositories based on selection
        const filteredRepos =
          !selectedRepositories || selectedRepositories.length === 0
            ? transformedRepos
            : transformedRepos.filter((repo: Repository) => selectedRepositories.includes(repo.id));
        const repoIds = filteredRepos.map((r: Repository) => r.id);

        // Calculate date range based on selected time range
        // Fetch 2x the time range to calculate trends (current + previous period)
        const startDate = getStartDateForTimeRange(timeRange);
        startDate.setDate(startDate.getDate() - TIME_RANGE_DAYS[timeRange]);

        // Fetch PRs, issues, reviews, comments in parallel with limits
        const [prResult, issueResult, reviewResult, commentResult] = await Promise.all([
          // PRs
          supabase
            .from('pull_requests')
            .select(
              `id, title, number, merged_at, created_at, updated_at, additions, deletions,
               changed_files, commits, state, author_id, repository_id, html_url,
               contributors!pull_requests_contributor_id_fkey(username, avatar_url)`
            )
            .in('repository_id', repoIds)
            .or(
              `created_at.gte.${startDate.toISOString()},merged_at.gte.${startDate.toISOString()}`
            )
            .order('created_at', { ascending: true })
            .limit(queryLimit),

          // Issues
          supabase
            .from('issues')
            .select(
              `id, title, number, created_at, closed_at, state, author_id, repository_id,
               contributors!issues_author_id_fkey(username, avatar_url),
               repositories!issues_repository_id_fkey(full_name)`
            )
            .in('repository_id', repoIds)
            .gte('created_at', startDate.toISOString().split('T')[0])
            .order('created_at', { ascending: true })
            .limit(queryLimit),

          // Reviews
          supabase
            .from('reviews')
            .select(
              `id, pull_request_id, author_id, state, body, submitted_at,
               pull_requests!inner(title, number, repository_id),
               contributors!reviews_author_id_fkey(username, avatar_url)`
            )
            .in('pull_requests.repository_id', repoIds)
            .gte('submitted_at', startDate.toISOString())
            .order('submitted_at', { ascending: false })
            .limit(queryLimit),

          // Comments
          supabase
            .from('comments')
            .select(
              `id, pull_request_id, commenter_id, body, created_at, comment_type,
               pull_requests!inner(title, number, repository_id),
               contributors!fk_comments_commenter(username, avatar_url)`
            )
            .in('pull_requests.repository_id', repoIds)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(queryLimit),
        ]);

        // Process PR data
        let mergedPRs: MergedPR[] = [];
        let prDataForTrends: Array<{ created_at: string; state: string; commits?: number }> = [];
        let totalPRCount = 0;
        let totalCommitCount = 0;
        let uniqueContributorCount = 0;
        const prContributors = new Set<string>();

        const { data: prData, error: prError } = prResult;
        if (prError) {
          logger.error('Error fetching PR data:', prError);
        }

        if (prData) {
          const formattedPRs = prData.map((pr) => {
            const repoFullName = transformedRepos.find((r) => r.id === pr.repository_id)?.full_name;
            return {
              ...pr,
              author_login: (() => {
                const contrib = pr.contributors as
                  | { username?: string; avatar_url?: string }
                  | { username?: string; avatar_url?: string }[]
                  | undefined;
                if (Array.isArray(contrib)) {
                  return contrib[0]?.username || 'Unknown';
                }
                return contrib?.username || 'Unknown';
              })(),
              repository_name: repoFullName,
              html_url:
                pr.html_url ||
                (repoFullName && pr.number
                  ? `https://github.com/${repoFullName}/pull/${pr.number}`
                  : undefined),
            };
          });
          setFullPRData(formattedPRs);

          prDataForTrends = prData.map((pr) => ({
            created_at: pr.created_at,
            state: pr.state,
            commits: pr.commits || 0,
          }));

          const currentPeriodStart = new Date();
          currentPeriodStart.setDate(currentPeriodStart.getDate() - TIME_RANGE_DAYS[timeRange]);

          const currentPeriodPRs = prData.filter((pr) => {
            const prDate = new Date(pr.created_at);
            return prDate >= currentPeriodStart;
          });

          totalPRCount = currentPeriodPRs.length;
          totalCommitCount = currentPeriodPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0);

          prData.forEach((pr) => {
            if (pr.author_id) prContributors.add(pr.author_id);
          });

          mergedPRs = prData
            .filter((pr) => pr.merged_at !== null)
            .map((pr) => ({
              merged_at: pr.merged_at,
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
              changed_files: pr.changed_files || 0,
              commits: pr.commits || 0,
            }));

          if (mergedPRs.length === 0) {
            const openPRActivity = prData
              .filter((pr) => pr.state === 'open' && pr.created_at)
              .map((pr) => ({
                merged_at: pr.created_at,
                additions: pr.additions || 0,
                deletions: pr.deletions || 0,
                changed_files: pr.changed_files || 0,
                commits: pr.commits || 0,
              }));

            if (openPRActivity.length > 0) {
              mergedPRs = openPRActivity;
            }
          }
        }

        // Process issue data
        let issueDataForTrends: Array<{ created_at: string; state: string }> = [];

        const { data: issueData, error: issueError } = issueResult;
        if (issueError) {
          logger.error('Error fetching issue data:', issueError);
        }

        if (issueData) {
          const formattedIssues = issueData.map((issue) => {
            const repoData = issue.repositories as
              | { full_name: string }
              | { full_name: string }[]
              | undefined;
            const repoFullName = Array.isArray(repoData)
              ? repoData[0]?.full_name
              : repoData?.full_name;

            return {
              ...issue,
              author_login: (() => {
                const contrib = issue.contributors as
                  | { username?: string; avatar_url?: string }
                  | { username?: string; avatar_url?: string }[]
                  | undefined;
                if (Array.isArray(contrib)) {
                  return contrib[0]?.username || 'Unknown';
                }
                return contrib?.username || 'Unknown';
              })(),
              repository_name: repoFullName,
              html_url:
                repoFullName && issue.number
                  ? `https://github.com/${repoFullName}/issues/${issue.number}`
                  : undefined,
            };
          });
          setFullIssueData(formattedIssues);

          issueDataForTrends = issueData.map((issue) => ({
            created_at: issue.created_at,
            state: issue.state,
          }));

          const issueContributors = new Set(
            issueData.map((issue) => issue.author_id).filter(Boolean)
          );
          const allContributors = new Set([...prContributors, ...issueContributors]);
          uniqueContributorCount = allContributors.size;
        }

        // Process review data
        const { data: reviewData, error: reviewError } = reviewResult;
        if (reviewError) {
          logger.error('Error fetching review data:', reviewError);
        }

        if (reviewData && Array.isArray(reviewData)) {
          type ContributorData = { username?: string; avatar_url?: string };
          type ReviewData = {
            id: string;
            pull_request_id: string;
            author_id: string;
            state: string;
            body?: string;
            submitted_at: string;
            contributors?: ContributorData | ContributorData[];
            pull_requests?:
              | { title: string; number: number; repository_id: string }
              | Array<{ title: string; number: number; repository_id: string }>;
          };

          const isValidReview = (review: unknown): review is ReviewData => {
            return (
              typeof review === 'object' &&
              review !== null &&
              'id' in review &&
              'pull_request_id' in review &&
              'author_id' in review &&
              'state' in review &&
              'submitted_at' in review
            );
          };

          const repoMap = new Map(transformedRepos.map((repo) => [repo.id, repo.full_name]));

          const formattedReviews = reviewData.filter(isValidReview).map((r) => {
            const pr = Array.isArray(r.pull_requests) ? r.pull_requests[0] : r.pull_requests;
            let reviewerUsername = 'Unknown';
            if (r.contributors) {
              const contribData = r.contributors as ContributorData | ContributorData[];
              if (Array.isArray(contribData)) {
                reviewerUsername = contribData[0]?.username || 'Unknown';
              } else {
                reviewerUsername = contribData.username || 'Unknown';
              }
            }

            return {
              id: r.id,
              pull_request_id: r.pull_request_id,
              reviewer_id: r.author_id,
              state: r.state,
              body: r.body,
              submitted_at: r.submitted_at,
              reviewer_login: reviewerUsername,
              pr_title: pr?.title,
              pr_number: pr?.number,
              repository_id: pr?.repository_id,
              repository_name: pr?.repository_id ? repoMap.get(pr.repository_id) : undefined,
            };
          });
          setFullReviewData(formattedReviews);
        }

        // Process comment data
        const { data: commentData, error: commentError } = commentResult;
        if (commentError) {
          logger.error('Error fetching comment data:', commentError);
        }

        if (commentData && Array.isArray(commentData)) {
          type CommentContributorData = { username?: string; avatar_url?: string };
          const isValidComment = (
            comment: unknown
          ): comment is {
            id: string;
            pull_request_id: string;
            commenter_id: string;
            body: string;
            created_at: string;
            comment_type: string;
            contributors?: CommentContributorData | CommentContributorData[];
            pull_requests?:
              | { title: string; number: number; repository_id: string }
              | Array<{ title: string; number: number; repository_id: string }>;
          } => {
            return (
              typeof comment === 'object' &&
              comment !== null &&
              'id' in comment &&
              'pull_request_id' in comment &&
              'commenter_id' in comment &&
              'created_at' in comment
            );
          };

          const repoMap = new Map(transformedRepos.map((repo) => [repo.id, repo.full_name]));

          const formattedComments = commentData.filter(isValidComment).map((c) => {
            const pr = Array.isArray(c.pull_requests) ? c.pull_requests[0] : c.pull_requests;
            return {
              id: c.id,
              pull_request_id: c.pull_request_id,
              commenter_id: c.commenter_id,
              body: c.body,
              created_at: c.created_at,
              comment_type: c.comment_type,
              commenter_login: (() => {
                const contrib = c.contributors as
                  | CommentContributorData
                  | CommentContributorData[]
                  | undefined;
                if (Array.isArray(contrib)) {
                  return contrib[0]?.username || 'Unknown';
                }
                return contrib?.username || 'Unknown';
              })(),
              pr_title: pr?.title,
              pr_number: pr?.number,
              repository_id: pr?.repository_id,
              repository_name: pr?.repository_id ? repoMap.get(pr.repository_id) : undefined,
            };
          });
          setFullCommentData(formattedComments);
        }

        // Lightweight queries for per-repo open PR/issue counts
        const [openPRDataResult, openIssueDataResult] = await Promise.all([
          supabase
            .from('pull_requests')
            .select('repository_id')
            .in('repository_id', repoIds)
            .eq('state', 'open')
            .limit(1000),
          supabase
            .from('issues')
            .select('repository_id')
            .in('repository_id', repoIds)
            .eq('state', 'open')
            .limit(1000),
        ]);

        const prCountMap = new Map<string, number>();
        if (openPRDataResult.data) {
          openPRDataResult.data.forEach((pr) => {
            const count = prCountMap.get(pr.repository_id) || 0;
            prCountMap.set(pr.repository_id, count + 1);
          });
        }

        const issueCountMap = new Map<string, number>();
        if (openIssueDataResult.data) {
          openIssueDataResult.data.forEach((issue) => {
            const count = issueCountMap.get(issue.repository_id) || 0;
            issueCountMap.set(issue.repository_id, count + 1);
          });
        }

        // Fetch contributor count
        const { data: prContributorData, error: prContributorError } = await supabase
          .from('pull_requests')
          .select('author_id')
          .in('repository_id', repoIds)
          .not('author_id', 'is', null)
          .limit(queryLimit);

        if (prContributorError) {
          logger.error('Error fetching PR contributors:', prContributorError);
        } else if (prContributorData && prContributorData.length > 0) {
          const contributorIds = [...new Set(prContributorData.map((pr) => pr.author_id))];
          uniqueContributorCount = Math.max(uniqueContributorCount, contributorIds.length);
        }

        // Update repositories with their PR and issue counts
        const updatedRepos = transformedRepos.map((repo) => ({
          ...repo,
          open_prs: prCountMap.get(repo.id) || 0,
          open_issues: issueCountMap.get(repo.id) || repo.open_issues,
        }));
        setRepositories(updatedRepos);

        // Count total issues from the current period only
        const currentPeriodStart = new Date();
        currentPeriodStart.setDate(currentPeriodStart.getDate() - TIME_RANGE_DAYS[timeRange]);

        const currentPeriodIssues =
          issueDataForTrends?.filter((issue) => {
            const issueDate = new Date(issue.created_at);
            return issueDate >= currentPeriodStart;
          }) || [];

        const totalIssueCount = currentPeriodIssues.length;

        // Calculate metrics for the previous period for trend comparison
        const daysInRange = TIME_RANGE_DAYS[timeRange];
        const today = new Date();
        const periodStart = new Date(today);
        periodStart.setDate(today.getDate() - daysInRange);
        const previousPeriodStart = new Date(periodStart);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - daysInRange);

        const previousPRs =
          prDataForTrends?.filter((pr) => {
            const prDate = new Date(pr.created_at);
            return prDate >= previousPeriodStart && prDate < periodStart;
          }) || [];

        const previousIssues =
          issueDataForTrends?.filter((issue) => {
            const issueDate = new Date(issue.created_at);
            return issueDate >= previousPeriodStart && issueDate < periodStart;
          }) || [];

        const previousMetrics = {
          starCount: updatedRepos.reduce((sum, repo) => sum + (repo.stars || 0), 0),
          prCount: previousPRs.length,
          issueCount: previousIssues.length,
          contributorCount: uniqueContributorCount,
          commitCount: previousPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0),
        };

        const realMetrics = calculateWorkspaceMetrics(
          updatedRepos,
          totalPRCount,
          uniqueContributorCount,
          totalCommitCount,
          totalIssueCount,
          previousMetrics
        );

        const realTrendData = calculateTrendData(
          TIME_RANGE_DAYS[timeRange],
          prDataForTrends,
          issueDataForTrends
        );

        const activityDataPoints = generateActivityData(mergedPRs, timeRange);

        setMetrics(realMetrics);
        setTrendData(realTrendData);
        setActivityData(activityDataPoints);
      } catch (err) {
        logger.error('Error fetching workspace metrics:', err);
      } finally {
        setMetricsLoading(false);
      }
    },
    [timeRange, selectedRepositories, queryLimit]
  );

  // Phase C: Background enrichment (events cache, bio lookups, LLM call)
  // Skipped entirely on slow connections (2G/slow-2g)
  const fetchWorkspaceEnrichment = useCallback(async (transformedRepos: Repository[]) => {
    if (transformedRepos.length === 0) return;

    try {
      const supabase = await getSupabase();

      // Fetch individual star and fork events from github_events_cache
      interface GitHubEvent {
        event_id: string;
        event_type: string;
        actor_login: string;
        repository_owner: string;
        repository_name: string;
        created_at: string;
        payload: unknown;
      }
      const allStarEvents: GitHubEvent[] = [];
      const allForkEvents: GitHubEvent[] = [];

      await Promise.all(
        transformedRepos.map(async (repo) => {
          const [owner, name] = repo.full_name.split('/');

          const { data: events, error: eventsError } = await supabase
            .from('github_events_cache')
            .select('*')
            .in('event_type', ['WatchEvent', 'ForkEvent'])
            .eq('repository_owner', owner)
            .eq('repository_name', name)
            .order('created_at', { ascending: false })
            .limit(100);

          if (!eventsError && events) {
            const stars = events.filter((e) => e.event_type === 'WatchEvent');
            const forks = events.filter((e) => e.event_type === 'ForkEvent');
            allStarEvents.push(...stars);
            allForkEvents.push(...forks);
          }
        })
      );

      // Collect unique actor logins from star/fork events to batch-lookup bios
      const actorLogins = [
        ...new Set(
          [
            ...allStarEvents.map((e) => e.actor_login),
            ...allForkEvents.map((e) => e.actor_login),
          ].filter(Boolean)
        ),
      ];

      // Batch-fetch bios from contributors table
      const fullBioMap = new Map<string, string>();
      if (actorLogins.length > 0) {
        const { data: contributors } = await supabase
          .from('contributors')
          .select('username, bio')
          .in('username', actorLogins);
        if (contributors) {
          for (const c of contributors) {
            if (c.bio) {
              fullBioMap.set(c.username, c.bio);
            }
          }
        }

        // Fetch missing bios from GitHub API (limit to 10 to avoid rate limits)
        const missingBioLogins = actorLogins.filter((login) => !fullBioMap.has(login)).slice(0, 10);
        if (missingBioLogins.length > 0) {
          const profileResults = await Promise.allSettled(
            missingBioLogins.map((login) => fetchGitHubUserProfile(login))
          );
          for (let i = 0; i < missingBioLogins.length; i++) {
            const result = profileResults[i];
            if (result.status === 'fulfilled' && result.value?.bio) {
              fullBioMap.set(missingBioLogins[i], result.value.bio);
              supabase
                .from('contributors')
                .update({ bio: result.value.bio })
                .eq('username', missingBioLogins[i])
                .then(() => {});
            }
          }
        }
      }

      // Abbreviate bios using LLM (falls back to truncation)
      const bioMap = fullBioMap.size > 0 ? await abbreviateBios(fullBioMap) : fullBioMap;

      // Format star events
      const formattedStars = allStarEvents.map((event) => {
        const payload = event.payload as { actor?: { login: string; avatar_url: string } };
        return {
          id: event.event_id,
          event_type: 'star' as const,
          actor_login: event.actor_login,
          actor_avatar: payload?.actor?.avatar_url || getFallbackAvatar(),
          actor_bio: bioMap.get(event.actor_login),
          actor_full_bio: fullBioMap.get(event.actor_login),
          repository_name: `${event.repository_owner}/${event.repository_name}`,
          captured_at: event.created_at,
        };
      });
      setFullStarData(formattedStars);

      // Format fork events
      const formattedForks = allForkEvents.map((event) => {
        const payload = event.payload as { actor?: { login: string; avatar_url: string } };
        return {
          id: event.event_id,
          event_type: 'fork' as const,
          actor_login: event.actor_login,
          actor_avatar: payload?.actor?.avatar_url || getFallbackAvatar(),
          actor_bio: bioMap.get(event.actor_login),
          actor_full_bio: fullBioMap.get(event.actor_login),
          repository_name: `${event.repository_owner}/${event.repository_name}`,
          captured_at: event.created_at,
        };
      });
      setFullForkData(formattedForks);
    } catch (err) {
      logger.error('Error fetching workspace enrichment data:', err);
    }
  }, []);

  // Orchestrate all phases progressively
  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    setMetricsLoading(true);

    // Phase A: Core workspace + repos
    const result = await fetchWorkspaceCore();
    if (!result) return;

    const { transformedRepos } = result;

    // Phase B: Metrics (runs after Phase A renders)
    await fetchWorkspaceMetrics(transformedRepos);

    // Phase C: Enrichment — skip on slow connections
    if (!isSlowConnection) {
      fetchWorkspaceEnrichment(transformedRepos);
    }
  }, [fetchWorkspaceCore, fetchWorkspaceMetrics, fetchWorkspaceEnrichment, isSlowConnection]);

  // Separate useEffect to update metrics with event data without refetching
  useEffect(() => {
    if (eventMetrics?.stars) {
      setMetrics((prev) => {
        if (!prev) return prev;

        // Only use velocity if it's a valid positive number
        // Otherwise keep the existing totalStars (which is actual star count)
        const starsPerDay = eventMetrics.stars.velocity;
        const isValidVelocity = typeof starsPerDay === 'number' && starsPerDay > 0;

        return {
          ...prev,
          starsTrend: eventMetrics.stars.percentChange,
          // Only override totalStars with velocity if it's valid
          // This prevents showing total stars when velocity fails
          totalStars: isValidVelocity ? starsPerDay : prev.totalStars,
        };
      });
    }
  }, [eventMetrics]);

  useEffect(() => {
    // Sync the workspace dropdown with the current URL
    if (workspaceId) {
      syncWithUrl(workspaceId);
    }
    // Skip re-fetch after repo removal — local state is already correct
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }

    // Seed from SSR data for instant first paint (consumed once via ref)
    const cachedSSR = ssrDataRef.current;
    if (!ssrConsumedRef.current && cachedSSR?.workspace) {
      ssrConsumedRef.current = true;
      const ws = cachedSSR.workspace;
      if (ws.repositories) {
        const ssrRepos: Repository[] = ws.repositories.map((r) => ({
          id: r.id,
          full_name: r.full_name,
          name: r.name,
          owner: r.owner,
          description: r.description ?? undefined,
          language: r.language ?? undefined,
          stars: r.stargazer_count || 0,
          forks: 0,
          open_prs: 0,
          open_issues: 0,
          contributors: 0,
          last_activity: new Date().toISOString(),
          is_pinned: false,
          avatar_url: `https://avatars.githubusercontent.com/${r.owner}`,
          html_url: `https://github.com/${r.full_name}`,
        }));
        setRepositories(ssrRepos);
        setMetrics(calculateWorkspaceMetrics(ssrRepos));
        setTrendData({ labels: [], datasets: [] });
      }
    }

    fetchWorkspace();
  }, [fetchWorkspace, workspaceId, syncWithUrl]);

  const handleTabChange = (value: string) => {
    if (value === 'overview') {
      navigate(`/i/${workspace?.slug || workspaceId}`);
    } else {
      navigate(`/i/${workspace?.slug || workspaceId}/${value}`);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <WorkspaceDashboardSkeleton />
      </div>
    );
  }

  if (error || !workspace || !trendData) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'Workspace not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleAddRepository = async () => {
    // Check if user is logged in first
    if (!currentUser) {
      const supabase = await getSupabase();
      // Trigger GitHub OAuth flow
      const redirectTo = window.location.origin + window.location.pathname;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectTo,
          scopes: 'read:user user:email public_repo',
        },
      });

      if (signInError) {
        toast.error('Failed to initiate sign in');
        logger.error('Auth error:', signInError);
      }
      return;
    }
    setAddRepositoryModalOpen(true);
  };

  const handleAddRepositorySuccess = async () => {
    // Refresh the repositories list after adding
    if (!workspace) return;

    try {
      const supabase = await getSupabase();
      // Fetch repositories with their details
      const { data: repoData, error: repoError } = await supabase
        .from('workspace_repositories')
        .select(
          `
          *,
          repositories (
            id,
            full_name,
            name,
            owner,
            description,
            language,
            stargazers_count,
            forks_count,
            open_issues_count,
            avatar_url
          )
        `
        )
        .eq('workspace_id', workspace.id);

      if (!repoError && repoData) {
        const formattedRepos: Repository[] = repoData
          .filter((item: WorkspaceRepository) => item.repositories)
          .map((item: WorkspaceRepository) => ({
            id: item.repositories.id,
            full_name: item.repositories.full_name,
            name: item.repositories.name,
            owner: item.repositories.owner,
            description: item.repositories.description || '',
            language: item.repositories.language || '',
            stars: item.repositories.stargazers_count || 0,
            forks: item.repositories.forks_count || 0,
            open_prs: 0, // Mock for now
            open_issues: item.repositories.open_issues_count || 0,
            contributors: 0, // Will be populated from real data
            avatar_url:
              item.repositories?.avatar_url ||
              (item.repositories?.owner
                ? `https://avatars.githubusercontent.com/${item.repositories.owner}`
                : getFallbackAvatar()),
            last_activity: new Date().toISOString().split('T')[0],
            is_pinned: item.is_pinned || false,
            html_url: `https://github.com/${item.repositories.full_name}`,
          }));

        setRepositories(formattedRepos);
        setSelectedRepositories(formattedRepos.map((r) => r.id));

        // Update metrics with new repository data
        const newMetrics = calculateWorkspaceMetrics(formattedRepos);
        setMetrics(newMetrics);
      }
    } catch (error) {
      logger.error('Error refreshing repositories:', error);
      toast.error('Failed to refresh repositories');
    }
  };

  const handleRemoveRepository = async (repo: Repository) => {
    if (!workspace || !currentUser || !appUserId) return;

    try {
      const result = await WorkspaceService.removeRepositoryFromWorkspace(
        workspace.id,
        appUserId,
        repo.id
      );

      if (result.success) {
        // Skip the fetchWorkspace re-run triggered by selectedRepositories change
        // The local state update is sufficient and avoids a stale read from the DB
        skipNextFetchRef.current = true;

        // Remove the repository from the local state immediately
        setRepositories((prev) => prev.filter((r) => r.id !== repo.id));

        // Also remove from selected repositories if it was selected
        setSelectedRepositories((prev) => prev.filter((id) => id !== repo.id));

        // Update metrics after removing repository
        const updatedRepos = repositories.filter((r) => r.id !== repo.id);
        const newMetrics = calculateWorkspaceMetrics(updatedRepos);
        setMetrics(newMetrics);

        toast.success('Repository removed from workspace');
      } else {
        toast.error(result.error || 'Failed to remove repository');
      }
    } catch (error) {
      logger.error('Error removing repository:', error);
      toast.error('Failed to remove repository from workspace');
    }
  };

  const handleRepositoryClick = (repo: Repository) => {
    navigate(`/${repo.full_name}`);
  };

  const handleGitHubAppModalOpen = (repo: Repository) => {
    setSelectedRepoForModal(repo);
    setGithubAppModalOpen(true);
  };

  const handleSettingsClick = () => {
    toast.info('Workspace settings coming soon!');
  };

  const handleUpgradeClick = () => {
    navigate('/billing');
  };

  const handleIssueRespond = async (issue: Issue) => {
    // Set current item for modal
    setCurrentRespondItem({
      id: issue.id,
      type: 'issue',
      url: `https://github.com/${issue.repository.owner}/${issue.repository.name}/issues/${issue.number}`,
      number: issue.number,
      title: issue.title,
      repository: `${issue.repository.owner}/${issue.repository.name}`,
    });

    setResponseModalOpen(true);
    setLoadingSimilarItems(true);

    try {
      // Check cache first
      const cacheKey = similarityCache.getCacheKey(workspace.id, issue.id.toString(), 'issue');
      const cachedItems = similarityCache.get(workspace.id, issue.id.toString(), 'issue');

      if (cachedItems) {
        // Use cached results
        setSimilarItems(cachedItems);
        const { generateResponseMessage } = await import('@/services/similarity-search');
        const message = generateResponseMessage(cachedItems);
        setResponseMessage(message);
        setLoadingSimilarItems(false);
        return;
      }

      // Perform debounced search if not cached
      const searchResult = await debouncedSearch(cacheKey, async () => {
        // Dynamically import similarity search to avoid loading ML models on page init
        const { findSimilarItems, generateResponseMessage } =
          await import('@/services/similarity-search');

        // Find similar items in the workspace
        const items = await findSimilarItems({
          workspaceId: workspace.id,
          queryItem: {
            id: issue.id.toString(),
            title: issue.title,
            body: null, // Issue interface doesn't include body field
            type: 'issue',
          },
          limit: 7,
        });

        // Cache the results
        similarityCache.set(workspace.id, issue.id.toString(), 'issue', items);

        return { items, message: generateResponseMessage(items) };
      });

      if (searchResult) {
        setSimilarItems(searchResult.items);
        setResponseMessage(searchResult.message);
      }
    } catch (error) {
      logger.error('Error finding similar items:', error);
      setSimilarItems([]);
      setResponseMessage(
        'Similarity search is not available yet. Embeddings need to be generated for this workspace.'
      );
    } finally {
      setLoadingSimilarItems(false);
    }
  };

  const handleDiscussionRespond = async (discussion: Discussion) => {
    // Set current item for modal
    setCurrentRespondItem({
      id: discussion.id,
      type: 'discussion',
      url: discussion.url,
      number: discussion.number,
      title: discussion.title,
      repository: discussion.repositories?.full_name || 'Unknown',
    });

    setResponseModalOpen(true);
    setLoadingSimilarItems(true);

    try {
      // Check cache first
      const cacheKey = similarityCache.getCacheKey(
        workspace.id,
        discussion.id.toString(),
        'discussion'
      );
      const cachedItems = similarityCache.get(workspace.id, discussion.id.toString(), 'discussion');

      if (cachedItems) {
        // Use cached results
        setSimilarItems(cachedItems);
        const { generateResponseMessage } = await import('@/services/similarity-search');
        const message = generateResponseMessage(cachedItems);
        setResponseMessage(message);
        setLoadingSimilarItems(false);
        return;
      }

      // Perform debounced search if not cached
      const searchResult = await debouncedSearch(cacheKey, async () => {
        // Dynamically import similarity search to avoid loading ML models on page init
        const { findSimilarItems, generateResponseMessage } =
          await import('@/services/similarity-search');

        // Find similar items in the workspace
        const items = await findSimilarItems({
          workspaceId: workspace.id,
          queryItem: {
            id: discussion.id.toString(),
            title: discussion.title,
            body: discussion.body || null,
            type: 'discussion',
          },
          limit: 7,
        });

        // Cache the results
        similarityCache.set(workspace.id, discussion.id.toString(), 'discussion', items);

        return { items, message: generateResponseMessage(items) };
      });

      if (searchResult) {
        setSimilarItems(searchResult.items);
        setResponseMessage(searchResult.message);
      }
    } catch (error) {
      logger.error('Error finding similar items:', error);
      setSimilarItems([]);
      setResponseMessage(
        'Similarity search is not available yet. Embeddings need to be generated for this workspace.'
      );
    } finally {
      setLoadingSimilarItems(false);
    }
  };

  const handleDirectMarkAsResponded = async (item: MyWorkItem) => {
    if (!workspace?.id) {
      return;
    }

    // Optimistically remove the item immediately for instant UI feedback
    optimisticallyRemoveItem(item.id, item.itemType);

    try {
      const supabase = await getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        toast.error('You must be logged in to mark items as responded.');
        // Restore the item since we couldn't complete the action
        restoreItem(item.id);
        return;
      }

      // Determine the table name based on item type
      let tableName: 'issues' | 'discussions' | 'pull_requests';
      if (item.type === 'issue') {
        tableName = 'issues';
      } else if (item.type === 'discussion') {
        tableName = 'discussions';
      } else {
        tableName = 'pull_requests';
      }

      // Extract the actual database ID by removing the prefix
      // MyWorkItem IDs have format: "issue-{id}", "discussion-{id}", or "follow-up-pr-{id}", etc.
      const actualId = item.id.replace(
        /^(issue-|discussion-|review-pr-|follow-up-pr-|follow-up-issue-|follow-up-discussion-|my-comment-|my-discussion-comment-)/,
        ''
      );

      // Update the item with responded_by and responded_at
      const { error } = await supabase
        .from(tableName)
        .update({
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', actualId);

      if (error) {
        logger.error('Error marking item as responded: %s', error.message);
        toast.error(`Failed to mark as responded: ${error.message}`);
        // Restore the item since the database update failed
        restoreItem(item.id);
        return;
      }

      let itemTypeLabel: string;
      if (item.type === 'issue') {
        itemTypeLabel = 'Issue';
      } else if (item.type === 'discussion') {
        itemTypeLabel = 'Discussion';
      } else {
        itemTypeLabel = 'PR';
      }

      toast.success(`${itemTypeLabel} #${item.number} marked as responded.`);

      // Don't call refreshMyWork() here - the optimistic UI already shows the correct state
      // Data will sync naturally on next tab change, pagination, or page reload
      // This prevents the whole list from flickering/disappearing during refresh
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error marking item as responded: %s', errorMessage);
      toast.error(`Failed to mark as responded: ${errorMessage}`);
      // Restore the item since the operation failed
      restoreItem(item.id);
    }
  };

  const handleWorkspaceUpdate = (updates: Partial<Workspace>) => {
    if (workspace) {
      setWorkspace((prev) => (prev ? { ...prev, ...updates } : prev));
    }
  };

  // Analytics functions disabled - will be implemented in issue #598
  /*
  // Generate analytics data from existing workspace data
  const generateAnalyticsData = (): AnalyticsData => {
    // Get current pull requests and issues from the workspace tabs
    const activities: ActivityItem[] = [];
    const contributorMap = new Map<string, ContributorStat>();
    const repositoryMetrics: RepositoryMetric[] = [];

    // Generate activities from recent data (mock for now, should be fetched from DB)
    const now = new Date();
    const activityTypes = ['pr', 'issue', 'commit', 'review'] as const;
    const statuses = ['open', 'merged', 'closed', 'approved'] as const;

    // Create sample activities based on repositories
    repositories.forEach((repo, repoIndex) => {
      // Add repository metrics
      repositoryMetrics.push({
        id: repo.id,
        name: repo.name,
        owner: repo.owner,
        stars: repo.stars,
        forks: repo.forks,
        pull_requests: repo.open_prs,
        issues: repo.open_issues,
        contributors: repo.contributors,
        activity_score: 50, // Placeholder
        trend: 0, // Placeholder
      });

      // TODO: Generate real activities from repository data
      // Mock generation removed - will be implemented with real data fetching
    });

    // TODO: Generate real trend data
    const trends: TrendDataset[] = [];

    return {
      activities: activities.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      contributors: Array.from(contributorMap.values()).sort(
        (a, b) => b.contributions - a.contributions
      ),
      repositories: repositoryMetrics,
      trends,
    };
  };

  // Handle analytics export
  const handleAnalyticsExport = async (format: 'csv' | 'json' | 'pdf') => {
    try {
      const analyticsData = generateAnalyticsData();
      await WorkspaceExportService.export(analyticsData, format, {
        workspaceName: workspace.name,
        dateRange:
          timeRange !== 'all'
            ? {
                start: new Date(Date.now() - TIME_RANGE_DAYS[timeRange] * 24 * 60 * 60 * 1000),
                end: new Date(),
              }
            : undefined,
      });
      toast.success(`Analytics exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(`Failed to export analytics: ${error}`);
    }
  };
  */

  return (
    <div className="min-h-screen">
      {/* Workspace Header */}
      <WorkspaceHeader
        workspaceName={workspace.name}
        workspaceDescription={workspace.description}
        workspaceTier={workspace.tier as 'free' | 'pro' | 'enterprise'}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        repositories={repositories}
        selectedRepositories={selectedRepositories}
        onRepositorySelectionChange={setSelectedRepositories}
        onUpgradeClick={handleUpgradeClick}
      />

      {/* Tab Navigation */}
      <div className="container max-w-7xl mx-auto px-6 mt-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <WorkspaceTabNavigation />

          {/* Modals - Available on all tabs */}
          <WorkspaceModals
            reviewerModal={{
              open: reviewerModalOpen,
              onOpenChange: setReviewerModalOpen,
              repositories,
            }}
            githubAppModal={{
              open: githubAppModalOpen,
              onOpenChange: setGithubAppModalOpen,
              selectedRepository: selectedRepoForModal,
              isInstalled: selectedRepoForModal
                ? (appStatus.repoStatuses?.get(selectedRepoForModal.id)?.isInstalled ?? false)
                : false,
            }}
            responseModal={{
              open: responseModalOpen,
              onOpenChange: setResponseModalOpen,
              loading: loadingSimilarItems,
              similarItems,
              responseMessage,
              currentItem: currentRespondItem,
              workspaceId: workspace.id,
              onItemMarkedAsResponded: () => {
                // Clear the current item when modal closes
                setCurrentRespondItem(null);
                // Refresh My Work data to remove the responded item from the list
                refreshMyWork();
              },
            }}
          />

          <TabsContent value="overview" className="mt-6 space-y-4">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceDashboard
                workspaceId={workspace.id}
                workspaceName=""
                metrics={
                  metrics || {
                    totalStars: 0,
                    totalPRs: 0,
                    totalIssues: 0,
                    totalContributors: 0,
                    totalCommits: 0,
                    starsTrend: 0,
                    prsTrend: 0,
                    issuesTrend: 0,
                    contributorsTrend: 0,
                    commitsTrend: 0,
                  }
                }
                trendData={trendData}
                activityData={activityData}
                repositories={repositories}
                myWorkItems={myWorkItems}
                myWorkTotalCount={myWorkTotalCount}
                myWorkTabCounts={myWorkTabCounts}
                myWorkCurrentPage={myWorkPage}
                myWorkItemsPerPage={myWorkItemsPerPage}
                myWorkLoading={myWorkLoading}
                myWorkSelectedTypes={myWorkSelectedTypes}
                myWorkActiveTab={myWorkActiveTab}
                onMyWorkPageChange={setMyWorkPage}
                onMyWorkTypesChange={setMyWorkSelectedTypes}
                onMyWorkTabChange={setMyWorkActiveTab}
                loading={metricsLoading}
                tier={workspace.tier as 'free' | 'pro' | 'enterprise'}
                timeRange={timeRange}
                onAddRepository={isWorkspaceOwner ? handleAddRepository : undefined}
                onRemoveRepository={isWorkspaceOwner ? handleRemoveRepository : undefined}
                onRepositoryClick={handleRepositoryClick}
                onGitHubAppModalOpen={handleGitHubAppModalOpen}
                onSettingsClick={handleSettingsClick}
                onUpgradeClick={handleUpgradeClick}
                onMyWorkItemClick={(item) => {
                  // Open the URL in a new tab
                  window.open(item.url, '_blank', 'noopener,noreferrer');
                }}
                onMyWorkItemRespond={async (item) => {
                  // Debug logging for button visibility
                  console.log('onMyWorkItemRespond called with:', {
                    itemId: item.id,
                    itemType: item.type,
                    workspaceId: workspace.id,
                  });

                  // Set current item BEFORE opening modal
                  setCurrentRespondItem({
                    id: item.id,
                    type: item.type,
                    url: item.url,
                    number: item.number,
                    title: item.title,
                    repository: item.repository,
                  });

                  setResponseModalOpen(true);
                  setLoadingSimilarItems(true);

                  try {
                    // Check cache first
                    const cacheKey = similarityCache.getCacheKey(workspace.id, item.id, item.type);
                    const cachedItems = similarityCache.get(workspace.id, item.id, item.type);

                    if (cachedItems) {
                      // Use cached results
                      setSimilarItems(cachedItems);
                      const { generateResponseMessage } =
                        await import('@/services/similarity-search');
                      const message = generateResponseMessage(cachedItems);
                      setResponseMessage(message);
                      setLoadingSimilarItems(false);
                      return;
                    }

                    // Perform debounced search if not cached
                    const searchResult = await debouncedSearch(cacheKey, async () => {
                      // Dynamically import similarity search to avoid loading ML models on page init
                      const { findSimilarItems, generateResponseMessage } =
                        await import('@/services/similarity-search');

                      // Find similar items in the workspace
                      const items = await findSimilarItems({
                        workspaceId: workspace.id,
                        queryItem: {
                          id: item.id,
                          title: item.title,
                          body: null, // We don't have the body in MyWorkItem
                          type: item.type,
                        },
                        limit: 7,
                      });

                      // Cache the results
                      similarityCache.set(workspace.id, item.id, item.type, items);

                      return { items, message: generateResponseMessage(items) };
                    });

                    if (searchResult) {
                      setSimilarItems(searchResult.items);
                      setResponseMessage(searchResult.message);
                    }
                  } catch (error) {
                    logger.error('Error finding similar items:', error);
                    setSimilarItems([]);
                    setResponseMessage(
                      'Similarity search is not available yet. Embeddings need to be generated for this workspace.'
                    );
                  } finally {
                    setLoadingSimilarItems(false);
                  }
                }}
                onMyWorkItemMarkAsResponded={handleDirectMarkAsResponded}
                onSyncComments={syncComments}
                isSyncingComments={isSyncingComments}
                commentSyncStatus={commentSyncStatus ?? undefined}
                repoStatuses={appStatus.repoStatuses}
              />
            </div>
          </TabsContent>

          <TabsContent value="prs" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspacePRsTab
                  repositories={repositories}
                  selectedRepositories={selectedRepositories}
                  timeRange={timeRange}
                  workspaceId={workspace.id}
                  workspace={workspace}
                  setReviewerModalOpen={setReviewerModalOpen}
                  onGitHubAppModalOpen={handleGitHubAppModalOpen}
                  currentUser={currentUser}
                  currentMember={currentMember}
                />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspaceIssuesTab
                  repositories={repositories}
                  selectedRepositories={selectedRepositories}
                  timeRange={timeRange}
                  workspaceId={workspace.id}
                  workspace={workspace}
                  onGitHubAppModalOpen={handleGitHubAppModalOpen}
                  currentUser={currentUser}
                  currentMember={currentMember}
                  onIssueRespond={handleIssueRespond}
                />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="discussions" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspaceDiscussionsTable
                  repositories={repositories.map((r) => ({
                    id: r.id,
                    name: r.name,
                    owner: r.owner,
                    full_name: r.full_name,
                  }))}
                  selectedRepositories={selectedRepositories}
                  workspaceId={workspace.id}
                  workspaceName={workspace.name}
                  timeRange={timeRange}
                  userRole={currentMember?.role}
                  isLoggedIn={!!currentUser}
                  onRespondClick={handleDiscussionRespond}
                />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="spam" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspaceSpamTab
                  repositories={repositories}
                  selectedRepositories={selectedRepositories}
                  currentUser={currentUser}
                  currentMember={currentMember}
                />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="contributors" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspaceContributorsTab
                  repositories={repositories}
                  selectedRepositories={selectedRepositories}
                  workspaceId={workspace.id}
                  userRole={currentMember?.role}
                  workspaceTier={workspace.tier}
                  isLoggedIn={!!currentUser}
                  currentUser={currentUser}
                  activities={activities}
                />
              </div>
            </Suspense>
          </TabsContent>

          {/* Analytics tab content disabled - will be implemented in issue #598
          <TabsContent value="analytics" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <AnalyticsDashboard
                data={generateAnalyticsData()}
                repositories={repositories.map((repo) => ({
                  id: `wr-${repo.id}`,
                  workspace_id: workspace.id,
                  repository_id: repo.id,
                  added_by: workspace.owner_id,
                  added_at: new Date().toISOString(),
                  notes: null,
                  tags: [],
                  is_pinned: false,
                  repository: {
                    id: repo.id,
                    full_name: repo.full_name,
                    owner: repo.owner,
                    name: repo.name,
                    description: repo.description || '',
                    language: repo.language || null,
                    stargazers_count: repo.stars,
                    forks_count: repo.forks,
                    open_issues_count: repo.open_issues,
                    topics: [],
                    is_private: false,
                    is_archived: false,
                  },
                  added_by_user: {
                    id: workspace.owner_id,
                    email: '',
                    display_name: '',
                  },
                }))}
                loading={loading}
                tier={workspace.tier as 'free' | 'pro' | 'enterprise'}
                onExport={handleAnalyticsExport}
              />
            </div>
          </TabsContent> */}

          <TabsContent value="activity" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspaceActivityTab
                  workspace={workspace}
                  prData={fullPRData}
                  issueData={fullIssueData}
                  reviewData={fullReviewData}
                  commentData={fullCommentData}
                  starData={fullStarData}
                  forkData={fullForkData}
                  repositories={repositories}
                  loading={loading}
                  error={error}
                  onSyncComplete={fetchWorkspace}
                />
              </div>
            </Suspense>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Suspense fallback={<TabSkeleton />}>
              <div className="container max-w-7xl mx-auto">
                <WorkspaceSettingsComponent
                  workspace={workspace}
                  currentMember={
                    currentMember || {
                      id: '',
                      workspace_id: workspace.id,
                      user_id: appUserId || '',
                      role: isWorkspaceOwner ? 'owner' : 'contributor',
                      accepted_at: null,
                      invited_at: null,
                      invited_by: null,
                      notifications_enabled: true,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      last_active_at: new Date().toISOString(),
                    }
                  }
                  memberCount={memberCount}
                  repositories={repositories.map((repo) => ({
                    id: repo.id,
                    owner: repo.owner,
                    name: repo.name,
                    full_name: repo.full_name,
                    stargazers_count: repo.stars,
                    forks_count: repo.forks,
                  }))}
                  onWorkspaceUpdate={handleWorkspaceUpdate}
                />
              </div>
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upgrade Prompt for Free Tier */}
      <UpgradePrompt tier={workspace.tier} onUpgradeClick={handleUpgradeClick} />

      {/* Add Repository Modal */}
      {workspace && (
        <AddRepositoryModal
          open={addRepositoryModalOpen}
          onOpenChange={setAddRepositoryModalOpen}
          workspaceId={workspace.id}
          onSuccess={handleAddRepositorySuccess}
        />
      )}
    </div>
  );
}

// Export wrapper with error boundary
function WorkspacePageWithErrorBoundary() {
  return (
    <WorkspaceErrorBoundary>
      <WorkspacePage />
    </WorkspaceErrorBoundary>
  );
}

export default WorkspacePageWithErrorBoundary;
