import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, UserCheck, CheckCircle2, Clock } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { PullRequest } from '../WorkspacePullRequestsTable';

interface ReviewerData {
  username: string;
  avatar_url: string;
  totalReviews: number;
  approvedReviews: number;
  pendingReviews: number;
  percentage: number;
  isBot?: boolean;
}

interface ReviewerDistributionChartProps {
  pullRequests: PullRequest[];
  onReviewerClick?: (reviewer: string) => void;
  className?: string;
  maxVisible?: number;
  showPercentage?: boolean;
  title?: string;
  repositories?: Array<{ owner: string; name: string }>;
}

export function ReviewerDistributionChart({
  pullRequests,
  onReviewerClick,
  className,
  maxVisible = 10,
  showPercentage: initialShowPercentage = false,
  title = 'Pull Request Reviewer Distribution',
  repositories,
}: ReviewerDistributionChartProps) {
  const [excludeBots, setExcludeBots] = useState(true);
  const [showPercentage, setShowPercentage] = useState(initialShowPercentage);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'total' | 'approved' | 'pending'>('total');

  // Calculate reviewer distribution
  const reviewerData = useMemo(() => {
    const reviewerMap = new Map<string, ReviewerData>();

    // Track unreviewed count
    let unreviewedCount = 0;

    pullRequests.forEach((pr) => {
      if (!pr.reviewers || pr.reviewers.length === 0) {
        unreviewedCount++;
        return;
      }

      pr.reviewers.forEach((reviewer) => {
        const isBotUser = isBot({ username: reviewer.username });

        // Skip bots if excluded
        if (excludeBots && isBotUser) {
          return;
        }

        const existing = reviewerMap.get(reviewer.username);
        if (existing) {
          existing.totalReviews++;
          if (reviewer.approved) {
            existing.approvedReviews++;
          } else {
            existing.pendingReviews++;
          }
        } else {
          reviewerMap.set(reviewer.username, {
            username: reviewer.username,
            avatar_url: reviewer.avatar_url,
            totalReviews: 1,
            approvedReviews: reviewer.approved ? 1 : 0,
            pendingReviews: reviewer.approved ? 0 : 1,
            percentage: 0,
            isBot: isBotUser,
          });
        }
      });
    });

    // Add unreviewed as a special entry if there are any
    if (unreviewedCount > 0 && !excludeBots) {
      reviewerMap.set('__unreviewed__', {
        username: 'Unreviewed',
        avatar_url: '',
        totalReviews: unreviewedCount,
        approvedReviews: 0,
        pendingReviews: unreviewedCount,
        percentage: 0,
        isBot: false,
      });
    }

    // Convert to array and calculate percentages
    const totalReviews = Array.from(reviewerMap.values()).reduce(
      (sum, r) => sum + r.totalReviews,
      0
    );

    const reviewerArray = Array.from(reviewerMap.values()).map((reviewer) => ({
      ...reviewer,
      percentage: totalReviews > 0 ? (reviewer.totalReviews / totalReviews) * 100 : 0,
    }));

    // Sort by count descending based on view mode
    reviewerArray.sort((a, b) => {
      switch (viewMode) {
        case 'approved':
          return b.approvedReviews - a.approvedReviews;
        case 'pending':
          return b.pendingReviews - a.pendingReviews;
        default:
          return b.totalReviews - a.totalReviews;
      }
    });

    return reviewerArray;
  }, [pullRequests, excludeBots, viewMode]);

  const visibleReviewers = isExpanded ? reviewerData : reviewerData.slice(0, maxVisible);
  const hasMore = reviewerData.length > maxVisible;

  // Find max count for bar width calculation
  const maxCount = useMemo(() => {
    switch (viewMode) {
      case 'approved':
        return Math.max(...reviewerData.map((r) => r.approvedReviews), 1);
      case 'pending':
        return Math.max(...reviewerData.map((r) => r.pendingReviews), 1);
      default:
        return Math.max(...reviewerData.map((r) => r.totalReviews), 1);
    }
  }, [reviewerData, viewMode]);

  const handleReviewerClick = (reviewer: ReviewerData) => {
    if (reviewer.username === 'Unreviewed') {
      onReviewerClick?.('__unreviewed__');
    } else {
      onReviewerClick?.(reviewer.username);
    }
  };

  const getBarOpacity = (reviewer: ReviewerData) => {
    if (viewMode === 'approved') {
      return 1;
    } else if (viewMode === 'pending') {
      return 0.7;
    }
    // For total view, opacity based on approval ratio
    const approvalRatio =
      reviewer.totalReviews > 0 ? reviewer.approvedReviews / reviewer.totalReviews : 0;
    if (approvalRatio >= 0.8) {
      return 1;
    } else if (approvalRatio >= 0.5) {
      return 0.85;
    } else {
      return 0.7;
    }
  };

  const getCount = (reviewer: ReviewerData) => {
    switch (viewMode) {
      case 'approved':
        return reviewer.approvedReviews;
      case 'pending':
        return reviewer.pendingReviews;
      default:
        return reviewer.totalReviews;
    }
  };

  // Generate GitHub URL for all PRs from this reviewer
  const getGitHubPRsUrl = (reviewer: ReviewerData) => {
    if (reviewer.username === 'Unreviewed') {
      return null;
    }

    // If we have repositories info, create a more specific search
    if (repositories && repositories.length === 1) {
      const repo = repositories[0];
      return `https://github.com/${repo.owner}/${repo.name}/pulls?q=is%3Apr+is%3Aopen+author%3A${reviewer.username}`;
    }

    // For multiple repos or no repo info, search all PRs from this user
    return `https://github.com/pulls?q=is%3Apr+is%3Aopen+author%3A${reviewer.username}`;
  };

  if (reviewerData.length === 0) {
    return null;
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          {/* View mode selector dropdown */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
            className="h-7 px-2 text-sm border rounded-md bg-background"
          >
            <option value="total">All Reviews</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleReviewers.map((reviewer) => {
            const count = getCount(reviewer);
            const githubUrl = getGitHubPRsUrl(reviewer);

            return (
              <div
                key={reviewer.username}
                className="group flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleReviewerClick(reviewer)}
              >
                {/* Avatar */}
                {(() => {
                  if (reviewer.username === 'Unreviewed') {
                    return (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Clock className="h-4 w-4 text-muted-foreground" />
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
                        title={`View all PRs created by ${reviewer.username}`}
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
                      className="h-8 w-8 rounded-full"
                    />
                  );
                })()}

                {/* Username and bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{reviewer.username}</span>
                    {reviewer.isBot && (
                      <Badge variant="secondary" className="text-xs">
                        Bot
                      </Badge>
                    )}
                    {/* Show approval ratio for total view */}
                    {viewMode === 'total' && reviewer.username !== 'Unreviewed' && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span title="Approved reviews">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        </span>
                        <span>{reviewer.approvedReviews}</span>
                        <span>/</span>
                        <span title="Pending reviews">
                          <Clock className="h-3 w-3 text-yellow-500" />
                        </span>
                        <span>{reviewer.pendingReviews}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="relative">
                    <div className="h-6 bg-muted rounded-md overflow-hidden">
                      <div
                        className="h-full bg-black dark:bg-white transition-all duration-500 ease-out"
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          opacity: getBarOpacity(reviewer),
                        }}
                      />
                    </div>
                    {/* Count/Percentage overlay */}
                    <div className="absolute inset-0 flex items-center justify-end pr-2">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          // Use contrasting color when bar is more than 80% width
                          count / maxCount > 0.8 ? 'text-white dark:text-black' : 'text-foreground'
                        )}
                      >
                        {showPercentage ? `${reviewer.percentage.toFixed(1)}%` : count}
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
                  Show {reviewerData.length - maxVisible} More
                </>
              )}
            </Button>
          )}
        </div>

        {/* Summary stats and controls */}
        <div className="mt-4 pt-4 border-t space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total reviewers: {reviewerData.length}</span>
            <span>
              Reviews: {reviewerData.reduce((sum, r) => sum + r.approvedReviews, 0)} approved,{' '}
              {reviewerData.reduce((sum, r) => sum + r.pendingReviews, 0)} pending
            </span>
          </div>
          <div className="flex items-center justify-end gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="show-percentage-reviewer"
                checked={showPercentage}
                onCheckedChange={setShowPercentage}
              />
              <Label htmlFor="show-percentage-reviewer" className="text-sm text-muted-foreground">
                Show %
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="exclude-bots-reviewer"
                checked={excludeBots}
                onCheckedChange={setExcludeBots}
              />
              <Label htmlFor="exclude-bots-reviewer" className="text-sm text-muted-foreground">
                Exclude Bots
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
