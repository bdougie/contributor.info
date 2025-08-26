import { PullRequestActivity } from '@/lib/types';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContributorHoverCard } from '../contributor';
import { useContext, useMemo, useState, useEffect } from 'react';
import { BotIcon } from '@/components/ui/icon';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { createContributorStats, createContributorStatsWithOrgs } from '@/lib/contributor-utils';
import { useContributorRole } from '@/hooks/useContributorRoles';
import type { ContributorStats } from '@/lib/types';

interface ActivityItemProps {
  activity: PullRequestActivity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { type, user, pullRequest, repository, timestamp } = activity;
  const { stats } = useContext(RepoStatsContext);
  const [contributorData, setContributorData] = useState<ContributorStats | null>(null);

  // Get the contributor's role
  const { role } = useContributorRole(repository.owner, repository.name, user.id);

  // Create initial contributor data
  const initialContributorData = useMemo(() => {
    return createContributorStats(stats.pullRequests, user.name, user.avatar, user.id);
  }, [user, stats.pullRequests]);

  // Fetch organizations data
  useEffect(() => {
    const fetchContributorData = async () => {
      const dataWithOrgs = await createContributorStatsWithOrgs(
        stats.pullRequests,
        user.name,
        user.avatar,
        user.id,
      );
      setContributorData(_dataWithOrgs);
    };

    fetchContributorData();
  }, [user, stats.pullRequests]);

  // Use initial data if async data not ready yet
  const displayData = contributorData || initialContributorData;

  // Calculate reviews and comments count for this user
  const activityCounts = useMemo(() => {
    let reviews = 0;
    let comments = 0;

    stats.pullRequests.forEach((pr) => {
      if (pr.reviews) {
        reviews += pr.reviews.filter((review) => review.user.login === user.name).length;
      }
      if (pr.comments) {
        comments += pr.comments.filter((comment) => comment.user.login === user.name).length;
      }
    });

    return { reviews, comments };
  }, [stats.pullRequests, user.name]);

  const getActivityColor = () => {
    switch (type) {
      case 'opened':
        return 'bg-emerald-500';
      case 'closed':
        return 'bg-red-500';
      case 'merged':
        return 'bg-purple-500';
      case 'reviewed':
        return 'bg-blue-500';
      case 'commented':
        return 'bg-gray-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getActivityText = () => {
    switch (type) {
      case 'opened':
        return 'opened';
      case 'closed':
        return 'closed';
      case 'merged':
        return 'merged';
      case 'reviewed':
        return 'reviewed';
      case 'commented':
        return 'commented on';
      default:
        return 'updated';
    }
  };

  return (
    <article className="flex items-start space-x-3 p-2 sm:p-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="relative flex-shrink-0">
        <ContributorHoverCard
          contributor={displayData}
          role={role?.role || (user.isBot ? 'Bot' : 'Contributor')}
          showReviews={true}
          showComments={true}
          reviewsCount={activityCounts.reviews}
          commentsCount={activityCounts.comments}
        >
          <OptimizedAvatar
            className="h-8 w-8 cursor-pointer"
            src={user.avatar}
            alt={user.name}
            fallback={user.name ? user.name.charAt(0).toUpperCase() : '?'}
            size={32}
            lazy={true}
            priority={false}
          />
        </ContributorHoverCard>
        <div
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${getActivityColor()} border border-background`}
          aria-hidden="true"
        ></div>
      </div>

      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex flex-col space-y-1 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center space-x-1 text-sm flex-wrap">
              <span className="font-medium">{user.name}</span>
              {user.isBot && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <BotIcon
                        className="h-3 w-3 text-muted-foreground ml-1"
                        aria-label="Bot user"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Bot</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <span className="text-muted-foreground">{getActivityText()}</span>
              <a
                href={pullRequest.url}
                className="text-orange-500 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Pull request #${pullRequest.number}`}
              >
                #{pullRequest.number}
              </a>
              <span className="text-muted-foreground hidden sm:inline">in</span>
              <a
                href={repository.url}
                className="text-orange-500 hover:underline truncate max-w-xs sm:max-w-none hidden sm:inline"
                target="_blank"
                rel="noopener noreferrer"
                title={`${repository.owner}/${repository.name}`}
                aria-label={`Repository ${repository.owner}/${repository.name}`}
              >
                {repository.owner}/{repository.name}
              </a>
            </div>
            <h3 className="text-sm line-clamp-1 pr-2 font-normal">{pullRequest.title}</h3>
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap sm:ml-2">
            {timestamp}
          </time>
        </div>
      </div>
    </article>
  );
}
