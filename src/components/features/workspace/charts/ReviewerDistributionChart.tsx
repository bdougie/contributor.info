import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronDown,
  ChevronUp,
  UserCheck,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
} from '@/components/ui/icon';
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
  previousCount?: number;
  change?: number;
  changePercentage?: number;
  isBot?: boolean;
}

interface ReviewerDistributionChartProps {
  pullRequests: PullRequest[];
  onReviewerClick?: (reviewer: string) => void;
  className?: string;
  maxVisible?: number;
  showPercentage?: boolean;
  title?: string;
}

export function ReviewerDistributionChart({
  pullRequests,
  onReviewerClick,
  className,
  maxVisible = 10,
  showPercentage: initialShowPercentage = false,
  title = 'Pull Request Reviewer Distribution',
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
      // Mock previous data for demo purposes - in production this would come from historical data
      previousCount: Math.max(1, reviewer.totalReviews - Math.floor(Math.random() * 3) + 1),
    }));

    // Calculate change
    reviewerArray.forEach((reviewer) => {
      if (reviewer.previousCount !== undefined) {
        reviewer.change = reviewer.totalReviews - reviewer.previousCount;
        reviewer.changePercentage =
          reviewer.previousCount > 0 ? (reviewer.change / reviewer.previousCount) * 100 : 100;
      }
    });

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
          <div className="flex items-center gap-4">
            {/* View mode selector */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={viewMode === 'total' ? 'default' : 'ghost'}
                onClick={() => setViewMode('total')}
                className="h-7"
              >
                All
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'approved' ? 'default' : 'ghost'}
                onClick={() => setViewMode('approved')}
                className="h-7"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Approved
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'pending' ? 'default' : 'ghost'}
                onClick={() => setViewMode('pending')}
                className="h-7"
              >
                <Clock className="h-3 w-3 mr-1" />
                Pending
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="show-percentage-reviewer"
                checked={showPercentage}
                onCheckedChange={setShowPercentage}
              />
              <Label htmlFor="show-percentage-reviewer" className="text-sm">
                Show %
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="exclude-bots-reviewer"
                checked={excludeBots}
                onCheckedChange={setExcludeBots}
              />
              <Label htmlFor="exclude-bots-reviewer" className="text-sm">
                Exclude Bots
              </Label>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleReviewers.map((reviewer) => {
            const count = getCount(reviewer);

            return (
              <div
                key={reviewer.username}
                className="group flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => handleReviewerClick(reviewer)}
              >
                {/* Avatar */}
                {reviewer.username === 'Unreviewed' ? (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </div>
                ) : (
                  <img
                    src={reviewer.avatar_url}
                    alt={reviewer.username}
                    className="h-8 w-8 rounded-full"
                  />
                )}

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
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        <span>{reviewer.approvedReviews}</span>
                        <span>/</span>
                        <Clock className="h-3 w-3 text-yellow-500" />
                        <span>{reviewer.pendingReviews}</span>
                      </div>
                    )}
                    {reviewer.change !== undefined &&
                      reviewer.change !== 0 &&
                      viewMode === 'total' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  'flex items-center gap-0.5 text-xs',
                                  reviewer.change > 0 ? 'text-green-600' : 'text-red-600'
                                )}
                              >
                                {reviewer.change > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                <span>{Math.abs(reviewer.changePercentage || 0).toFixed(0)}%</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {reviewer.change > 0 ? '+' : ''}
                                {reviewer.change} from previous period
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

        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
          <span>Total reviewers: {reviewerData.length}</span>
          <span>
            Reviews: {reviewerData.reduce((sum, r) => sum + r.approvedReviews, 0)} approved,{' '}
            {reviewerData.reduce((sum, r) => sum + r.pendingReviews, 0)} pending
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
