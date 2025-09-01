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

export interface ActivityTableProps {
  activities: ActivityItem[];
  loading?: boolean;
  pageSize?: number;
  className?: string;
}

type SortField = 'created_at' | 'type' | 'author' | 'repository';
type SortOrder = 'asc' | 'desc';

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
  fork: 'bg-pink-500/10 text-pink-700 dark:text-pink-400',
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
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
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
      <div className="rounded-md border w-full">
        {/* Table Header */}
        <div className="border-b bg-muted/50">
          <div className="flex items-center px-4 py-3">
            <div className="flex items-center gap-4 w-full">
              <div className="flex-shrink-0 w-24">
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
              <div className="flex-1 min-w-0">Activity</div>
              <div className="flex-shrink-0 w-32">
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
              <div className="flex-shrink-0 min-w-[10rem]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('repository')}
                >
                  Repository
                  <SortIcon field="repository" />
                </Button>
              </div>
              <div className="flex-shrink-0 w-24">Status</div>
              <div className="flex-shrink-0 w-32">
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
              <div className="w-12"></div>
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
              className="h-[600px] w-full overflow-auto"
              style={{
                contain: 'strict',
                width: '100%',
              }}
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const activity = paginatedActivities[virtualItem.index];
                  const Icon = TYPE_ICONS[activity.type];

                  return (
                    <div
                      key={activity.id}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      <div className="flex items-center px-4 py-2 border-b">
                        <div className="flex items-center gap-4 w-full">
                          {/* Type */}
                          <div className="flex-shrink-0 w-24">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className={cn('gap-1 cursor-help', TYPE_COLORS[activity.type])}
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
                          <div className="flex-1 min-w-0">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm font-medium truncate cursor-help">
                                    {activity.title}
                                  </p>
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
                          <div className="flex-shrink-0 w-32 flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage src={activity.author.avatar_url} />
                                      <AvatarFallback>
                                        {activity.author.username.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm truncate">
                                      {activity.author.username}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">@{activity.author.username}</p>
                                  <p className="text-xs">Contributor</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {/* Repository */}
                          <div className="flex-shrink-0 min-w-[10rem]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm text-muted-foreground truncate cursor-help">
                                    {activity.repository}
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-semibold">{activity.repository}</p>
                                  <p className="text-xs">Click to view repository</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {/* Status */}
                          <div className="flex-shrink-0 w-24">
                            {activity.status && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="secondary"
                                      className={cn(
                                        'cursor-help',
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
                          <div className="flex-shrink-0 w-32">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-sm text-muted-foreground cursor-help">
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
                          <div className="w-12">
                            {activity.url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={activity.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
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
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = Math.max(0, Math.min(page - 2 + i, totalPages - 1));
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                    className="w-8"
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
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
