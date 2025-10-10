import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Sparkles } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { WorkspaceAutoSync } from '@/components/features/workspace/WorkspaceAutoSync';
import { WorkspaceMetricsAndTrends } from '@/components/features/workspace/WorkspaceMetricsAndTrends';
import {
  WorkspacePullRequestsTable,
  type PullRequest,
} from '@/components/features/workspace/WorkspacePullRequestsTable';
import { LazyReviewerDistributionChart } from '@/components/features/workspace/charts/ReviewerDistributionChart-lazy';
import { PRAuthorStatusChart as LazyPRAuthorStatusChart } from '@/components/features/workspace/charts/PRAuthorStatusChart-lazy';
import { useWorkspacePRs } from '@/hooks/useWorkspacePRs';
import type { TimeRange } from '@/components/features/workspace/TimeRangeSelector';
import type { Repository } from '@/components/features/workspace';
import type { Workspace, WorkspaceMemberWithUser } from '@/types/workspace';

interface WorkspacePRsTabProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: TimeRange;
  workspaceId: string;
  workspace?: Workspace;
  setReviewerModalOpen: (open: boolean) => void;
  onGitHubAppModalOpen: (repo: Repository) => void;
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
}

export function WorkspacePRsTab({
  repositories,
  selectedRepositories,
  timeRange,
  workspaceId,
  workspace,
  setReviewerModalOpen,
  onGitHubAppModalOpen,
  currentUser,
  currentMember,
}: WorkspacePRsTabProps) {
  const navigate = useNavigate();

  // Use the new hook for automatic PR syncing and caching
  const { pullRequests, loading, error, lastSynced, isStale, refresh } = useWorkspacePRs({
    repositories,
    selectedRepositories,
    workspaceId,
    refreshInterval: 60, // Hourly refresh interval
    maxStaleMinutes: 60, // Consider data stale after 60 minutes
    autoSyncOnMount: true, // Auto-sync enabled with hourly refresh
  });

  // Log sync status for debugging
  useEffect(() => {
    if (lastSynced) {
      const minutesAgo = ((Date.now() - lastSynced.getTime()) / (1000 * 60)).toFixed(1);
      console.log(
        'PR data last synced %s minutes ago%s',
        minutesAgo,
        isStale ? ' (stale)' : ' (fresh)'
      );
    }
  }, [lastSynced, isStale]);

  // Show error toast if sync fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to fetch pull requests', {
        description: error,
        action: {
          label: 'Retry',
          onClick: () => refresh(),
        },
      });
    }
  }, [error, refresh]);

  const handlePullRequestClick = (pr: PullRequest) => {
    window.open(pr.url, '_blank');
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  const [selectedReviewer, setSelectedReviewer] = useState<string | null>(null);

  const handleReviewerClick = (reviewer: string) => {
    setSelectedReviewer(selectedReviewer === reviewer ? null : reviewer);
  };

  // Filter PRs by selected reviewer
  const filteredPullRequests = useMemo(() => {
    if (!selectedReviewer) return pullRequests;

    if (selectedReviewer === '__unreviewed__') {
      return pullRequests.filter((pr) => !pr.reviewers || pr.reviewers.length === 0);
    }

    return pullRequests.filter((pr) => pr.reviewers?.some((r) => r.username === selectedReviewer));
  }, [pullRequests, selectedReviewer]);

  // Check if there are any PRs with reviewers
  const hasReviewers = pullRequests.some((pr) => pr.reviewers && pr.reviewers.length > 0);

  const ctaRepo = repositories[0]; // Use first repo for modal context

  return (
    <div className="space-y-6">
      {/* Auto-sync indicator at top of tab */}
      <div className="flex items-center justify-between px-1">
        <WorkspaceAutoSync
          workspaceId={workspaceId}
          workspaceSlug={workspace?.slug || 'workspace'}
          repositoryIds={repositories.map((r) => r.id).filter(Boolean)}
          onSyncComplete={refresh}
          syncIntervalMinutes={60}
          className="text-sm text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <Button onClick={() => setReviewerModalOpen(true)} size="sm" variant="outline">
            CODEOWNERS
          </Button>
          {ctaRepo && (
            <Button
              onClick={() => onGitHubAppModalOpen(ctaRepo)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Similarity
            </Button>
          )}
        </div>
      </div>

      {/* Metrics and Trends - first, always full width */}
      <WorkspaceMetricsAndTrends
        repositories={repositories}
        selectedRepositories={selectedRepositories}
        timeRange={timeRange}
        userRole={currentMember?.role}
        isLoggedIn={!!currentUser}
      />

      {/* Review Charts - PR Status and Distribution side by side */}
      {hasReviewers && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* PR Author Status Chart - shows PRs grouped by author and their status */}
          <LazyPRAuthorStatusChart
            pullRequests={pullRequests}
            onAuthorClick={handleReviewerClick}
            title="Pull Request Author Status"
            maxVisible={8}
          />

          {/* Reviewer Distribution Chart */}
          <LazyReviewerDistributionChart
            pullRequests={pullRequests}
            onReviewerClick={handleReviewerClick}
            maxVisible={8}
          />
        </div>
      )}

      {/* PR Table */}
      <WorkspacePullRequestsTable
        pullRequests={filteredPullRequests}
        loading={loading}
        onPullRequestClick={handlePullRequestClick}
        onRepositoryClick={handleRepositoryClick}
      />
    </div>
  );
}
