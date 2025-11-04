import { useMemo } from 'react';
import { AlertCircle, Activity } from '@/components/ui/icon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkspaceAutoSync } from '@/components/features/workspace/WorkspaceAutoSync';
import { TrendChart } from '@/components/features/workspace/TrendChart';
import { ActivityTable } from '@/components/features/workspace/ActivityTable';
import { WorkspaceActivitySkeleton } from '@/components/features/workspace/skeletons/WorkspaceActivitySkeleton';
import type { Repository } from '@/components/features/workspace';
import type { Workspace } from '@/types/workspace';

// Activity item type used for the activity feed
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

export interface WorkspaceActivityTabProps {
  workspace?: Workspace | null;
  prData: Array<{
    id: string;
    title: string;
    number: number;
    state: string;
    created_at: string;
    merged_at: string | null;
    author_id: string;
    author_login?: string;
    repository_id: string;
    repository_name?: string;
    html_url?: string;
    additions?: number;
    deletions?: number;
    commits?: number;
  }>;
  issueData: Array<{
    id: string;
    title: string;
    number: number;
    state: string;
    created_at: string;
    closed_at: string | null;
    author_id: string;
    author_login?: string;
    repository_id: string;
    repository_name?: string;
    html_url?: string;
  }>;
  reviewData: Array<{
    id: string;
    pull_request_id: string;
    reviewer_id: string;
    reviewer_login?: string;
    state: string;
    body?: string;
    submitted_at: string;
    pr_title?: string;
    pr_number?: number;
    repository_id?: string;
    repository_name?: string;
  }>;
  commentData: Array<{
    id: string;
    pull_request_id: string;
    commenter_id: string;
    commenter_login?: string;
    body: string;
    created_at: string;
    comment_type: string;
    pr_title?: string;
    pr_number?: number;
    repository_id?: string;
    repository_name?: string;
  }>;
  starData: Array<{
    id: string;
    event_type: 'star';
    actor_login: string;
    actor_avatar?: string;
    repository_name?: string;
    captured_at: string;
  }>;
  forkData: Array<{
    id: string;
    event_type: 'fork';
    actor_login: string;
    actor_avatar?: string;
    repository_name?: string;
    captured_at: string;
  }>;
  repositories: Repository[];
  loading?: boolean;
  error?: string | null;
  onSyncComplete?: () => void;
}

export function WorkspaceActivityTab({
  workspace = null,
  prData = [],
  issueData = [],
  reviewData = [],
  commentData = [],
  starData = [],
  forkData = [],
  repositories = [],
  loading = false,
  error = null,
  onSyncComplete,
}: WorkspaceActivityTabProps) {
  // Memoize the repository lookup map for better performance
  const repositoryMap = useMemo(() => {
    const map = new Map<string, Repository>();
    repositories.forEach((repo) => {
      if (repo?.id) {
        map.set(repo.id, repo);
      }
    });
    return map;
  }, [repositories]);

  // Memoize activities transformation for performance
  const activities: ActivityItem[] = useMemo(() => {
    // Helper function defined inside useMemo to avoid dependency issues
    const getRepoName = (repoId: string | undefined): string => {
      if (!repoId) return 'Unknown Repository';
      const repo = repositoryMap.get(repoId);
      return repo?.full_name || 'Unknown Repository';
    };
    try {
      // Validate input data
      const validPRData = Array.isArray(prData) ? prData : [];
      const validIssueData = Array.isArray(issueData) ? issueData : [];
      const validReviewData = Array.isArray(reviewData) ? reviewData : [];
      const validCommentData = Array.isArray(commentData) ? commentData : [];
      const validStarData = Array.isArray(starData) ? starData : [];
      const validForkData = Array.isArray(forkData) ? forkData : [];

      return [
        // Convert PRs to activities with better error handling
        ...validPRData.map((pr, index): ActivityItem => {
          return {
            id: `pr-${pr.id}-${index}`, // Add index to ensure uniqueness
            type: 'pr',
            title: pr.title || `PR #${pr.number}`,
            created_at: pr.created_at,
            author: {
              username: pr.author_login || 'Unknown',
              avatar_url: '', // Should come from contributors table via join
            },
            repository: getRepoName(pr.repository_id),
            status: (() => {
              // Handle all PR states including draft
              if (pr.merged_at) return 'merged';
              if (pr.state === 'open') return 'open';
              if (pr.state === 'draft') return 'open'; // Treat draft as open with different styling later
              return 'closed';
            })() as ActivityItem['status'],
            url: pr.html_url || '#',
            metadata: {
              additions: pr.additions || 0,
              deletions: pr.deletions || 0,
            },
          };
        }),
        // Convert issues to activities with validation
        ...validIssueData.map((issue, index): ActivityItem => {
          return {
            id: `issue-${issue.id}-${index}`, // Add index to ensure uniqueness
            type: 'issue',
            title: issue.title || `Issue #${issue.number}`,
            created_at: issue.created_at,
            author: {
              username: issue.author_login || 'Unknown',
              avatar_url: '', // Should come from contributors table via join
            },
            repository: getRepoName(issue.repository_id),
            status: issue.closed_at ? 'closed' : 'open',
            url: issue.html_url || '',
            metadata: {},
          };
        }),
        // Convert reviews to activities with validation
        ...validReviewData.map((review, index): ActivityItem => {
          // Construct URL from repository name and PR number if available
          let reviewUrl = '';
          if (review.repository_name && review.pr_number) {
            reviewUrl = `https://github.com/${review.repository_name}/pull/${review.pr_number}`;
          }
          return {
            id: `review-${review.id}-${index}`, // Add index to ensure uniqueness
            type: 'review',
            title: review.pr_title ? `Review on: ${review.pr_title}` : `Review on PR`,
            created_at: review.submitted_at,
            author: {
              username: review.reviewer_login || 'Unknown',
              avatar_url: '', // Should come from contributors table via join
            },
            repository: review.repository_name || 'Unknown Repository',
            status: review.state.toLowerCase() as ActivityItem['status'],
            url: reviewUrl,
            metadata: {},
          };
        }),
        // Convert comments to activities with validation
        ...validCommentData.map((comment, index): ActivityItem => {
          // Construct URL from repository name and PR number if available
          let commentUrl = '';
          if (comment.repository_name && comment.pr_number) {
            commentUrl = `https://github.com/${comment.repository_name}/pull/${comment.pr_number}`;
          }
          return {
            id: `comment-${comment.id}-${index}`, // Add index to ensure uniqueness
            type: 'comment',
            title: comment.pr_title ? `Comment on: ${comment.pr_title}` : `Comment on PR`,
            created_at: comment.created_at,
            author: {
              username: comment.commenter_login || 'Unknown',
              avatar_url: '', // Should come from contributors table via join
            },
            repository: comment.repository_name || 'Unknown Repository',
            status: 'open',
            url: commentUrl,
            metadata: {},
          };
        }),
        // Convert star events to activities - now individual events
        ...validStarData.map((star, index): ActivityItem => {
          // Link to the user's GitHub profile instead of the repository
          let starUrl = '';
          if (star.actor_login) {
            starUrl = `https://github.com/${star.actor_login}`;
          }
          return {
            id: star.id || `star-${index}`,
            type: 'star',
            title: `starred the repository`,
            created_at: star.captured_at,
            author: {
              username: star.actor_login || 'Unknown',
              avatar_url: star.actor_avatar || `https://github.com/${star.actor_login}.png`,
            },
            repository: star.repository_name || 'Unknown Repository',
            // No status for star events
            url: starUrl,
            metadata: {},
          };
        }),
        // Convert fork events to activities - now individual events
        ...validForkData.map((fork, index): ActivityItem => {
          // Link to the user's forked repository
          let forkUrl = '';
          if (fork.actor_login && fork.repository_name) {
            // Extract just the repo name from owner/repo format
            const repoName = fork.repository_name.split('/')[1];
            if (repoName) {
              forkUrl = `https://github.com/${fork.actor_login}/${repoName}`;
            }
          }
          return {
            id: fork.id || `fork-${index}`,
            type: 'fork',
            title: `forked the repository`,
            created_at: fork.captured_at,
            author: {
              username: fork.actor_login || 'Unknown',
              avatar_url: fork.actor_avatar || `https://github.com/${fork.actor_login}.png`,
            },
            repository: fork.repository_name || 'Unknown Repository',
            // No status for fork events
            url: forkUrl,
            metadata: {},
          };
        }),
      ];
    } catch (error) {
      console.error('Error transforming activity data:', error);
      return [];
    }
  }, [prData, issueData, reviewData, commentData, starData, forkData, repositoryMap]);

  // Memoize sorted activities to avoid unnecessary re-sorts
  const sortedActivities = useMemo(() => {
    return [...activities].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [activities]);

  // Memoize trend data calculation for performance
  const activityByDay = useMemo(() => {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map((date) => {
      const dayActivities = sortedActivities.filter((a) => a.created_at.split('T')[0] === date);
      return {
        date,
        total: dayActivities.length,
        prs: dayActivities.filter((a) => a.type === 'pr').length,
        issues: dayActivities.filter((a) => a.type === 'issue').length,
        reviews: dayActivities.filter((a) => a.type === 'review').length,
        comments: dayActivities.filter((a) => a.type === 'comment').length,
        stars: dayActivities.filter((a) => a.type === 'star').length,
        forks: dayActivities.filter((a) => a.type === 'fork').length,
      };
    });
  }, [sortedActivities]);

  // Memoize stats calculations for performance
  const { totalActivities, uniqueContributors, activeRepos, activityScore } = useMemo(() => {
    const total = activities.length;
    const contributors = new Set(activities.map((a) => a.author.username)).size;
    const repos = new Set(activities.map((a) => a.repository)).size;
    const score = Math.round((total + contributors * 2 + repos * 3) / 3);

    return {
      totalActivities: total,
      uniqueContributors: contributors,
      activeRepos: repos,
      activityScore: score,
    };
  }, [activities]);

  // Show loading skeleton while data is being fetched
  if (loading) {
    return <WorkspaceActivitySkeleton />;
  }

  // Show error state if there's an error
  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-semibold">Failed to load activity data</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state if no activities
  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="font-semibold">No activity yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Activity will appear here once repositories have pull requests, issues, or other
              interactions.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Auto-sync indicator at top of tab */}
      {workspace && (
        <div className="flex items-center justify-between px-1">
          <WorkspaceAutoSync
            workspaceId={workspace.id}
            workspaceSlug={workspace.slug}
            repositoryIds={repositories.map((r) => r.id).filter(Boolean)}
            onSyncComplete={onSyncComplete}
            syncIntervalMinutes={60}
            className="text-sm text-muted-foreground"
          />
        </div>
      )}

      {/* Activity Trend Chart */}
      <TrendChart
        title="Activity Trend"
        description="Daily activity across all workspace repositories"
        data={{
          labels: activityByDay.map((d) => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }),
          datasets: [
            {
              label: 'Pull Requests',
              data: activityByDay.map((d) => d.prs),
              color: '#10b981',
            },
            {
              label: 'Issues',
              data: activityByDay.map((d) => d.issues),
              color: '#f97316',
            },
            {
              label: 'Reviews',
              data: activityByDay.map((d) => d.reviews),
              color: '#8b5cf6',
            },
            {
              label: 'Comments',
              data: activityByDay.map((d) => d.comments),
              color: '#06b6d4',
            },
            {
              label: 'Stars',
              data: activityByDay.map((d) => d.stars),
              color: '#fbbf24',
            },
            {
              label: 'Forks',
              data: activityByDay.map((d) => d.forks),
              color: '#ffffff',
            },
          ],
        }}
        height={350}
        showLegend={true}
        showGrid={true}
      />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActivities}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Actors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueContributors}</div>
            <p className="text-xs text-muted-foreground">Unique actors</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeRepos}</div>
            <p className="text-xs text-muted-foreground">With activity</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Activity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activityScore}</div>
            <p className="text-xs text-muted-foreground">Composite metric</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed Table */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Activity Feed</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Real-time feed of all activities across your workspace repositories
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="text-center py-8 text-red-500">
              <p>Error loading activity data: {error}</p>
              <p className="text-sm text-muted-foreground mt-2">Please try refreshing the page.</p>
            </div>
          ) : (
            <ActivityTable activities={sortedActivities} loading={loading} pageSize={20} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
