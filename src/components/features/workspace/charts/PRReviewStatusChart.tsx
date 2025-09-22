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
  const [filterMode, setFilterMode] = useState<'blocked' | 'all'>('all');

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
    // Note: requestedReviews represents PRs that need initial review
    // pendingReviews represents all non-approved reviews (including in-progress ones)

    // Convert to array
    let statusArray = Array.from(statusMap.values());

    // Filter based on mode
    if (filterMode === 'blocked') {
      statusArray = statusArray.filter((reviewer) => reviewer.blockedPRs > 0);
    }

    // Sort - blocked PRs first, then by total count
    statusArray.sort((a, b) => {
      // First sort by blocked PRs (descending)
      if (a.blockedPRs !== b.blockedPRs) {
        return b.blockedPRs - a.blockedPRs;
      }
      // Then by total count (descending)
      return b.openPRsCount - a.openPRsCount;
    });

    return statusArray;
  }, [pullRequests, excludeBots, filterMode]);

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

  // Generate GitHub URL for PRs awaiting review from this reviewer
  const getGitHubReviewUrl = (reviewer: ReviewerStatus) => {
    if (reviewer.username === 'Needs Reviewer') {
      return null;
    }

    // If we have repositories info, create a more specific search
    if (repositories && repositories.length === 1) {
      const repo = repositories[0];
      return `https://github.com/${repo.owner}/${repo.name}/pulls?q=is%3Apr+is%3Aopen+review-requested%3A${reviewer.username}`;
    }

    // For multiple repos or no repo info, search all PRs requesting review from this user
    return `https://github.com/pulls?q=is%3Apr+is%3Aopen+review-requested%3A${reviewer.username}`;
  };

  if (reviewerStatusData.length === 0) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          {/* Filter selector dropdown */}
          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as typeof filterMode)}
            className="h-7 px-2 text-sm border rounded-md bg-background"
          >
            <option value="all">All PRs</option>
            <option value="blocked">Blocked PRs Only</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleReviewers.map((reviewer) => {
            const totalForReviewer = reviewer.openPRsCount;
            const githubUrl = getGitHubReviewUrl(reviewer);

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
                            src={reviewer.avatar_url}
                            alt={reviewer.username}
                            className="h-8 w-8 rounded-full hover:ring-2 hover:ring-primary transition-all"
                          />
                        </a>
                      );
                    }
                    return (
                      <img
                        src={reviewer.avatar_url}
                        alt={reviewer.username}
                        className="h-8 w-8 rounded-full flex-shrink-0"
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
              {totals.totalApproved} approved, {totals.totalPending} pending
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
