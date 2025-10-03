import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { OptimizedAvatar } from '@/components/ui/optimized-avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ContributorStats } from '@/lib/types';
import React from 'react';
import { GitPullRequest, MessageSquare, GitPullRequestDraft } from '@/components/ui/icon';

// Status colors matching ActivityTable
const STATUS_COLORS = {
  open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  merged: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  closed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
  changes_requested: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
} as const;

// Function to get status badge styling
const getStatusBadgeStyle = (state: string, merged: boolean) => {
  if (merged) return STATUS_COLORS.merged;
  if (state === 'closed') return STATUS_COLORS.closed;
  return STATUS_COLORS.open;
};

// Function to get status label
const getStatusLabel = (state: string, merged: boolean) => {
  if (merged) return 'merged';
  return state;
};

interface ContributorHoverCardProps {
  contributor: ContributorStats;
  role?: string;
  children: React.ReactNode;
  showReviews?: boolean;
  showComments?: boolean;
  reviewsCount?: number;
  commentsCount?: number;
}

export function ContributorHoverCard({
  contributor,
  role,
  children,
  showReviews = false,
  showComments = false,
  reviewsCount = 0,
  commentsCount = 0,
}: ContributorHoverCardProps) {
  // Validate required contributor data
  if (!contributor || !contributor.login) {
    console.warn('ContributorHoverCard: Missing required contributor data', contributor);
    return <>{children}</>;
  }

  return (
    <HoverCardPrimitive.Root openDelay={0} closeDelay={100}>
      <HoverCardPrimitive.Trigger asChild>
        <div className="inline-block" style={{ pointerEvents: 'auto' }}>
          {children}
        </div>
      </HoverCardPrimitive.Trigger>
      <HoverCardPrimitive.Portal>
        <HoverCardPrimitive.Content
          aria-label={`Contributor information for ${contributor.login}`}
          className={cn(
            'relative z-[100] w-80 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
          )}
          side="top"
          align="center"
          alignOffset={0}
          sideOffset={5}
          collisionPadding={10}
          sticky="always"
          avoidCollisions={true}
          onPointerDownOutside={(e) => e.preventDefault()}
          forceMount
        >
          {role && (
            <Badge
              className={cn(
                'absolute top-4 right-4 border-0',
                role.toLowerCase() === 'contributor'
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-500 text-white hover:bg-gray-600'
              )}
              variant="default"
            >
              {role}
            </Badge>
          )}
          <div className="flex gap-3">
            <a
              href={`https://github.com/${contributor.login}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <OptimizedAvatar
                src={contributor.avatar_url}
                alt={contributor.login}
                size={48}
                priority={true}
                fallback={contributor.login ? contributor.login[0].toUpperCase() : '?'}
                className="cursor-pointer hover:opacity-80 transition-opacity"
              />
            </a>
            <div className="flex-1 min-w-0">
              <a
                href={`https://github.com/${contributor.login}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block hover:underline"
              >
                <h4 className="text-sm font-semibold">{contributor.login}</h4>
              </a>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <GitPullRequest className="h-4 w-4" />
                <span>{contributor.pullRequests}</span>
                {showReviews && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <GitPullRequestDraft className="h-4 w-4" />
                    <span>{reviewsCount}</span>
                  </>
                )}
                {showComments && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <MessageSquare className="h-4 w-4" />
                    <span>{commentsCount}</span>
                  </>
                )}
                {!showReviews && !showComments && contributor.percentage > 0 && (
                  <>
                    <span className="text-muted-foreground/50">•</span>
                    <span>{Math.round(contributor.percentage)}%</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {contributor.recentPRs && contributor.recentPRs.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="text-sm font-medium">Recent PRs</div>
                <div className="space-y-2">
                  {contributor.recentPRs.slice(0, 5).map((pr) => {
                    // Validate PR data before rendering
                    if (!pr.repository_owner || !pr.repository_name || !pr.number) {
                      console.warn('Invalid PR data for hover card', pr);
                      return null;
                    }
                    return (
                      <a
                        key={pr.id}
                        href={`https://github.com/${pr.repository_owner}/${pr.repository_name}/pull/${pr.number}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            #{pr.number}
                          </Badge>
                          <span className="truncate">{pr.title}</span>
                          <Badge
                            variant="outline"
                            className={`ml-auto text-xs shrink-0 ${getStatusBadgeStyle(
                              pr.state,
                              pr.merged_at !== null
                            )}`}
                          >
                            {getStatusLabel(pr.state, pr.merged_at !== null)}
                          </Badge>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {contributor.recentIssues && contributor.recentIssues.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="text-sm font-medium">Recent Issues</div>
                <div className="space-y-2">
                  {contributor.recentIssues.slice(0, 5).map((issue) => {
                    // Validate issue data before rendering
                    if (!issue.repository_owner || !issue.repository_name || !issue.number) {
                      console.warn('Invalid issue data for hover card', issue);
                      return null;
                    }
                    return (
                      <a
                        key={issue.id}
                        href={
                          issue.html_url ||
                          `https://github.com/${issue.repository_owner}/${issue.repository_name}/issues/${issue.number}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            #{issue.number}
                          </Badge>
                          <span className="truncate">{issue.title}</span>
                          <Badge
                            variant="outline"
                            className={`ml-auto text-xs shrink-0 ${
                              issue.state === 'closed' ? STATUS_COLORS.closed : STATUS_COLORS.open
                            }`}
                          >
                            {issue.state}
                          </Badge>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {contributor.recentActivities && contributor.recentActivities.length > 0 && (
            <>
              <Separator className="my-4" />
              <div className="space-y-2">
                <div className="text-sm font-medium">Recent Activity</div>
                <div className="space-y-2">
                  {contributor.recentActivities.slice(0, 5).map((activity) => (
                    <a
                      key={activity.id}
                      href={activity.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm hover:bg-muted/50 rounded p-1 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0 capitalize">
                          {activity.type === 'pr' ? 'PR' : activity.type}
                        </Badge>
                        <span className="truncate">{activity.title}</span>
                        {activity.status && (
                          <Badge
                            variant="outline"
                            className={`ml-auto text-xs shrink-0 capitalize ${
                              STATUS_COLORS[activity.status as keyof typeof STATUS_COLORS] ||
                              STATUS_COLORS.open
                            }`}
                          >
                            {activity.status}
                          </Badge>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {contributor.organizations && contributor.organizations.length > 0 && (
            <>
              <Separator className="my-3" />
              <div className="flex flex-wrap gap-2">
                {contributor.organizations.slice(0, 4).map((org) => (
                  <a
                    key={org.login}
                    href={`https://github.com/${org.login}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-1 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <OptimizedAvatar
                      src={org.avatar_url}
                      alt={org.login}
                      size={32}
                      lazy={false}
                      fallback={org.login[0].toUpperCase()}
                      className="h-4 w-4"
                    />
                    <span className="text-xs">{org.login}</span>
                  </a>
                ))}
                {contributor.organizations.length > 4 && (
                  <span className="flex items-center px-2 py-1 text-xs text-muted-foreground">
                    +{contributor.organizations.length - 4}
                  </span>
                )}
              </div>
            </>
          )}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
