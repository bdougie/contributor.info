import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Users } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { Issue } from '../WorkspaceIssuesTable';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';
import type { ContributorStats, RecentIssue } from '@/lib/types';

interface AssigneeData {
  login: string;
  avatar_url: string;
  count: number;
  percentage: number;
  repositories: Set<{ owner: string; name: string }>;
  isBot?: boolean;
}

interface AssigneeDistributionChartProps {
  issues: Issue[];
  onAssigneeClick?: (assignee: string) => void;
  className?: string;
  maxVisible?: number;
  showPercentage?: boolean;
  title?: string;
}

export function AssigneeDistributionChart({
  issues,
  onAssigneeClick,
  className,
  maxVisible = 10,
  showPercentage: initialShowPercentage = false,
  title = 'Issue Assignee Distribution',
}: AssigneeDistributionChartProps) {
  const [excludeBots, setExcludeBots] = useState(true);
  const [showPercentage, setShowPercentage] = useState(initialShowPercentage);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate assignee distribution
  const assigneeData = useMemo(() => {
    const assigneeMap = new Map<string, AssigneeData>();

    // Track unassigned count
    let unassignedCount = 0;

    // Filter to only open issues
    const openIssues = issues.filter((issue) => issue.state === 'open');

    openIssues.forEach((issue) => {
      if (!issue.assignees || issue.assignees.length === 0) {
        unassignedCount++;
        return;
      }

      issue.assignees.forEach((assignee) => {
        const isBotUser = isBot({ username: assignee.login });

        // Skip bots if excluded
        if (excludeBots && isBotUser) {
          return;
        }

        const existing = assigneeMap.get(assignee.login);
        if (existing) {
          existing.count++;
          // Add repository to the set
          if (issue.repository) {
            existing.repositories.add({
              owner: issue.repository.owner,
              name: issue.repository.name,
            });
          }
        } else {
          const repositories = new Set<{ owner: string; name: string }>();
          if (issue.repository) {
            repositories.add({
              owner: issue.repository.owner,
              name: issue.repository.name,
            });
          }
          assigneeMap.set(assignee.login, {
            login: assignee.login,
            avatar_url: assignee.avatar_url,
            count: 1,
            percentage: 0,
            repositories,
            isBot: isBotUser,
          });
        }
      });
    });

    // Add unassigned as a special entry if there are any
    if (unassignedCount > 0 && !excludeBots) {
      assigneeMap.set('__unassigned__', {
        login: 'Unassigned',
        avatar_url: '',
        count: unassignedCount,
        percentage: 0,
        repositories: new Set(),
        isBot: false,
      });
    }

    // Convert to array and calculate percentages
    const totalAssignments = Array.from(assigneeMap.values()).reduce((sum, a) => sum + a.count, 0);

    const assigneeArray = Array.from(assigneeMap.values()).map((assignee) => ({
      ...assignee,
      percentage: totalAssignments > 0 ? (assignee.count / totalAssignments) * 100 : 0,
    }));

    // Sort by count descending
    assigneeArray.sort((a, b) => b.count - a.count);

    return assigneeArray;
  }, [issues, excludeBots]);

  const visibleAssignees = isExpanded ? assigneeData : assigneeData.slice(0, maxVisible);
  const hasMore = assigneeData.length > maxVisible;

  // Find max count for bar width calculation
  const maxCount = Math.max(...assigneeData.map((a) => a.count), 1);

  const handleAssigneeClick = (assignee: AssigneeData) => {
    if (assignee.login === 'Unassigned') {
      onAssigneeClick?.('__unassigned__');
    } else {
      onAssigneeClick?.(assignee.login);
    }
  };

  const getGitHubIssuesUrl = (assignee: AssigneeData) => {
    if (assignee.login === 'Unassigned' || assignee.repositories.size === 0) {
      return null;
    }

    // If there's only one repository, link directly to it
    const reposArray = Array.from(assignee.repositories);
    if (reposArray.length === 1) {
      const repo = reposArray[0];
      return `https://github.com/${repo.owner}/${repo.name}/issues?q=assignee%3A${assignee.login}`;
    }

    // For multiple repositories, link to the user's assigned issues across GitHub
    return `https://github.com/issues?q=assignee%3A${assignee.login}`;
  };

  if (assigneeData.length === 0) {
    return null;
  }

  return (
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
            const githubUrl = getGitHubIssuesUrl(assignee);

            // Render avatar based on assignee type
            const renderAvatar = () => {
              if (assignee.login === 'Unassigned') {
                return (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                );
              }

              // Determine avatar className based on whether it's clickable
              const avatarClassName = githubUrl
                ? 'h-8 w-8 rounded-full hover:ring-2 hover:ring-primary transition-all'
                : 'h-8 w-8 rounded-full';

              // Get issues assigned to this user
              const assignedIssues: RecentIssue[] = issues
                .filter((issue) => issue.assignees?.some((a) => a.login === assignee.login))
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
                pullRequests: 0,
                percentage: 0,
                recentIssues: assignedIssues,
              };

              const avatarImg = (
                <img src={assignee.avatar_url} alt={assignee.login} className={avatarClassName} />
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
                <ContributorHoverCard contributor={contributorStats}>
                  {avatarContent}
                </ContributorHoverCard>
              );
            };

            return (
              <div
                key={assignee.login}
                className="group flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleAssigneeClick(assignee)}
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
                    {assignee.isBot && (
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
                          width: `${(assignee.count / maxCount) * 100}%`,
                        }}
                      />
                    </div>
                    {/* Count/Percentage overlay */}
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          // Use contrasting color when bar is more than 80% width
                          assignee.count / maxCount > 0.8
                            ? 'text-white dark:text-black'
                            : 'text-foreground'
                        )}
                      >
                        {showPercentage ? `${assignee.percentage.toFixed(1)}%` : assignee.count}
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
          <span>Total assigned issues: {assigneeData.reduce((sum, a) => sum + a.count, 0)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
