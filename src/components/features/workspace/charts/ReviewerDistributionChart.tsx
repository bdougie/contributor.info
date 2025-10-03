import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronUp,
  UserCheck,
  CheckCircle2,
  Clock,
  Filter,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { isBot } from '@/lib/utils/bot-detection';
import type { PullRequest } from '../WorkspacePullRequestsTable';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';
import type { ContributorStats } from '@/lib/types';
import { getRecentPRsForReviewer } from '@/lib/workspace-hover-card-utils';

interface ReviewerData {
  username: string;
  avatar_url: string;
  totalPRs: number; // Number of PRs this reviewer is assigned to
  approvedPRs: number; // Number of PRs where this reviewer has approved
  pendingPRs: number; // Number of PRs where this reviewer hasn't approved yet
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

  // Calculate reviewer distribution - showing how many PRs each reviewer is assigned to
  const reviewerData = useMemo(() => {
    const reviewerMap = new Map<string, ReviewerData>();

    // Track unreviewed count
    let unreviewedCount = 0;

    // Memoize bot detection results to avoid repeated calls
    const botCache = new Map<string, boolean>();
    const checkIsBot = (username: string): boolean => {
      if (!botCache.has(username)) {
        botCache.set(username, isBot({ username }));
      }
      return botCache.get(username)!;
    };

    // Filter for open PRs only (including drafts) - matching PR Review Status Chart behavior
    const openPRs = pullRequests.filter((pr) => pr.state === 'open' || pr.state === 'draft');

    openPRs.forEach((pr) => {
      // Use requested_reviewers to show who is assigned to review
      // If requested_reviewers doesn't exist, fall back to reviewers who have already reviewed
      const requestedReviewers = pr.requested_reviewers || [];
      const actualReviewers = pr.reviewers || [];

      // Combine both lists - requested reviewers and those who have already reviewed
      const allReviewers = new Map<
        string,
        { username: string; avatar_url: string; hasReviewed: boolean; approved: boolean }
      >();

      // Add requested reviewers first
      requestedReviewers.forEach((reviewer) => {
        allReviewers.set(reviewer.username, {
          ...reviewer,
          hasReviewed: false,
          approved: false,
        });
      });

      // Add/update with reviewers who have actually reviewed
      actualReviewers.forEach((reviewer) => {
        allReviewers.set(reviewer.username, {
          username: reviewer.username,
          avatar_url: reviewer.avatar_url,
          hasReviewed: true,
          approved: reviewer.approved,
        });
      });

      if (allReviewers.size === 0) {
        unreviewedCount++;
        return;
      }

      // For each PR, track which reviewers are assigned and their status
      allReviewers.forEach((reviewer) => {
        const isBotUser = checkIsBot(reviewer.username);

        // Skip bots if excluded
        if (excludeBots && isBotUser) {
          return;
        }

        const existing = reviewerMap.get(reviewer.username);
        if (existing) {
          // This reviewer is on another PR - increment their PR count
          existing.totalPRs++;
          if (reviewer.approved) {
            existing.approvedPRs++;
          } else {
            existing.pendingPRs++;
          }
        } else {
          // First time seeing this reviewer
          reviewerMap.set(reviewer.username, {
            username: reviewer.username,
            avatar_url: reviewer.avatar_url,
            totalPRs: 1, // They're assigned to this PR
            approvedPRs: reviewer.approved ? 1 : 0,
            pendingPRs: reviewer.approved ? 0 : 1,
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
        totalPRs: unreviewedCount,
        approvedPRs: 0,
        pendingPRs: unreviewedCount,
        percentage: 0,
        isBot: false,
      });
    }

    // Convert to array and calculate percentages
    const totalPRCount = Array.from(reviewerMap.values()).reduce((sum, r) => sum + r.totalPRs, 0);

    const reviewerArray = Array.from(reviewerMap.values()).map((reviewer) => ({
      ...reviewer,
      percentage: totalPRCount > 0 ? (reviewer.totalPRs / totalPRCount) * 100 : 0,
    }));

    // Sort by count descending based on view mode
    reviewerArray.sort((a, b) => {
      switch (viewMode) {
        case 'approved':
          return b.approvedPRs - a.approvedPRs;
        case 'pending':
          return b.pendingPRs - a.pendingPRs;
        default:
          return b.totalPRs - a.totalPRs;
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
        return Math.max(...reviewerData.map((r) => r.approvedPRs), 1);
      case 'pending':
        return Math.max(...reviewerData.map((r) => r.pendingPRs), 1);
      default:
        return Math.max(...reviewerData.map((r) => r.totalPRs), 1);
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
    const approvalRatio = reviewer.totalPRs > 0 ? reviewer.approvedPRs / reviewer.totalPRs : 0;
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
        return reviewer.approvedPRs;
      case 'pending':
        return reviewer.pendingPRs;
      default:
        return reviewer.totalPRs;
    }
  };

  // Generate GitHub URL for all PRs reviewed by this user
  const getGitHubPRsUrl = (reviewer: ReviewerData) => {
    if (reviewer.username === 'Unreviewed') {
      return null;
    }

    // If we have repositories info, create a more specific search
    if (repositories && repositories.length === 1) {
      const repo = repositories[0];
      // Search for PRs where this user is a requested reviewer or has reviewed
      return `https://github.com/${repo.owner}/${repo.name}/pulls?q=is%3Apr+is%3Aopen+reviewed-by%3A${reviewer.username}+review-requested%3A${reviewer.username}`;
    }

    // For multiple repos or no repo info, search all PRs reviewed by this user
    return `https://github.com/pulls?q=is%3Apr+is%3Aopen+reviewed-by%3A${reviewer.username}+review-requested%3A${reviewer.username}`;
  };

  if (reviewerData.length === 0) {
    return null;
  }

  // Helper function to get filter label
  const getFilterLabel = () => {
    switch (viewMode) {
      case 'approved':
        return 'Approved';
      case 'pending':
        return 'Pending';
      default:
        return 'All Reviews';
    }
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-muted-foreground" />
            <CardTitle>{title}</CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <Filter className="h-3 w-3 mr-2" />
                {getFilterLabel()}
                <ChevronDown className="h-3 w-3 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => setViewMode('total')}
                className={cn(viewMode === 'total' && 'bg-accent')}
              >
                All Reviews
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setViewMode('approved')}
                className={cn(viewMode === 'approved' && 'bg-accent')}
              >
                <CheckCircle2 className="h-3 w-3 mr-2 text-green-500" />
                Approved
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setViewMode('pending')}
                className={cn(viewMode === 'pending' && 'bg-accent')}
              >
                <Clock className="h-3 w-3 mr-2 text-yellow-500" />
                Pending
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

                  const contributorStats: ContributorStats = {
                    login: reviewer.username,
                    avatar_url: reviewer.avatar_url,
                    pullRequests: reviewer.totalPRs,
                    percentage: 0,
                    recentPRs: getRecentPRsForReviewer(reviewer.username, pullRequests, 5),
                  };

                  const avatarImg = (
                    <img
                      src={reviewer.avatar_url}
                      alt={reviewer.username}
                      className={
                        githubUrl
                          ? 'h-8 w-8 rounded-full hover:ring-2 hover:ring-primary transition-all'
                          : 'h-8 w-8 rounded-full'
                      }
                    />
                  );

                  const avatarContent = githubUrl ? (
                    <a
                      href={githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                      title={`View PRs reviewed by ${reviewer.username}`}
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
                        <span>{reviewer.approvedPRs}</span>
                        <span>/</span>
                        <span title="Pending reviews">
                          <Clock className="h-3 w-3 text-yellow-500" />
                        </span>
                        <span>{reviewer.pendingPRs}</span>
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
                          count / maxCount > 0.8 ? 'text-white' : 'text-foreground'
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
              PRs: {reviewerData.reduce((sum, r) => sum + r.approvedPRs, 0)} approved,{' '}
              {reviewerData.reduce((sum, r) => sum + r.pendingPRs, 0)} pending
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
