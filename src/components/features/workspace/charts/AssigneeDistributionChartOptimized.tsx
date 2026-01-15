import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Users, Loader2 } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { Issue } from '../WorkspaceIssuesTable';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';
import type { ContributorStats, RecentIssue } from '@/lib/types';
import { useAssigneeDistribution } from '@/hooks/useAssigneeDistribution';
import { ShareableCard } from '@/components/features/sharing/shareable-card';

interface AssigneeDistributionChartOptimizedProps {
  repositoryIds: string[];
  issues: Issue[]; // Still needed for hover card data
  onAssigneeClick?: (assignee: string) => void;
  className?: string;
  maxVisible?: number;
  showPercentage?: boolean;
  title?: string;
  workspaceName?: string;
}

export function AssigneeDistributionChartOptimized({
  repositoryIds,
  issues,
  onAssigneeClick,
  className,
  maxVisible = 5,
  showPercentage: initialShowPercentage = false,
  title = 'Issue Assignee Distribution',
  workspaceName,
}: AssigneeDistributionChartOptimizedProps) {
  const [excludeBots, setExcludeBots] = useState(true);
  const [showPercentage, setShowPercentage] = useState(initialShowPercentage);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use the optimized hook for database-side aggregation
  const {
    data: assigneeData,
    loading,
    error,
  } = useAssigneeDistribution({
    repositoryIds,
    excludeBots,
    limit: 100,
    enabled: repositoryIds.length > 0,
  });

  const visibleAssignees = isExpanded ? assigneeData : assigneeData.slice(0, maxVisible);
  const hasMore = assigneeData.length > maxVisible;

  // Calculate percentages and max count
  const totalAssignments = assigneeData.reduce((sum, a) => sum + a.issue_count, 0);
  const maxCount = Math.max(...assigneeData.map((a) => a.issue_count), 1);

  const handleAssigneeClick = (login: string) => {
    onAssigneeClick?.(login);
  };

  const getGitHubIssuesUrl = (login: string, repoCount: number) => {
    if (repoCount === 0) {
      return null;
    }

    // For single or multiple repos, link to the user's assigned issues
    return `https://github.com/issues?q=assignee%3A${login}`;
  };

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (assigneeData.length === 0) {
    return null;
  }

  return (
    <ShareableCard
      title={title}
      contextInfo={{
        repository: workspaceName || 'Workspace',
        metric: 'assignee-distribution',
      }}
      chartType="assignee-distribution"
    >
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle>{title}</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-percentage"
                  checked={showPercentage}
                  onCheckedChange={setShowPercentage}
                />
                <Label htmlFor="show-percentage" className="text-sm">
                  Show %
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="exclude-bots" checked={excludeBots} onCheckedChange={setExcludeBots} />
                <Label htmlFor="exclude-bots" className="text-sm">
                  Exclude Bots
                </Label>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {visibleAssignees.map((assignee) => {
              const percentage =
                totalAssignments > 0 ? (assignee.issue_count / totalAssignments) * 100 : 0;
              const isBotUser = isBot({ username: assignee.login });
              const githubUrl = getGitHubIssuesUrl(assignee.login, assignee.repository_count);

              // Render avatar based on assignee type
              const renderAvatar = () => {
                // Determine avatar className based on whether it's clickable
                const avatarClassName = githubUrl
                  ? 'h-8 w-8 rounded-full hover:ring-2 hover:ring-primary transition-all'
                  : 'h-8 w-8 rounded-full';

                // Get issues assigned to this user for hover card
                const assignedIssues: RecentIssue[] = issues
                  .filter(
                    (issue) =>
                      issue.state === 'open' &&
                      issue.assignees?.some((a) => a.login === assignee.login)
                  )
                  .slice(0, 5)
                  .map((issue) => ({
                    id: issue.id,
                    number: issue.number,
                    title: issue.title,
                    state: issue.state,
                    created_at: issue.created_at,
                    updated_at: issue.updated_at,
                    closed_at: issue.closed_at,
                    repository_owner: issue.repository.owner,
                    repository_name: issue.repository.name,
                    comments_count: issue.comments_count,
                    html_url: issue.url,
                  }));

                const contributorStats: ContributorStats = {
                  login: assignee.login,
                  avatar_url: assignee.avatar_url,
                  pullRequests: assignee.issue_count,
                  percentage: 0,
                  recentIssues: assignedIssues,
                };

                const avatarImg = (
                  <img
                    src={assignee.avatar_url}
                    alt={`${assignee.login}'s avatar - ${assignee.issue_count} assigned issues`}
                    className={avatarClassName}
                    loading="lazy"
                  />
                );

                const avatarContent = githubUrl ? (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {avatarImg}
                  </a>
                ) : (
                  avatarImg
                );

                return (
                  <ContributorHoverCard
                    contributor={contributorStats}
                    showReviews={false}
                    showComments={false}
                    useIssueIcons={true}
                    primaryLabel="assigned"
                  >
                    {avatarContent}
                  </ContributorHoverCard>
                );
              };

              return (
                <div
                  key={assignee.login}
                  className="group flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => handleAssigneeClick(assignee.login)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAssigneeClick(assignee.login);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Select ${assignee.login}, ${assignee.issue_count} assigned issues`}
                >
                  {/* Avatar */}
                  {renderAvatar()}

                  {/* Username and bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {githubUrl ? (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium truncate hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {assignee.login}
                        </a>
                      ) : (
                        <span className="text-sm font-medium truncate">{assignee.login}</span>
                      )}
                      {isBotUser && (
                        <Badge variant="secondary" className="text-xs">
                          Bot
                        </Badge>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="relative">
                      <div className="h-6 bg-muted rounded-md overflow-hidden">
                        <div
                          className="h-full bg-black dark:bg-white transition-all duration-500 ease-out"
                          style={{
                            width: `${(assignee.issue_count / maxCount) * 100}%`,
                          }}
                        />
                      </div>
                      {/* Count/Percentage overlay */}
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            // Use contrasting color when bar is more than 60% width for better accessibility
                            assignee.issue_count / maxCount > 0.6
                              ? 'text-white dark:text-black'
                              : 'text-foreground'
                          )}
                        >
                          {showPercentage ? `${percentage.toFixed(1)}%` : assignee.issue_count}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Show more/less button */}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show {assigneeData.length - maxVisible} More
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Summary stats */}
          <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <span>Total assignees: {assigneeData.length}</span>
            <span>Total assigned issues: {totalAssignments}</span>
          </div>
        </CardContent>
      </Card>
    </ShareableCard>
  );
}
