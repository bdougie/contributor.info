import { cn, humanizeNumber } from '@/lib/utils';
import { MonthlyContributor } from '@/lib/types';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

import { ContributorHoverCard } from './contributor-hover-card';
import { useMemo, useContext, useRef, useCallback } from 'react';
import { GitPullRequest, MessageSquare, GitPullRequestDraft, Trophy } from '@/components/ui/icon';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { createContributorStats } from '@/lib/contributor-utils';
import { trackEvent } from '@/lib/posthog-lazy';

interface ContributorCardProps {
  contributor: MonthlyContributor;
  showRank?: boolean;
  isWinner?: boolean;
  className?: string;
  repositoryOwner?: string;
  repositoryName?: string;
  month?: string;
  year?: number;
}

export function ContributorCard({
  contributor,
  showRank = true,
  isWinner = false,
  className,
  repositoryOwner,
  repositoryName,
  month,
  year,
}: ContributorCardProps) {
  const { login, avatar_url, activity, rank } = contributor;
  const { stats } = useContext(RepoStatsContext);
  const hasTrackedHover = useRef(false);

  // Create contributor data for hover card
  const contributorData = useMemo(() => {
    return createContributorStats(
      stats.pullRequests,
      login,
      avatar_url,
      login // using login as ID since we don't have the actual ID
    );
  }, [login, avatar_url, stats.pullRequests]);

  // Track hover event (only once per session)
  const handleMouseEnter = useCallback(() => {
    if (!hasTrackedHover.current) {
      hasTrackedHover.current = true;
      trackEvent('repo_leaderboard_card_hover', {
        repository_owner: repositoryOwner,
        repository_name: repositoryName,
        contributor_username: login,
        contributor_rank: rank,
        month,
        year,
        is_winner: isWinner,
        pull_requests_count: activity.pullRequests,
        reviews_count: activity.reviews,
        comments_count: activity.comments,
        total_score: activity.totalScore,
      });
    }
  }, [repositoryOwner, repositoryName, login, rank, month, year, isWinner, activity]);

  // Track click event
  const handleClick = useCallback(() => {
    trackEvent('repo_leaderboard_card_clicked', {
      repository_owner: repositoryOwner,
      repository_name: repositoryName,
      contributor_username: login,
      contributor_rank: rank,
      month,
      year,
      is_winner: isWinner,
      pull_requests_count: activity.pullRequests,
      reviews_count: activity.reviews,
      comments_count: activity.comments,
      total_score: activity.totalScore,
    });
  }, [repositoryOwner, repositoryName, login, rank, month, year, isWinner, activity]);

  // Create tooltip content with activity breakdown
  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{login}'s Activity</div>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-3 w-3" />
          <span>{activity.pullRequests} Pull Requests</span>
        </div>
        <div className="flex items-center gap-2">
          <GitPullRequestDraft className="h-3 w-3" />
          <span>{activity.reviews} Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3 w-3" />
          <span>{activity.comments} Comments</span>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'relative p-4 rounded-lg border bg-card transition-all cursor-pointer',
              'hover:bg-muted/50',
              isWinner && 'ring-2 ring-yellow-500 bg-yellow-50/10 dark:bg-yellow-900/10',
              className
            )}
            role={isWinner ? 'article' : 'listitem'}
            aria-label={`${login}${isWinner ? ' - Winner' : ''}, ${activity.totalScore} points`}
            tabIndex={0}
            onMouseEnter={handleMouseEnter}
            onClick={handleClick}
          >
            {/* Rank Badge */}
            {showRank && (
              <div className="absolute -top-2 -right-2 z-10">
                <Badge
                  variant={rank === 1 ? 'default' : 'secondary'}
                  className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
                >
                  {rank}
                </Badge>
              </div>
            )}

            <div className="flex items-start gap-3">
              <ContributorHoverCard contributor={contributorData}>
                <OptimizedAvatar
                  src={avatar_url}
                  alt={`${login}'s avatar`}
                  size={40}
                  lazy={true}
                  className="cursor-pointer"
                  fallback={login.charAt(0).toUpperCase()}
                />
              </ContributorHoverCard>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-sm truncate">{login}</h3>
                  {isWinner && (
                    <Trophy
                      className="h-4 w-4 text-yellow-600"
                      data-testid="trophy-icon"
                      aria-label="Winner"
                      role="img"
                    />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <GitPullRequest className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {humanizeNumber(activity.pullRequests)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">PRs</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <GitPullRequestDraft className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {humanizeNumber(activity.reviews)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Reviews</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {humanizeNumber(activity.comments)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Comments</p>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-3 border-t mt-3">
                  <Badge variant="secondary" className="text-xs">
                    Score: {activity.totalScore}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
