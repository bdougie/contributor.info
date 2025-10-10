import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { getFallbackAvatar } from '@/lib/utils/avatar';
import { Sparkles } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkspaceIssueMetricsAndTrends } from '@/components/features/workspace/WorkspaceIssueMetricsAndTrends';
import {
  WorkspaceIssuesTable,
  type Issue,
} from '@/components/features/workspace/WorkspaceIssuesTable';
import { LazyAssigneeDistributionChart } from '@/components/features/workspace/charts/AssigneeDistributionChart-lazy';
import type { TimeRange } from '@/components/features/workspace/TimeRangeSelector';
import type { Repository } from '@/components/features/workspace';
import type { WorkspaceMemberWithUser } from '@/types/workspace';

// Type definitions for Issue labels
interface IssueLabel {
  name: string;
  color: string;
  id?: number;
}

/**
 * Utility function to filter repositories based on selection
 * @param repos - All available repositories
 * @param selectedRepoIds - Array of selected repository IDs (empty array means show all)
 * @returns Filtered array of repositories
 */
const filterRepositoriesBySelection = <T extends { id: string }>(
  repos: T[],
  selectedRepoIds?: string[]
): T[] => {
  // If no selection provided or empty selection, return all repositories
  if (!selectedRepoIds || selectedRepoIds.length === 0) {
    return repos;
  }
  // Filter repositories by selected IDs
  return repos.filter((repo) => selectedRepoIds.includes(repo.id));
};

interface WorkspaceIssuesTabProps {
  repositories: Repository[];
  selectedRepositories: string[];
  timeRange: TimeRange;
  onGitHubAppModalOpen: (repo: Repository) => void;
  currentUser: User | null;
  currentMember: WorkspaceMemberWithUser | null;
  onIssueRespond?: (issue: Issue) => void;
}

export function WorkspaceIssuesTab({
  repositories,
  selectedRepositories,
  timeRange,
  onGitHubAppModalOpen,
  currentUser,
  currentMember,
  onIssueRespond,
}: WorkspaceIssuesTabProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchIssues() {
      if (repositories.length === 0) {
        setIssues([]);
        setLoading(false);
        return;
      }

      try {
        // Use utility function to filter repositories
        const filteredRepos = filterRepositoriesBySelection(repositories, selectedRepositories);

        const repoIds = filteredRepos.map((r) => r.id);

        // Fetch issues with pagination support
        // Note: Using .limit() instead of .range() to avoid HTTP 206 partial responses
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
          .limit(100); // Using limit instead of range to get full 200 response

        if (error) {
          console.error('Failed to fetch workspace issues:', {
            message: error.message,
            code: error.code,
            details: error.details,
          });
          // Improved error handling with user-friendly message
          setError('Failed to load issues. Please try again later.');
          setIssues([]);
        } else {
          // Clear error state on successful fetch
          setError(null);
          // Transform data to match Issue interface
          interface IssueQueryResult {
            id: string;
            github_id: number;
            number: number;
            title: string;
            body: string | null;
            state: string;
            created_at: string;
            updated_at: string;
            closed_at: string | null;
            labels: IssueLabel[] | null;
            assignees: Array<{
              login?: string;
              username?: string;
              avatar_url?: string;
            }> | null;
            comments_count: number | null;
            repository_id: string;
            repositories?: {
              id: string;
              name: string;
              owner: string;
              full_name: string;
              avatar_url: string | null;
            };
            contributors?: {
              username: string;
              avatar_url: string;
            };
          }

          const transformedIssues: Issue[] = ((data || []) as unknown as IssueQueryResult[]).map(
            (issue) => ({
              id: issue.id,
              number: issue.number,
              title: issue.title,
              state: issue.state as 'open' | 'closed',
              repository: {
                name: issue.repositories?.name || 'unknown',
                owner: issue.repositories?.owner || 'unknown',
                avatar_url:
                  issue.repositories?.avatar_url ||
                  (issue.repositories?.owner
                    ? `https://avatars.githubusercontent.com/${issue.repositories.owner}`
                    : getFallbackAvatar()),
              },
              author: {
                username: issue.contributors?.username || 'unknown',
                avatar_url: issue.contributors?.avatar_url || '',
              },
              created_at: issue.created_at,
              updated_at: issue.updated_at,
              closed_at: issue.closed_at || undefined,
              comments_count: issue.comments_count || 0,
              labels: Array.isArray(issue.labels)
                ? (issue.labels as IssueLabel[])
                    .map((label) => ({
                      name: label.name,
                      color: label.color || '000000',
                    }))
                    .filter((l) => l.name) // Filter out labels without names
                : [],
              assignees: Array.isArray(issue.assignees)
                ? issue.assignees.map((assignee) => ({
                    login: assignee.login || assignee.username || 'unknown',
                    avatar_url: assignee.avatar_url || '',
                  }))
                : [],
              // Improved URL construction with validation
              url:
                issue.repositories?.full_name && issue.number
                  ? `https://github.com/${issue.repositories.full_name}/issues/${issue.number}`
                  : '', // Empty string when repository data is missing to prevent broken links
            })
          );
          setIssues(transformedIssues);
        }
      } catch (err) {
        console.error('Error:', err);
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }

    fetchIssues();
  }, [repositories, selectedRepositories]);

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
      {/* Action buttons at top */}
      {ctaRepo && (
        <div className="flex items-center justify-end px-1">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => onGitHubAppModalOpen(ctaRepo)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              Similarity
            </Button>
          </div>
        </div>
      )}

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
