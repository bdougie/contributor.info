import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Sparkles } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkspaceAutoSync } from '@/components/features/workspace/WorkspaceAutoSync';
import { WorkspaceIssueMetricsAndTrends } from '@/components/features/workspace/WorkspaceIssueMetricsAndTrends';
import {
  WorkspaceIssuesTable,
  type Issue,
} from '@/components/features/workspace/WorkspaceIssuesTable';
import { LazyAssigneeDistributionChart } from '@/components/features/workspace/charts/AssigneeDistributionChart-lazy';
import { useWorkspaceIssues } from '@/hooks/useWorkspaceIssues';
import type { TimeRange } from '@/components/features/workspace/TimeRangeSelector';
import type { Repository } from '@/components/features/workspace';
import type { WorkspaceMemberWithUser, Workspace } from '@/types/workspace';

interface WorkspaceIssuesTabProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: TimeRange;
  workspaceId: string;
  workspace?: Workspace;
  onGitHubAppModalOpen: (repo: Repository) => void;
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
  onIssueRespond?: (issue: Issue) => void;
}

export function WorkspaceIssuesTab({
  repositories,
  selectedRepositories,
  timeRange,
  workspaceId,
  workspace,
  onGitHubAppModalOpen,
  currentUser,
  currentMember,
  onIssueRespond,
}: WorkspaceIssuesTabProps) {
  const navigate = useNavigate();

  // Use the new hook for automatic issue syncing and caching
  const { issues, loading, error, lastSynced, isStale, refresh } = useWorkspaceIssues({
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
        `Issue data last synced ${minutesAgo} minutes ago${isStale ? ' (stale)' : ' (fresh)'}`
      );
    }
  }, [lastSynced, isStale]);

  // Show error toast if sync fails
  useEffect(() => {
    if (error) {
      toast.error('Failed to fetch issues', {
        description: error,
        action: {
          label: 'Retry',
          onClick: () => refresh(),
        },
      });
    }
  }, [error, refresh]);

  // Handle page visibility changes - auto-sync when returning to tab if data is stale
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && lastSynced) {
        const timeSinceLastSync = (Date.now() - lastSynced.getTime()) / (1000 * 60); // minutes
        // Refresh if more than 5 minutes have passed since last sync
        if (timeSinceLastSync > 5) {
          console.log(
            `[WorkspaceIssuesTab] Refreshing stale issue data: ${timeSinceLastSync.toFixed(1)} minutes since last sync`
          );
          refresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastSynced, refresh]);

  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  const handleIssueClick = (issue: Issue) => {
    // Only open if URL exists
    if (issue.url) {
      window.open(issue.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRepositoryClick = (owner: string, name: string) => {
    navigate(`/${owner}/${name}`);
  };

  const handleAssigneeClick = (assignee: string) => {
    setSelectedAssignee(selectedAssignee === assignee ? null : assignee);
  };

  const handleRespondClick = (issue: Issue) => {
    onIssueRespond?.(issue);
  };

  // Filter issues by selected assignee
  const filteredIssues = useMemo(() => {
    if (!selectedAssignee) return issues;

    if (selectedAssignee === '__unassigned__') {
      return issues.filter((issue) => !issue.assignees || issue.assignees.length === 0);
    }

    return issues.filter((issue) => issue.assignees?.some((a) => a.login === selectedAssignee));
  }, [issues, selectedAssignee]);

  // Check if there are any issues with assignees
  const hasAssignees = issues.some((issue) => issue.assignees && issue.assignees.length > 0);

  // Display error message if there's an error
  if (error) {
    return (
      <div className="container max-w-7xl mx-auto p-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Issues</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const ctaRepo = repositories[0]; // Use first repo for context

  return (
    <div className="space-y-6">
      {/* Auto-sync indicator and action buttons at top */}
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

      {/* Conditionally render side-by-side or full width based on assignee data */}
      {hasAssignees ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Issue Metrics and Trends */}
          <WorkspaceIssueMetricsAndTrends
            repositories={repositories}
            selectedRepositories={selectedRepositories}
            timeRange={timeRange}
            userRole={currentMember?.role}
            isLoggedIn={!!currentUser}
          />

          {/* Assignee Distribution Chart */}
          <LazyAssigneeDistributionChart
            issues={issues}
            onAssigneeClick={handleAssigneeClick}
            maxVisible={8}
          />
        </div>
      ) : (
        /* Full width Metrics and Trends when no assignees */
        <WorkspaceIssueMetricsAndTrends
          repositories={repositories}
          selectedRepositories={selectedRepositories}
          timeRange={timeRange}
          userRole={currentMember?.role}
          isLoggedIn={!!currentUser}
        />
      )}

      {/* Issues Table */}
      <WorkspaceIssuesTable
        issues={filteredIssues}
        loading={loading}
        onIssueClick={handleIssueClick}
        onRepositoryClick={handleRepositoryClick}
        onRespondClick={handleRespondClick}
      />
    </div>
  );
}
