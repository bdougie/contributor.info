import { PullRequestActivity } from '@/lib/types';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContributorHoverCard } from '../contributor';
import { useContext, useMemo, useState, useEffect } from 'react';
import { BotIcon } from '@/components/ui/icon';
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { createContributorStats, createContributorStatsWithOrgs } from '@/lib/contributor-utils';
import { useContributorRole } from '@/hooks/useContributorRoles';
import { SpamProbabilityBadge } from '@/components/features/spam/spam-indicator';
import type { ContributorStats } from '@/lib/types';

interface SpamAwareActivityItemProps {
  activity: PullRequestActivity;
}

export function SpamAwareActivityItem({ activity }: SpamAwareActivityItemProps) {
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

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="flex gap-3 p-2 sm:p-3 rounded-lg border hover:bg-accent/50 transition-colors">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className={`w-2 h-2 rounded-full ${getActivityColor()}`} />
        <div className="w-px h-full bg-border mt-2" />
      </div>

      {/* User avatar */}
      <div className="flex-shrink-0">
        <ContributorHoverCard
          contributor={displayData}
          role={typeof role === 'string' ? role : role?.role}
          showReviews={true}
          showComments={true}
          reviewsCount={activityCounts.reviews}
          commentsCount={activityCounts.comments}
        >
          <div className="relative">
            <OptimizedAvatar
              className="h-8 w-8 cursor-pointer"
              src={user.avatar}
              alt={user.name}
              fallback={user.name.slice(0, 2).toUpperCase()}
              size={32}
              lazy={true}
              priority={false}
            />
            {user.isBot && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <BotIcon className="h-3 w-3 absolute -bottom-1 -right-1 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Bot account</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </ContributorHoverCard>
      </div>

      {/* Activity content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{user.name}</span>
          <span className="text-sm text-muted-foreground">{getActivityText()}</span>
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium hover:underline truncate max-w-xs sm:max-w-none"
          >
            #{pullRequest.number} {pullRequest.title}
          </a>

          {/* Spam probability badge - always show, even for unanalyzed PRs */}
          <SpamProbabilityBadge spamScore={pullRequest.spamScore ?? null} />
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{formatRelativeTime(timestamp)}</span>
          {pullRequest.additions !== undefined && pullRequest.deletions !== undefined && (
            <>
              <span>•</span>
              <span className="text-green-600">+{pullRequest.additions}</span>
              <span className="text-red-600">-{pullRequest.deletions}</span>
            </>
          )}
          {pullRequest.changedFiles !== undefined && (
            <>
              <span>•</span>
              <span>{pullRequest.changedFiles} files</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
