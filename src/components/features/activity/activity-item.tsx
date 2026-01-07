import { PullRequestActivity } from '@/lib/types';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ContributorHoverCard } from '../contributor';
import { useContext, useMemo } from 'react';
import { BotIcon } from '@/components/ui/icon';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { createContributorStats, getContributorActivityCounts } from '@/lib/contributor-utils';
import { useContributorRole } from '@/hooks/useContributorRoles';
import { getUserRole } from '@/lib/utils/data-type-mapping';

interface ActivityItemProps {
  activity: PullRequestActivity;
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const { type, user, pullRequest, repository, timestamp } = activity;
  const { stats } = useContext(RepoStatsContext);

  // Get the contributor's role
  const { role } = useContributorRole(repository.owner, repository.name, user.id);

  // Create initial contributor data (synchronous)
  const displayData = useMemo(() => {
    return createContributorStats(stats.pullRequests, user.name, user.avatar, user.id);
  }, [user, stats.pullRequests]);

  // Calculate reviews and comments count for this user
  const activityCounts = useMemo(() => {
    // Optimized: Use shared cache instead of O(N*M) loop
    const allCounts = getContributorActivityCounts(stats.pullRequests);
    return allCounts[user.name] || { reviews: 0, comments: 0 };
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
      case 'starred':
        return 'bg-yellow-500';
      case 'forked':
        return 'bg-indigo-500';
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
      case 'starred':
        return 'starred';
      case 'forked':
        return 'forked';
      default:
        return 'updated';
    }
  };

  return (
    <article className="flex items-start space-x-3 p-2 sm:p-3 rounded-md hover:bg-muted/50 transition-colors">
      <div className="relative flex-shrink-0">
        <ContributorHoverCard
          contributor={displayData}
          role={getUserRole(role, user)}
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
                <Tooltip>
                  <TooltipTrigger>
                    <BotIcon className="h-3 w-3 text-muted-foreground ml-1" aria-label="Bot user" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bot</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <span className="text-muted-foreground">
                {type === 'starred' && '⭐ '}
                {type === 'forked' && '🔱 '}
                {getActivityText()}
              </span>
              {pullRequest.number > 0 ? (
                <>
                  <a
                    href={`https://github.com/${repository.owner}/${repository.name}/pull/${pullRequest.number}`}
                    className="text-orange-500 hover:underline cursor-pointer transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Pull request #${pullRequest.number}`}
                  >
                    #{pullRequest.number}
                  </a>
                  <span className="text-muted-foreground hidden sm:inline">in</span>
                </>
              ) : (
                <span className="text-muted-foreground hidden sm:inline"></span>
              )}
              <a
                href={`https://github.com/${repository.owner}/${repository.name}`}
                className="text-orange-500 hover:underline cursor-pointer transition-colors truncate max-w-xs sm:max-w-none hidden sm:inline"
                target="_blank"
                rel="noopener noreferrer"
                title={`${repository.owner}/${repository.name}`}
                aria-label={`Repository ${repository.owner}/${repository.name}`}
              >
                {repository.owner}/{repository.name}
              </a>
            </div>
            <h3 className="text-sm line-clamp-1 pr-2 font-normal">
              {pullRequest.number > 0 ? (
                <a
                  href={`https://github.com/${repository.owner}/${repository.name}/pull/${pullRequest.number}`}
                  className="hover:text-primary hover:underline cursor-pointer transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Pull request: ${pullRequest.title}`}
                >
                  {pullRequest.title}
                </a>
              ) : (
                pullRequest.title
              )}
            </h3>
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap sm:ml-2">
            {timestamp}
          </time>
        </div>
      </div>
    </article>
  );
}
