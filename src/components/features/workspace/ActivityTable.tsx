import { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitPullRequest,
  GitCommit,
  MessageSquare,
  AlertCircle,
  Search,
  Star,
  GitFork,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from '@/components/ui/icon';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ActivityItem } from './AnalyticsDashboard';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';
import type { ContributorStats } from '@/lib/types';
import { getRecentActivitiesForContributor } from '@/lib/workspace-hover-card-utils';

export interface ActivityTableProps {
  activities: ActivityItem[];
  loading?: boolean;
  pageSize?: number;
  className?: string;
}

type SortField = 'created_at' | 'type' | 'author' | 'repository';
type SortOrder = 'asc' | 'desc';

// Helper function to construct GitHub URL
const getActivityUrl = (activity: ActivityItem): string => {
  if (activity.url) return activity.url;

  // Construct URL based on type if not provided
  const [owner, repo] = activity.repository.split('/');
  if (!owner || !repo) return '#';

  // Try to extract number from existing URL if available, then from id, then from title
  let number = '';

  // First try to extract from URL if it exists
  if (activity.url) {
    const urlMatch = activity.url.match(/\/(?:pull|issues)\/(\d+)/);
    if (urlMatch) {
      number = urlMatch[1];
    }
  }

  // If no number found and we have an id that looks like a number, use it
  if (!number && activity.id && /^\d+$/.test(activity.id)) {
    number = activity.id;
  }

  // Fall back to extracting from title as last resort
  if (!number) {
    const titleMatch = activity.title.match(/#(\d+)/);
    number = titleMatch ? titleMatch[1] : '';
  }

  switch (activity.type) {
    case 'pr':
      return number
        ? `https://github.com/${owner}/${repo}/pull/${number}`
        : `https://github.com/${owner}/${repo}/pulls`;
    case 'issue':
      return number
        ? `https://github.com/${owner}/${repo}/issues/${number}`
        : `https://github.com/${owner}/${repo}/issues`;
    case 'commit':
      return `https://github.com/${owner}/${repo}/commits`;
    default:
      return `https://github.com/${owner}/${repo}`;
  }
};

const TYPE_ICONS = {
  pr: GitPullRequest,
  issue: AlertCircle,
  commit: GitCommit,
  review: MessageSquare,
  comment: MessageSquare,
  star: Star,
  fork: GitFork,
};

const TYPE_COLORS = {
  pr: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  issue: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  commit: 'bg-green-500/10 text-green-700 dark:text-green-400',
  review: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  comment: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400',
  star: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  fork: 'bg-white/10 text-white dark:text-white',
};

const STATUS_COLORS = {
  open: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  merged: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  closed: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400',
  changes_requested: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
};

export function ActivityTable({
  activities,
  loading = false,
  pageSize = 50,
  className,
}: ActivityTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(0);

  const parentRef = useRef<HTMLDivElement>(null);

  // Filter and sort activities
  const processedActivities = useMemo(() => {
    let filtered = activities;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (activity) =>
          activity.title.toLowerCase().includes(query) ||
          activity.author.username.toLowerCase().includes(query) ||
          activity.repository.toLowerCase().includes(query)
      );
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((activity) => activity.type === typeFilter);
    }

    // Sort activities
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'author':
          comparison = a.author.username.localeCompare(b.author.username);
          break;
        case 'repository':
          comparison = a.repository.localeCompare(b.repository);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [activities, searchQuery, typeFilter, sortField, sortOrder]);

  // Pagination
  const paginatedActivities = useMemo(() => {
    const start = page * pageSize;
    const end = start + pageSize;
    return processedActivities.slice(start, end);
  }, [processedActivities, page, pageSize]);

  const totalPages = Math.ceil(processedActivities.length / pageSize);

  // Virtual scrolling for large datasets
  const virtualizer = useVirtualizer({
    count: paginatedActivities.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
    // Add getItemKey to ensure proper key management
    getItemKey: (index) => {
      const activity = paginatedActivities[index];
      if (!activity) return `empty-${index}`;
      return `${activity.type}-${activity.id}-${index}-${activity.created_at}`;
    },
  });

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('desc');
      }
    },
    [sortField]
  );

  const SortIcon = useCallback(
    ({ field }: { field: SortField }) => {
      if (sortField !== field) return null;
      return sortOrder === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      );
    },
    [sortField, sortOrder]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 w-full', className)} data-testid="activity-table">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40 min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pr">Pull Requests</SelectItem>
            <SelectItem value="issue">Issues</SelectItem>
            <SelectItem value="commit">Commits</SelectItem>
            <SelectItem value="review">Reviews</SelectItem>
            <SelectItem value="comment">Comments</SelectItem>
            <SelectItem value="star">Stars</SelectItem>
            <SelectItem value="fork">Forks</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table with virtualization */}
      <div className="rounded-md border overflow-x-auto">
        {/* Table Header */}
        <div className="border-b bg-muted/50 min-w-[1100px]">
          <div className="flex items-center px-4 py-3">
            <div className="flex items-center gap-3 w-full">
              <div className="flex-shrink-0 w-16 sm:w-24">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('type')}
                >
                  Type
                  <SortIcon field="type" />
                </Button>
              </div>
              <div className="flex-1 min-w-[250px]">
                <span className="font-medium text-sm">Activity</span>
              </div>
              <div className="hidden sm:block flex-shrink-0 w-40">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('author')}
                >
                  Author
                  <SortIcon field="author" />
                </Button>
              </div>
              <div className="hidden md:block flex-shrink-0 min-w-[8rem]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('repository')}
                >
                  Repo
                  <SortIcon field="repository" />
                </Button>
              </div>
              <div className="hidden sm:block flex-shrink-0 w-36">Status</div>
              <div className="flex-shrink-0 w-44">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('created_at')}
                >
                  Date
                  <SortIcon field="created_at" />
                </Button>
              </div>
              <div className="w-8 sm:w-12"></div>
            </div>
          </div>
        </div>
        {/* Table Body */}
        <div>
          {paginatedActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No activities found</div>
          ) : (
            <div
              ref={parentRef}
              className="h-[600px] overflow-auto"
              style={{
                contain: 'strict',
              }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem, arrayIndex) => {
                  const activity = paginatedActivities[virtualItem.index];
                  if (!activity) {
                    return null; // Skip if activity doesn't exist
                  }
                  const Icon = TYPE_ICONS[activity.type];

                  // Generate unique key using multiple identifiers to ensure uniqueness
                  // Use arrayIndex as a fallback to guarantee uniqueness
                  const uniqueKey = `activity-${virtualItem.index}-${arrayIndex}-${activity.type}-${activity.id}`;

                  return (
                    <div
                      key={uniqueKey}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div className="flex items-center px-2 sm:px-4 py-2 border-b min-w-[1100px]">
                        <div className="flex items-center gap-3 w-full">
                          {/* Type */}
                          <div className="flex-shrink-0 w-16 sm:w-24">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className={cn('gap-1', TYPE_COLORS[activity.type])}
                                  >
                                    <Icon className="h-3 w-3" />
                                    {activity.type.toUpperCase()}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">
                                    {(() => {
                                      if (activity.type === 'pr') return 'Pull Request';
                                      if (activity.type === 'issue') return 'Issue';
                                      if (activity.type === 'commit') return 'Commit';
                                      return 'Review';
                                    })()}
                                  </p>
                                  <p className="text-xs">Status: {activity.status}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {/* Activity */}
                          <div className="flex-1 min-w-[250px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={getActivityUrl(activity)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium truncate cursor-pointer hover:text-primary hover:underline transition-colors block"
                                  >
                                    {activity.title}
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p className="font-semibold text-sm">{activity.title}</p>
                                  <p className="text-xs mt-1">Repository: {activity.repository}</p>
                                  <p className="text-xs">
                                    Created: {format(parseISO(activity.created_at), 'PPp')}
                                  </p>
                                  <p className="text-xs">Click to open in GitHub</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {/* Author */}
                          <div className="hidden sm:flex flex-shrink-0 w-40 items-center gap-2">
                            {(() => {
                              // Calculate contributor stats from all activities
                              const contributorActivities = activities.filter(
                                (a) => a.author.username === activity.author.username
                              );

                              const pullRequestsCount = contributorActivities.filter(
                                (a) => a.type === 'pr'
                              ).length;

                              const reviewsCount = contributorActivities.filter(
                                (a) => a.type === 'review'
                              ).length;

                              const commentsCount = contributorActivities.filter(
                                (a) => a.type === 'comment'
                              ).length;

                              const contributorStats: ContributorStats = {
                                login: activity.author.username,
                                avatar_url: activity.author.avatar_url || '',
                                pullRequests: pullRequestsCount,
                                percentage: 0,
                                recentActivities: getRecentActivitiesForContributor(
                                  activity.author.username,
                                  activities,
                                  5
                                ),
                              };

                              return (
                                <ContributorHoverCard
                                  contributor={contributorStats}
                                  showReviews={true}
                                  showComments={true}
                                  reviewsCount={reviewsCount}
                                  commentsCount={commentsCount}
                                >
                                  <a
                                    href={`https://github.com/${activity.author.username}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={activity.author.avatar_url} />
                                      <AvatarFallback>
                                        {activity.author.username.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm truncate hover:text-primary transition-colors">
                                      {activity.author.username}
                                    </span>
                                  </a>
                                </ContributorHoverCard>
                              );
                            })()}
                          </div>

                          {/* Repository */}
                          <div className="hidden md:block flex-shrink-0 w-44">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={`https://github.com/${activity.repository}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-muted-foreground truncate cursor-pointer hover:text-primary hover:underline transition-colors block"
                                  >
                                    {activity.repository}
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">{activity.repository}</p>
                                  <p className="text-xs">Click to view repository</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {/* Status */}
                          <div className="hidden sm:block flex-shrink-0 w-36">
                            {activity.status && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        STATUS_COLORS[
                                          activity.status as keyof typeof STATUS_COLORS
                                        ] || ''
                                      )}
                                    >
                                      {activity.status}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-semibold">Status: {activity.status}</p>
                                    <p className="text-xs">
                                      {(() => {
                                        if (activity.status === 'merged')
                                          return 'Successfully merged';
                                        if (activity.status === 'open') return 'Awaiting review';
                                        if (activity.status === 'closed')
                                          return 'Closed without merging';
                                        return 'Review approved';
                                      })()}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>

                          {/* Date */}
                          <div className="flex-shrink-0 w-44">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDistanceToNow(parseISO(activity.created_at), {
                                      addSuffix: true,
                                    })}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">Exact time</p>
                                  <p className="text-xs">
                                    {format(parseISO(activity.created_at), 'PPpp')}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {/* Link */}
                          <div className="w-8 sm:w-12">
                            <a
                              href={getActivityUrl(activity)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center justify-center"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to{' '}
            {Math.min((page + 1) * pageSize, processedActivities.length)} of{' '}
            {processedActivities.length} activities
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {(() => {
                // Calculate the range of pages to show
                let startPage = Math.max(0, page - 2);
                const endPage = Math.min(totalPages - 1, startPage + 4);

                // Adjust startPage if we're near the end
                if (endPage - startPage < 4) {
                  startPage = Math.max(0, endPage - 4);
                }

                const pageNumbers = [];
                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(i);
                }

                return pageNumbers.map((pageNum) => (
                  <Button
                    key={`page-${pageNum}`}
                    variant={pageNum === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum + 1}
                  </Button>
                ));
              })()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
