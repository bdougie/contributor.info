import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ExternalLink,
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
} from '@/components/ui/icon';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ActivityItem } from '../AnalyticsDashboard';

interface ActivityTableRowProps {
  activity: ActivityItem;
  style?: React.CSSProperties;
}

export const TYPE_ICONS = {
  pr: GitPullRequest,
  issue: AlertCircle,
  commit: GitCommit,
  review: MessageSquare,
  comment: MessageSquare,
};

export const TYPE_COLORS = {
  pr: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  issue: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  commit: 'bg-green-500/10 text-green-700 dark:text-green-400',
  review: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  comment: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
};

type StatusType = 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';

export const STATUS_COLORS: Record<StatusType, string> = {
  open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  merged: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  closed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
  changes_requested: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

export const ActivityTableRow = memo(({ activity, style }: ActivityTableRowProps) => {
  const Icon = TYPE_ICONS[activity.type];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'pr':
        return 'Pull Request';
      case 'issue':
        return 'Issue';
      case 'commit':
        return 'Commit';
      case 'review':
        return 'Review';
      case 'comment':
        return 'Comment';
      default:
        return type;
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return 'Unknown';
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div
      style={style}
      role="row"
      tabIndex={0}
      className="group"
      aria-label={`${getTypeLabel(activity.type)} by ${activity.author.username}: ${activity.title}`}
    >
      <div className="flex items-center px-4 py-2 border-b hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-4 w-full">
          {/* Type */}
          <div className="flex-shrink-0 w-24" role="cell">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className={cn('gap-1 cursor-help', TYPE_COLORS[activity.type])}
                    aria-label={getTypeLabel(activity.type)}
                  >
                    <Icon className="h-3 w-3" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {activity.type === 'pr' ? 'PR' : activity.type}
                    </span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{getTypeLabel(activity.type)}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Activity Title */}
          <div className="flex-1 min-w-0" role="cell">
            <div className="truncate font-medium">{activity.title}</div>
          </div>

          {/* Author */}
          <div className="flex-shrink-0 w-32" role="cell">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2 cursor-help">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={activity.author.avatar_url || ''}
                        alt={`${activity.author.username}'s avatar`}
                      />
                      <AvatarFallback>
                        {activity.author.username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate hidden sm:inline">
                      {activity.author.username}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>@{activity.author.username}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Repository */}
          <div className="flex-shrink-0 min-w-[10rem]" role="cell">
            <div className="text-sm truncate font-mono">{activity.repository}</div>
          </div>

          {/* Status */}
          <div className="flex-shrink-0 w-24" role="cell">
            <Badge
              variant="outline"
              className={cn('text-xs', STATUS_COLORS[activity.status as StatusType] || '')}
              aria-label={`Status: ${getStatusLabel(activity.status)}`}
            >
              {getStatusLabel(activity.status)}
            </Badge>
          </div>

          {/* Date */}
          <div className="flex-shrink-0 w-32" role="cell">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <time
                    className="text-sm text-muted-foreground cursor-help"
                    dateTime={activity.created_at}
                  >
                    {formatDistanceToNow(parseISO(activity.created_at), {
                      addSuffix: true,
                    })}
                  </time>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{format(parseISO(activity.created_at), 'PPpp')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Link */}
          <div className="w-12" role="cell">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => window.open(activity.url, '_blank', 'noopener,noreferrer')}
                    aria-label={`Open ${getTypeLabel(activity.type)} in new tab`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View on GitHub</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
});

ActivityTableRow.displayName = 'ActivityTableRow';
