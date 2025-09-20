import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp, Users, TrendingUp, TrendingDown } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { Issue } from '../WorkspaceIssuesTable';

interface AssigneeData {
  login: string;
  avatar_url: string;
  count: number;
  percentage: number;
  previousCount?: number;
  change?: number;
  changePercentage?: number;
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

    issues.forEach((issue) => {
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
        } else {
          assigneeMap.set(assignee.login, {
            login: assignee.login,
            avatar_url: assignee.avatar_url,
            count: 1,
            percentage: 0,
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
        isBot: false,
      });
    }

    // Convert to array and calculate percentages
    const totalAssignments = Array.from(assigneeMap.values()).reduce((sum, a) => sum + a.count, 0);

    const assigneeArray = Array.from(assigneeMap.values()).map((assignee) => ({
      ...assignee,
      percentage: totalAssignments > 0 ? (assignee.count / totalAssignments) * 100 : 0,
      // Mock previous data for demo purposes - in production this would come from historical data
      previousCount: Math.max(1, assignee.count - Math.floor(Math.random() * 3) + 1),
    }));

    // Calculate change
    assigneeArray.forEach((assignee) => {
      if (assignee.previousCount !== undefined) {
        assignee.change = assignee.count - assignee.previousCount;
        assignee.changePercentage =
          assignee.previousCount > 0 ? (assignee.change / assignee.previousCount) * 100 : 100;
      }
    });

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
          {visibleAssignees.map((assignee) => (
            <div
              key={assignee.login}
              className="group flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
              onClick={() => handleAssigneeClick(assignee)}
            >
              {/* Avatar */}
              {assignee.login === 'Unassigned' ? (
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <img
                  src={assignee.avatar_url}
                  alt={assignee.login}
                  className="h-8 w-8 rounded-full"
                />
              )}

              {/* Username and bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{assignee.login}</span>
                  {assignee.isBot && (
                    <Badge variant="secondary" className="text-xs">
                      Bot
                    </Badge>
                  )}
                  {assignee.change !== undefined && assignee.change !== 0 && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'flex items-center gap-0.5 text-xs',
                              assignee.change > 0 ? 'text-green-600' : 'text-red-600'
                            )}
                          >
                            {assignee.change > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span>{Math.abs(assignee.changePercentage || 0).toFixed(0)}%</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {assignee.change > 0 ? '+' : ''}
                            {assignee.change} from previous period
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
          ))}

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
