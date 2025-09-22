import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown,
  ChevronUp,
  GitPullRequest,
  Clock,
  AlertCircle,
  Users,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { PullRequest } from '../WorkspacePullRequestsTable';

interface ReviewerStatus {
  username: string;
  avatar_url: string;
  openPRsCount: number;
  requestedReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  changesRequestedReviews: number;
  blockedPRs: number; // PRs waiting for this reviewer
  isBot?: boolean;
  averageReviewTime?: number; // in hours
}

interface PRReviewStatusChartProps {
  pullRequests: PullRequest[];
  onReviewerClick?: (reviewer: string) => void;
  className?: string;
  maxVisible?: number;
  title?: string;
}

export function PRReviewStatusChart({
  pullRequests,
  onReviewerClick,
  className,
  maxVisible = 10,
  title = 'PR Review Status Distribution',
}: PRReviewStatusChartProps) {
  const [excludeBots, setExcludeBots] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'stacked' | 'grouped'>('stacked');
  const [sortBy, setSortBy] = useState<'blocked' | 'requested' | 'total'>('blocked');

  // Calculate reviewer status distribution
  const reviewerStatusData = useMemo(() => {
    const statusMap = new Map<string, ReviewerStatus>();

    // Track PRs that need review (open PRs)
    const openPRs = pullRequests.filter((pr) => pr.state === 'open' || pr.state === 'draft');

    // Process each open PR to understand review status
    openPRs.forEach((pr) => {
      // Process assigned reviewers who haven't reviewed yet (requested reviewers)
      // Since we don't have requested_reviewers in the current interface, we'll simulate it
      // by identifying PRs without reviews or with pending reviews

      // Get all reviewers for this PR
      const reviewersForThisPR = pr.reviewers || [];

      // Check if PR is blocked (no approved reviews)
      const hasApprovedReview = reviewersForThisPR.some((r) => r.approved);
      const isBlocked = !hasApprovedReview && reviewersForThisPR.length > 0;

      // Process each reviewer
      reviewersForThisPR.forEach((reviewer) => {
        const isBotUser = isBot({ username: reviewer.username });

        // Skip bots if excluded
        if (excludeBots && isBotUser) {
          return;
        }

        const existing = statusMap.get(reviewer.username);
        if (existing) {
          existing.openPRsCount++;

          if (reviewer.approved) {
            existing.approvedReviews++;
          } else {
            existing.pendingReviews++;
            if (isBlocked) {
              existing.blockedPRs++;
            }
          }
        } else {
          statusMap.set(reviewer.username, {
            username: reviewer.username,
            avatar_url: reviewer.avatar_url,
            openPRsCount: 1,
            requestedReviews: 0, // Will be calculated below
            pendingReviews: reviewer.approved ? 0 : 1,
            approvedReviews: reviewer.approved ? 1 : 0,
            changesRequestedReviews: 0, // Would need additional data
            blockedPRs: !reviewer.approved && isBlocked ? 1 : 0,
            isBot: isBotUser,
          });
        }
      });

      // Also track PRs without any reviewers (need initial review)
      if (reviewersForThisPR.length === 0) {
        // These PRs need reviewers assigned
        const unassignedKey = '__needs_reviewer__';
        const existing = statusMap.get(unassignedKey);
        if (existing) {
          existing.requestedReviews++;
        } else {
          statusMap.set(unassignedKey, {
            username: 'Needs Reviewer',
            avatar_url: '',
            openPRsCount: 1,
            requestedReviews: 1,
            pendingReviews: 0,
            approvedReviews: 0,
            changesRequestedReviews: 0,
            blockedPRs: 1,
            isBot: false,
          });
        }
      }
    });

    // Calculate requested reviews (PRs waiting for initial review from each person)
    statusMap.forEach((status) => {
      // Requested reviews are pending reviews that haven't been started
      status.requestedReviews = status.pendingReviews;
    });

    // Convert to array and sort
    const statusArray = Array.from(statusMap.values());

    // Sort based on selected criteria
    statusArray.sort((a, b) => {
      switch (sortBy) {
        case 'blocked':
          return b.blockedPRs - a.blockedPRs;
        case 'requested':
          return b.requestedReviews - a.requestedReviews;
        case 'total':
        default:
          return b.openPRsCount - a.openPRsCount;
      }
    });

    return statusArray;
  }, [pullRequests, excludeBots, sortBy]);

  const visibleReviewers = isExpanded
    ? reviewerStatusData
    : reviewerStatusData.slice(0, maxVisible);
  const hasMore = reviewerStatusData.length > maxVisible;

  // Find max count for bar width calculation
  const maxCount = Math.max(...reviewerStatusData.map((r) => r.openPRsCount), 1);

  const handleReviewerClick = (reviewer: ReviewerStatus) => {
    if (reviewer.username === 'Needs Reviewer') {
      onReviewerClick?.('__needs_reviewer__');
    } else {
      onReviewerClick?.(reviewer.username);
    }
  };

  // Calculate totals for summary
  const totals = useMemo(() => {
    return reviewerStatusData.reduce(
      (acc, reviewer) => ({
        totalBlocked: acc.totalBlocked + reviewer.blockedPRs,
        totalRequested: acc.totalRequested + reviewer.requestedReviews,
        totalPending: acc.totalPending + reviewer.pendingReviews,
        totalApproved: acc.totalApproved + reviewer.approvedReviews,
      }),
      { totalBlocked: 0, totalRequested: 0, totalPending: 0, totalApproved: 0 }
    );
  }, [reviewerStatusData]);

  // Get status color
  const getStatusColor = (status: 'blocked' | 'requested' | 'pending' | 'approved' | 'changes') => {
    switch (status) {
      case 'blocked':
        return 'bg-red-500 dark:bg-red-600';
      case 'requested':
        return 'bg-gray-500 dark:bg-gray-600';
      case 'pending':
        return 'bg-orange-500 dark:bg-orange-600';
      case 'approved':
        return 'bg-green-500 dark:bg-green-600';
      case 'changes':
        return 'bg-purple-500 dark:bg-purple-600';
      default:
        return 'bg-gray-500 dark:bg-gray-600';
    }
  };

  if (reviewerStatusData.length === 0) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Sort selector */}
            <div className="flex items-center gap-1">
              <Label htmlFor="sort-by" className="text-sm">
                Sort by:
              </Label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-7 px-2 text-sm border rounded-md bg-background"
              >
                <option value="blocked">Blocked PRs</option>
                <option value="requested">Requested Reviews</option>
                <option value="total">Total PRs</option>
              </select>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={viewMode === 'stacked' ? 'default' : 'ghost'}
                onClick={() => setViewMode('stacked')}
                className="h-7"
              >
                Stacked
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grouped')}
                className="h-7"
              >
                Grouped
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="exclude-bots-pr-status"
                checked={excludeBots}
                onCheckedChange={setExcludeBots}
              />
              <Label htmlFor="exclude-bots-pr-status" className="text-sm">
                Exclude Bots
              </Label>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', getStatusColor('blocked'))} />
            <span>Blocked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', getStatusColor('requested'))} />
            <span>Requested</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', getStatusColor('pending'))} />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-3 h-3 rounded', getStatusColor('approved'))} />
            <span>Approved</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleReviewers.map((reviewer) => {
            const totalForReviewer = reviewer.openPRsCount;
            const blockedWidth = (reviewer.blockedPRs / maxCount) * 100;
            const requestedWidth = (reviewer.requestedReviews / maxCount) * 100;
            const pendingWidth =
              ((reviewer.pendingReviews - reviewer.requestedReviews) / maxCount) * 100;
            const approvedWidth = (reviewer.approvedReviews / maxCount) * 100;

            return (
              <div
                key={reviewer.username}
                className="group cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleReviewerClick(reviewer)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {reviewer.username === 'Needs Reviewer' ? (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <img
                      src={reviewer.avatar_url}
                      alt={reviewer.username}
                      className="h-8 w-8 rounded-full flex-shrink-0"
                    />
                  )}

                  {/* Username and stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{reviewer.username}</span>
                      {reviewer.isBot && (
                        <Badge variant="secondary" className="text-xs">
                          Bot
                        </Badge>
                      )}
                      {/* Quick stats */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground ml-auto">
                        {reviewer.blockedPRs > 0 && (
                          <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                            <AlertCircle className="h-3 w-3" />
                            {reviewer.blockedPRs} blocked
                          </span>
                        )}
                        {reviewer.requestedReviews > 0 && (
                          <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                            <Clock className="h-3 w-3" />
                            {reviewer.requestedReviews} waiting
                          </span>
                        )}
                        <span className="text-muted-foreground">{totalForReviewer} total</span>
                      </div>
                    </div>

                    {/* Stacked or grouped bar */}
                    <div className="relative">
                      <div className="h-6 bg-muted rounded-md overflow-hidden">
                        {viewMode === 'stacked' ? (
                          // Stacked bar
                          <div className="flex h-full">
                            {reviewer.blockedPRs > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('blocked')
                                )}
                                style={{ width: `${blockedWidth}%` }}
                                title={`${reviewer.blockedPRs} blocked`}
                              />
                            )}
                            {reviewer.requestedReviews > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('requested')
                                )}
                                style={{ width: `${requestedWidth}%` }}
                                title={`${reviewer.requestedReviews} requested`}
                              />
                            )}
                            {pendingWidth > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('pending')
                                )}
                                style={{ width: `${pendingWidth}%` }}
                                title={`${reviewer.pendingReviews - reviewer.requestedReviews} in progress`}
                              />
                            )}
                            {reviewer.approvedReviews > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('approved')
                                )}
                                style={{ width: `${approvedWidth}%` }}
                                title={`${reviewer.approvedReviews} approved`}
                              />
                            )}
                          </div>
                        ) : (
                          // Grouped bars
                          <div className="flex h-full gap-1">
                            {reviewer.blockedPRs > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('blocked')
                                )}
                                style={{
                                  width: `${(reviewer.blockedPRs / totalForReviewer) * 100}%`,
                                }}
                                title={`${reviewer.blockedPRs} blocked`}
                              />
                            )}
                            {reviewer.requestedReviews > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('requested')
                                )}
                                style={{
                                  width: `${(reviewer.requestedReviews / totalForReviewer) * 100}%`,
                                }}
                                title={`${reviewer.requestedReviews} requested`}
                              />
                            )}
                            {reviewer.pendingReviews - reviewer.requestedReviews > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('pending')
                                )}
                                style={{
                                  width: `${((reviewer.pendingReviews - reviewer.requestedReviews) / totalForReviewer) * 100}%`,
                                }}
                                title={`${reviewer.pendingReviews - reviewer.requestedReviews} in progress`}
                              />
                            )}
                            {reviewer.approvedReviews > 0 && (
                              <div
                                className={cn(
                                  'transition-all duration-500 ease-out',
                                  getStatusColor('approved')
                                )}
                                style={{
                                  width: `${(reviewer.approvedReviews / totalForReviewer) * 100}%`,
                                }}
                                title={`${reviewer.approvedReviews} approved`}
                              />
                            )}
                          </div>
                        )}
                      </div>
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
                  Show {reviewerStatusData.length - maxVisible} More
                </>
              )}
            </Button>
          )}
        </div>

        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Reviewers:</span>
              <span className="ml-2 font-medium">{reviewerStatusData.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Open PRs:</span>
              <span className="ml-2 font-medium">
                {pullRequests.filter((pr) => pr.state === 'open' || pr.state === 'draft').length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              <span className="text-muted-foreground">Blocked:</span>
              <span className="ml-1 font-medium text-red-600 dark:text-red-400">
                {totals.totalBlocked}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="text-muted-foreground">Waiting:</span>
              <span className="ml-1 font-medium text-gray-600 dark:text-gray-400">
                {totals.totalRequested}
              </span>
            </div>
          </div>

          {/* Action insight */}
          {totals.totalBlocked > 0 && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-md">
              <p className="text-xs text-red-700 dark:text-red-400 font-medium">
                ⚠️ {totals.totalBlocked} PRs are blocked waiting for review. Consider reassigning or
                following up with reviewers.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
