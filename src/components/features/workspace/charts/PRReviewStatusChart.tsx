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
  CheckCircle2,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { PullRequest } from '../WorkspacePullRequestsTable';
import {
  type ReviewerStatus,
  NEEDS_REVIEWER_KEY,
  sortReviewerStatuses,
  getGitHubReviewUrl,
  getGitHubAvatarUrl,
  filterReviewerStatuses,
  calculateReviewTotals,
  calculateReviewerStatusDistribution,
} from '@/lib/utils/pr-review-status';

interface PRReviewStatusChartProps {
  pullRequests: PullRequest[];
  onReviewerClick?: (reviewer: string) => void;
  className?: string;
  maxVisible?: number;
  title?: string;
  repositories?: Array<{ owner: string; name: string }>;
}

export function PRReviewStatusChart({
  pullRequests,
  onReviewerClick,
  className,
  maxVisible = 10,
  title = 'PR Review Status Distribution',
  repositories,
}: PRReviewStatusChartProps) {
  const [excludeBots, setExcludeBots] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate reviewer status distribution
  const reviewerStatusData = useMemo(() => {
    // Use the consolidated function to calculate reviewer statuses
    const statusArray = calculateReviewerStatusDistribution(pullRequests, (username) =>
      isBot({ username })
    );

    // Apply bot filtering before sorting
    const filteredArray = filterReviewerStatuses(statusArray, excludeBots);

    // Sort by priority
    return sortReviewerStatuses(filteredArray);
  }, [pullRequests, excludeBots]);

  const visibleReviewers = isExpanded
    ? reviewerStatusData
    : reviewerStatusData.slice(0, maxVisible);
  const hasMore = reviewerStatusData.length > maxVisible;

  // Find max count for bar width calculation
  const maxCount = Math.max(...reviewerStatusData.map((r) => r.openPRsCount), 1);

  const handleReviewerClick = (reviewer: ReviewerStatus) => {
    if (!onReviewerClick) return;

    if (reviewer.username === 'Needs Reviewer') {
      onReviewerClick(NEEDS_REVIEWER_KEY);
    } else {
      onReviewerClick(reviewer.username);
    }
  };

  // Calculate totals for summary
  const totals = useMemo(() => {
    return calculateReviewTotals(reviewerStatusData);
  }, [reviewerStatusData]);

  if (reviewerStatusData.length === 0) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-5 w-5 text-muted-foreground" />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleReviewers.map((reviewer) => {
            const totalForReviewer = reviewer.openPRsCount;
            const githubUrl = getGitHubReviewUrl(reviewer, repositories);

            return (
              <div
                key={reviewer.username}
                className="group cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleReviewerClick(reviewer)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  {(() => {
                    if (reviewer.username === 'Needs Reviewer') {
                      return (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                      );
                    }
                    if (githubUrl) {
                      return (
                        <a
                          href={githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title={`View PRs awaiting review from ${reviewer.username}`}
                        >
                          <img
                            src={reviewer.avatar_url || getGitHubAvatarUrl(reviewer.username)}
                            alt={reviewer.username}
                            className="h-8 w-8 rounded-full hover:ring-2 hover:ring-primary transition-all"
                            onError={(e) => {
                              // Fallback to GitHub default avatar if image fails to load
                              e.currentTarget.src = getGitHubAvatarUrl(reviewer.username);
                            }}
                          />
                        </a>
                      );
                    }
                    return (
                      <img
                        src={reviewer.avatar_url || getGitHubAvatarUrl(reviewer.username)}
                        alt={reviewer.username}
                        className="h-8 w-8 rounded-full flex-shrink-0"
                        onError={(e) => {
                          // Fallback to GitHub default avatar if image fails to load
                          e.currentTarget.src = getGitHubAvatarUrl(reviewer.username);
                        }}
                      />
                    );
                  })()}

                  {/* Username and stats */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{reviewer.username}</span>
                      {reviewer.isBot && (
                        <Badge variant="secondary" className="text-xs">
                          Bot
                        </Badge>
                      )}
                      {/* Status indicators with counts - next to username like ReviewerDistributionChart */}
                      {(reviewer.blockedPRs > 0 ||
                        reviewer.approvedReviews > 0 ||
                        reviewer.pendingReviews > 0) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {reviewer.blockedPRs > 0 && (
                            <>
                              <span title="Blocked PRs">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                              </span>
                              <span>{reviewer.blockedPRs}</span>
                            </>
                          )}
                          {reviewer.approvedReviews > 0 && (
                            <>
                              {reviewer.blockedPRs > 0 && <span>/</span>}
                              <span title="Approved PRs">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              </span>
                              <span>{reviewer.approvedReviews}</span>
                            </>
                          )}
                          {reviewer.pendingReviews > 0 && (
                            <>
                              {(reviewer.blockedPRs > 0 || reviewer.approvedReviews > 0) && (
                                <span>/</span>
                              )}
                              <span title="Pending reviews">
                                <Clock className="h-3 w-3 text-yellow-500" />
                              </span>
                              <span>{reviewer.pendingReviews}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stacked progress bar */}
                    <div className="relative">
                      <div className="h-6 bg-muted rounded-md overflow-hidden">
                        <div className="flex h-full">
                          {reviewer.blockedPRs > 0 && (
                            <div
                              className="bg-red-500 dark:bg-red-600 transition-all duration-500 ease-out"
                              style={{ width: `${(reviewer.blockedPRs / maxCount) * 100}%` }}
                              title={`${reviewer.blockedPRs} blocked`}
                            />
                          )}
                          {reviewer.changesRequestedReviews > 0 && (
                            <div
                              className="bg-orange-500 dark:bg-orange-600 transition-all duration-500 ease-out"
                              style={{
                                width: `${(reviewer.changesRequestedReviews / maxCount) * 100}%`,
                              }}
                              title={`${reviewer.changesRequestedReviews} changes requested`}
                            />
                          )}
                          {reviewer.pendingReviews > 0 && (
                            <div
                              className="bg-yellow-500 dark:bg-yellow-600 transition-all duration-500 ease-out"
                              style={{ width: `${(reviewer.pendingReviews / maxCount) * 100}%` }}
                              title={`${reviewer.pendingReviews} pending`}
                            />
                          )}
                          {reviewer.approvedReviews > 0 && (
                            <div
                              className="bg-green-500 dark:bg-green-600 transition-all duration-500 ease-out"
                              style={{ width: `${(reviewer.approvedReviews / maxCount) * 100}%` }}
                              title={`${reviewer.approvedReviews} approved`}
                            />
                          )}
                        </div>
                      </div>
                      {/* Count overlay */}
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            // Use contrasting color when bar is more than 80% width
                            totalForReviewer / maxCount > 0.8
                              ? 'text-white dark:text-black'
                              : 'text-foreground'
                          )}
                        >
                          {totalForReviewer}
                        </span>
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

        {/* Summary stats and controls */}
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total reviewers: {reviewerStatusData.length}</span>
            <span>
              {totals.totalBlocked > 0 && (
                <span className="text-red-600 dark:text-red-400 font-medium mr-2">
                  {totals.totalBlocked} blocked
                </span>
              )}
              {totals.totalApproved > 0 && (
                <span className="text-green-600 dark:text-green-400 mr-2">
                  {totals.totalApproved} approved
                </span>
              )}
              {totals.totalPending > 0 && (
                <span className="text-yellow-600 dark:text-yellow-400 mr-2">
                  {totals.totalPending} pending
                </span>
              )}
              {totals.totalChangesRequested > 0 && (
                <span className="text-orange-600 dark:text-orange-400">
                  {totals.totalChangesRequested} changes requested
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="exclude-bots-pr-status"
                checked={excludeBots}
                onCheckedChange={setExcludeBots}
              />
              <Label htmlFor="exclude-bots-pr-status" className="text-sm text-muted-foreground">
                Exclude Bots
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
