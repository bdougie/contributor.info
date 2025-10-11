import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { getFallbackAvatar } from '@/lib/utils/avatar';
import { useWorkspaceEvents } from '@/hooks/use-workspace-events';
import { TIME_RANGE_DAYS, getStartDateForTimeRange } from '@/lib/utils/time-range';
import {
  calculateWorkspaceMetrics,
  calculateTrendData,
  generateActivityData,
  type MergedPR,
} from '@/services/workspace-metrics.service';
import { WorkspaceContributorsTab } from '@/components/features/workspace/WorkspaceContributorsTab';
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
import {
  WorkspaceDiscussionsTable,
  type Discussion,
} from '@/components/features/workspace/WorkspaceDiscussionsTable';
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
import { WorkspaceSettings as WorkspaceSettingsComponent } from '@/components/features/workspace/settings/WorkspaceSettings';
import { useMyWork } from '@/hooks/use-my-work';
// Analytics imports disabled - will be implemented in issue #598
// import { AnalyticsDashboard } from '@/components/features/workspace/AnalyticsDashboard';

// Extracted tab components
import { WorkspacePRsTab } from '@/components/features/workspace/WorkspacePRsTab';
import { WorkspaceIssuesTab } from '@/components/features/workspace/WorkspaceIssuesTab';
import {
  WorkspaceActivityTab,
  type WorkspaceActivityTabProps as WorkspaceActivityProps,
} from '@/components/features/workspace/WorkspaceActivityTab';
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

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [trendData, setTrendData] = useState<WorkspaceTrendData | null>(null);
  const [activityData, setActivityData] = useState<ActivityDataPoint[]>([]);

  // Fetch live My Work data
  // Use workspace?.id (UUID) instead of workspaceId (which is a slug)
  const { items: myWorkItems } = useMyWork(workspace?.id);
  // TODO: Add pagination state, totalCount, and loading to WorkspaceDashboard props
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
      console.log(
        '%c🚀 Workspace Page - Development Mode',
        'background: #2563eb; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
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

  // Extract fetchWorkspace as a reusable function
  const fetchWorkspace = useCallback(async () => {
    if (!workspaceId) {
      setError('No workspace ID provided');
      setLoading(false);
      return;
    }

    try {
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
        console.error('Error fetching workspace:', wsError);
        setError(`Failed to load workspace: ${wsError.message}`);
        setLoading(false);
        return;
      }

      if (!workspaceData) {
        setError('Workspace not found');
        setLoading(false);
        return;
      }

      // Check if current user is the workspace owner
      if (user && workspaceData.owner_id === user.id) {
        setIsWorkspaceOwner(true);
      } else {
        setIsWorkspaceOwner(false);
      }

      // Fetch current member info and member count
      if (user) {
        const { data: memberData } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', workspaceData.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (memberData) {
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
        console.error('Error fetching repositories:', repoError);
      }

      // Transform repository data to match the Repository interface
      console.log('Fetched workspace repositories:', repoData?.length, repoData);
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
          open_prs: 0, // Will be populated from real data
          open_issues: r.repositories.open_issues_count,
          contributors: 0, // Will be populated from real data
          last_activity: new Date().toISOString(),
          is_pinned: r.is_pinned,
          avatar_url:
            r.repositories?.avatar_url ||
            (r.repositories?.owner
              ? `https://avatars.githubusercontent.com/${r.repositories.owner}`
              : getFallbackAvatar()),
          html_url: `https://github.com/${r.repositories.full_name}`,
        }));
      console.log('Transformed repositories:', transformedRepos.length, transformedRepos);

      // Fetch real data for metrics and trends
      let mergedPRs: MergedPR[] = [];
      let prDataForTrends: Array<{ created_at: string; state: string; commits?: number }> = [];
      let issueDataForTrends: Array<{ created_at: string; state: string }> = [];
      let totalPRCount = 0;
      let totalCommitCount = 0;
      let uniqueContributorCount = 0;

      if (transformedRepos.length > 0) {
        // Filter repositories based on selection (inline since only used once here)
        const filteredRepos =
          !selectedRepositories || selectedRepositories.length === 0
            ? transformedRepos
            : transformedRepos.filter((repo: Repository) => selectedRepositories.includes(repo.id));
        const repoIds = filteredRepos.map((r: Repository) => r.id);

        // Calculate date range based on selected time range
        // Fetch 2x the time range to calculate trends (current + previous period)
        const startDate = getStartDateForTimeRange(timeRange);
        // Extend start date for previous period comparison
        startDate.setDate(startDate.getDate() - TIME_RANGE_DAYS[timeRange]);

        // Fetch PRs for activity data and metrics with more fields for activity tab
        const { data: prData, error: prError } = await supabase
          .from('pull_requests')
          .select(
            `id, title, number, merged_at, created_at, updated_at, additions, deletions, 
               changed_files, commits, state, author_id, repository_id, html_url,
               contributors!pull_requests_contributor_id_fkey(username, avatar_url)`
          )
          .in('repository_id', repoIds)
          .or(`created_at.gte.${startDate.toISOString()},merged_at.gte.${startDate.toISOString()}`)
          .order('created_at', { ascending: true });

        if (prError) {
          console.error('Error fetching PR data:', prError);
        }

        if (prData) {
          // Format PR data for activity tab
          const formattedPRs = prData.map((pr) => ({
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
            })(), // Use actual GitHub username
            repository_name: transformedRepos.find((r) => r.id === pr.repository_id)?.full_name,
          }));
          setFullPRData(formattedPRs);

          // Store for trend calculation with commits
          prDataForTrends = prData.map((pr) => ({
            created_at: pr.created_at,
            state: pr.state,
            commits: pr.commits || 0,
          }));

          // Count total PRs and aggregate commits for current period only
          const currentPeriodStart = new Date();
          currentPeriodStart.setDate(currentPeriodStart.getDate() - TIME_RANGE_DAYS[timeRange]);

          const currentPeriodPRs = prData.filter((pr) => {
            const prDate = new Date(pr.created_at);
            return prDate >= currentPeriodStart;
          });

          totalPRCount = currentPeriodPRs.length;
          totalCommitCount = currentPeriodPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0);

          // Get unique contributors from PRs
          const prContributors = new Set(prData.map((pr) => pr.author_id).filter(Boolean));

          // Filter for merged PRs for activity chart
          mergedPRs = prData
            .filter((pr) => pr.merged_at !== null)
            .map((pr) => ({
              merged_at: pr.merged_at,
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
              changed_files: pr.changed_files || 0,
              commits: pr.commits || 0,
            }));

          // If no merged PRs found, use open PRs for activity
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

          // Fetch issues for metrics and trends with more fields for activity tab
          const { data: issueData, error: issueError } = await supabase
            .from('issues')
            .select(
              `id, title, number, created_at, closed_at, state, author_id, repository_id,
                       contributors!issues_author_id_fkey(username, avatar_url)`
            )
            .in('repository_id', repoIds)
            .gte('created_at', startDate.toISOString().split('T')[0]) // Use date only format (YYYY-MM-DD)
            .order('created_at', { ascending: true });

          if (issueError) {
            console.error('Error fetching issue data:', issueError);
          }

          if (issueData) {
            // Format issue data for activity tab
            const formattedIssues = issueData.map((issue) => ({
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
              })(), // Use actual GitHub username
              repository_name: transformedRepos.find((r) => r.id === issue.repository_id)
                ?.full_name,
            }));
            setFullIssueData(formattedIssues);

            // Store for trend calculation
            issueDataForTrends = issueData.map((issue) => ({
              created_at: issue.created_at,
              state: issue.state,
            }));

            // Add issue contributors to the set
            const issueContributors = new Set(
              issueData.map((issue) => issue.author_id).filter(Boolean)
            );

            // Merge contributor sets
            const allContributors = new Set([...prContributors, ...issueContributors]);
            uniqueContributorCount = allContributors.size;
          }

          // Fetch reviews for activity tab
          const { data: reviewData, error: reviewError } = await supabase
            .from('reviews')
            .select(
              `id, pull_request_id, author_id, state, body, submitted_at,
                 pull_requests!inner(title, number, repository_id),
                 contributors!reviews_author_id_fkey(username, avatar_url)`
            )
            .in('pull_requests.repository_id', repoIds)
            .gte('submitted_at', startDate.toISOString())
            .order('submitted_at', { ascending: false });

          if (reviewError) {
            console.error('Error fetching review data:', reviewError);
          }

          if (reviewData && Array.isArray(reviewData)) {
            // Define types for better type safety
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
                | {
                    title: string;
                    number: number;
                    repository_id: string;
                  }
                | Array<{
                    title: string;
                    number: number;
                    repository_id: string;
                  }>;
            };

            // Type guard for review data validation
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

            // Create a Map for O(1) repository lookups instead of O(n) find operations
            const repoMap = new Map(transformedRepos.map((repo) => [repo.id, repo.full_name]));

            const formattedReviews = reviewData.filter(isValidReview).map((r) => {
              // Handle both single object and array cases
              const pr = Array.isArray(r.pull_requests) ? r.pull_requests[0] : r.pull_requests;

              // Extract username from contributors join with type assertion
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
                reviewer_id: r.author_id, // Map author_id to reviewer_id for backwards compatibility
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

          // Fetch comments for activity tab
          const { data: commentData, error: commentError } = await supabase
            .from('comments')
            .select(
              `id, pull_request_id, commenter_id, body, created_at, comment_type,
                 pull_requests!inner(title, number, repository_id),
                 contributors!fk_comments_commenter(username, avatar_url)`
            )
            .in('pull_requests.repository_id', repoIds)
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: false });

          if (commentError) {
            console.error('Error fetching comment data:', commentError);
          }

          if (commentData && Array.isArray(commentData)) {
            // Type guard for comment data validation
            const isValidComment = (
              comment: unknown
            ): comment is {
              id: string;
              pull_request_id: string;
              commenter_id: string;
              body: string;
              created_at: string;
              comment_type: string;
              pull_requests?:
                | {
                    title: string;
                    number: number;
                    repository_id: string;
                  }
                | Array<{
                    title: string;
                    number: number;
                    repository_id: string;
                  }>;
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

            // Create a Map for O(1) repository lookups instead of O(n) find operations
            const repoMap = new Map(transformedRepos.map((repo) => [repo.id, repo.full_name]));

            const formattedComments = commentData.filter(isValidComment).map((c) => {
              // Handle both single object and array cases
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
                    | { username?: string; avatar_url?: string }
                    | { username?: string; avatar_url?: string }[]
                    | undefined;
                  if (Array.isArray(contrib)) {
                    return contrib[0]?.username || 'Unknown';
                  }
                  return contrib?.username || 'Unknown';
                })(), // Use actual GitHub username
                pr_title: pr?.title,
                pr_number: pr?.number,
                repository_id: pr?.repository_id,
                repository_name: pr?.repository_id ? repoMap.get(pr.repository_id) : undefined,
              };
            });
            setFullCommentData(formattedComments);
          }

          // Fetch individual star and fork events from github_events_cache
          // For each repository, fetch its events
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

          for (const repo of transformedRepos) {
            const [owner, name] = repo.full_name.split('/');

            // Fetch star events for this specific repository
            // Note: Removing date filter temporarily as events might have incorrect timestamps
            const { data: starEvents, error: starError } = await supabase
              .from('github_events_cache')
              .select('*')
              .eq('event_type', 'WatchEvent')
              .eq('repository_owner', owner)
              .eq('repository_name', name)
              // .gte('created_at', startDate.toISOString()) // Commented out for debugging
              .order('created_at', { ascending: false })
              .limit(50); // Limit per repository

            if (!starError && starEvents) {
              allStarEvents.push(...starEvents);
            }

            // Fetch fork events for this specific repository
            const { data: forkEvents, error: forkError } = await supabase
              .from('github_events_cache')
              .select('*')
              .eq('event_type', 'ForkEvent')
              .eq('repository_owner', owner)
              .eq('repository_name', name)
              // .gte('created_at', startDate.toISOString()) // Commented out for debugging
              .order('created_at', { ascending: false })
              .limit(50); // Limit per repository

            if (!forkError && forkEvents) {
              allForkEvents.push(...forkEvents);
            }
          }

          // Format star events
          const formattedStars = allStarEvents.map((event) => {
            const payload = event.payload as { actor?: { login: string; avatar_url: string } };
            return {
              id: event.event_id,
              event_type: 'star' as const,
              actor_login: event.actor_login,
              actor_avatar: payload?.actor?.avatar_url || getFallbackAvatar(),
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
              repository_name: `${event.repository_owner}/${event.repository_name}`,
              captured_at: event.created_at,
            };
          });
          setFullForkData(formattedForks);
        }
      }

      // Batch query to get open PR and issue counts for all repos at once
      if (transformedRepos.length > 0) {
        const repoIds = transformedRepos.map((r) => r.id);

        // Get all open PRs for these repositories in a single query
        const { data: openPRData } = await supabase
          .from('pull_requests')
          .select('repository_id')
          .in('repository_id', repoIds)
          .eq('state', 'open');

        // Count PRs per repository
        const prCountMap = new Map<string, number>();
        if (openPRData) {
          openPRData.forEach((pr) => {
            const count = prCountMap.get(pr.repository_id) || 0;
            prCountMap.set(pr.repository_id, count + 1);
          });
        }

        // Get all open issues for these repositories in a single query
        const { data: openIssueData } = await supabase
          .from('issues')
          .select('repository_id')
          .in('repository_id', repoIds)
          .eq('state', 'open');

        // Count issues per repository
        const issueCountMap = new Map<string, number>();
        if (openIssueData) {
          openIssueData.forEach((issue) => {
            const count = issueCountMap.get(issue.repository_id) || 0;
            issueCountMap.set(issue.repository_id, count + 1);
          });
        }

        // Update repositories with their PR and issue counts
        transformedRepos.forEach((repo) => {
          repo.open_prs = prCountMap.get(repo.id) || 0;
          repo.open_issues = issueCountMap.get(repo.id) || 0;
        });
      }

      // Fetch contributor count from pull_requests table (repository_contributors table doesn't exist)
      if (transformedRepos.length > 0) {
        const repoIds = transformedRepos.map((r) => r.id);

        // Get unique contributors from pull requests
        const { data: prContributorData, error: prContributorError } = await supabase
          .from('pull_requests')
          .select('author_id')
          .in('repository_id', repoIds)
          .not('author_id', 'is', null);

        if (prContributorError) {
          console.error('Error fetching PR contributors:', prContributorError);
        } else if (prContributorData && prContributorData.length > 0) {
          // Get unique contributor IDs
          const contributorIds = [...new Set(prContributorData.map((pr) => pr.author_id))];
          uniqueContributorCount = Math.max(uniqueContributorCount, contributorIds.length);
        }
      }

      setWorkspace(workspaceData);
      setRepositories(transformedRepos);

      // Also ensure the workspace context is synced with the fetched data
      if (workspaceData) {
        syncWithUrl(workspaceData.slug || workspaceData.id);
      }

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

      // Filter data for previous period
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

      // Calculate previous period metrics
      const previousMetrics = {
        starCount: transformedRepos.reduce((sum, repo) => sum + (repo.stars || 0), 0), // Stars don't change much, use current
        prCount: previousPRs.length,
        issueCount: previousIssues.length,
        contributorCount: uniqueContributorCount, // Contributors are cumulative, trend will be 0
        commitCount: previousPRs.reduce((sum, pr) => sum + (pr.commits || 0), 0),
      };

      // Generate metrics with real counts including commits and issues
      const realMetrics = calculateWorkspaceMetrics(
        transformedRepos,
        totalPRCount,
        uniqueContributorCount,
        totalCommitCount,
        totalIssueCount,
        previousMetrics
      );

      // Generate trend data with real PR/issue data
      const realTrendData = calculateTrendData(
        TIME_RANGE_DAYS[timeRange],
        prDataForTrends,
        issueDataForTrends
      );

      // Generate activity data from PRs
      const activityDataPoints = generateActivityData(mergedPRs, timeRange);

      setMetrics(realMetrics);
      setTrendData(realTrendData);
      setActivityData(activityDataPoints);
    } catch (err) {
      setError('Failed to load workspace');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, timeRange, selectedRepositories, syncWithUrl]);

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

  if (error || !workspace || !metrics || !trendData) {
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
        console.error('Auth error:', signInError);
      }
      return;
    }
    setAddRepositoryModalOpen(true);
  };

  const handleAddRepositorySuccess = async () => {
    // Refresh the repositories list after adding
    if (!workspace) return;

    try {
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
      console.error('Error refreshing repositories:', error);
      toast.error('Failed to refresh repositories');
    }
  };

  const handleRemoveRepository = async (repo: Repository) => {
    if (!workspace || !currentUser) return;

    try {
      const result = await WorkspaceService.removeRepositoryFromWorkspace(
        workspace.id,
        currentUser.id,
        repo.id
      );

      if (result.success) {
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
      console.error('Error removing repository:', error);
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
        const { findSimilarItems, generateResponseMessage } = await import(
          '@/services/similarity-search'
        );

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
      console.error('Error finding similar items:', error);
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
        const { findSimilarItems, generateResponseMessage } = await import(
          '@/services/similarity-search'
        );

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
      console.error('Error finding similar items:', error);
      setSimilarItems([]);
      setResponseMessage(
        'Similarity search is not available yet. Embeddings need to be generated for this workspace.'
      );
    } finally {
      setLoadingSimilarItems(false);
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
                // The useMyWork hook will automatically refresh when this is called
              },
            }}
          />

          <TabsContent value="overview" className="mt-6 space-y-4">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceDashboard
                workspaceId={workspace.id}
                workspaceName=""
                metrics={metrics}
                trendData={trendData}
                activityData={activityData}
                repositories={repositories}
                myWorkItems={myWorkItems}
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
                  setResponseModalOpen(true);
                  setLoadingSimilarItems(true);

                  try {
                    // Check cache first
                    const cacheKey = similarityCache.getCacheKey(workspace.id, item.id, item.type);
                    const cachedItems = similarityCache.get(workspace.id, item.id, item.type);

                    if (cachedItems) {
                      // Use cached results
                      setSimilarItems(cachedItems);
                      const { generateResponseMessage } = await import(
                        '@/services/similarity-search'
                      );
                      const message = generateResponseMessage(cachedItems);
                      setResponseMessage(message);
                      setLoadingSimilarItems(false);
                      return;
                    }

                    // Perform debounced search if not cached
                    const searchResult = await debouncedSearch(cacheKey, async () => {
                      // Dynamically import similarity search to avoid loading ML models on page init
                      const { findSimilarItems, generateResponseMessage } = await import(
                        '@/services/similarity-search'
                      );

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
                    console.error('Error finding similar items:', error);
                    setSimilarItems([]);
                    setResponseMessage(
                      'Similarity search is not available yet. Embeddings need to be generated for this workspace.'
                    );
                  } finally {
                    setLoadingSimilarItems(false);
                  }
                }}
                repoStatuses={appStatus.repoStatuses}
              />
            </div>
          </TabsContent>

          <TabsContent value="prs" className="mt-6">
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
          </TabsContent>

          <TabsContent value="issues" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceIssuesTab
                repositories={repositories}
                selectedRepositories={selectedRepositories}
                timeRange={timeRange}
                onGitHubAppModalOpen={handleGitHubAppModalOpen}
                currentUser={currentUser}
                currentMember={currentMember}
                onIssueRespond={handleIssueRespond}
              />
            </div>
          </TabsContent>

          <TabsContent value="discussions" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceDiscussionsTable
                repositories={repositories.map((r) => ({
                  id: r.id,
                  name: r.name,
                  owner: r.owner,
                  full_name: r.full_name,
                }))}
                selectedRepositories={selectedRepositories}
                timeRange={timeRange}
                userRole={currentMember?.role}
                isLoggedIn={!!currentUser}
                onRespondClick={handleDiscussionRespond}
              />
            </div>
          </TabsContent>

          <TabsContent value="contributors" className="mt-6">
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
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="container max-w-7xl mx-auto">
              <WorkspaceSettingsComponent
                workspace={workspace}
                currentMember={
                  currentMember || {
                    id: '',
                    workspace_id: workspace.id,
                    user_id: currentUser?.id || '',
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
