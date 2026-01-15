import { useState, useMemo, useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ChevronUp, ChevronDown, ExternalLink } from '@/components/ui/icon';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ActivityItem } from './AnalyticsDashboard';
import { ContributorHoverCard } from '@/components/features/contributor/contributor-hover-card';
import type { ContributorStats, RecentActivity } from '@/lib/types';
import { TYPE_ICONS, TYPE_COLORS, STATUS_COLORS } from './components/activity-table-constants';

export interface ActivityTableProps {
  activities: ActivityItem[];
  loading?: boolean;
  pageSize?: number;
  className?: string;
}

type SortField = 'created_at' | 'type' | 'author' | 'repository';
type SortOrder = 'asc' | 'desc';

// Helper functions to avoid nested ternaries
function getAriaSortValue(
  sortField: SortField,
  field: SortField,
  sortOrder: SortOrder
): 'ascending' | 'descending' | undefined {
  if (sortField !== field) return undefined;
  return sortOrder === 'asc' ? 'ascending' : 'descending';
}

function getSortStatusText(sortField: SortField, field: SortField, sortOrder: SortOrder): string {
  if (sortField !== field) return ', click to sort';
  const direction = sortOrder === 'asc' ? 'ascending' : 'descending';
  return `, sorted ${direction}`;
}

// Memoized row component to isolate hooks and prevent reconciliation issues with virtualization
interface ActivityRowProps {
  activity: ActivityItem;
  contributorStats: ContributorStats | undefined;
  virtualItemSize: number;
  virtualItemStart: number;
}

const ActivityRow = memo(function ActivityRow({
  activity,
  contributorStats,
  virtualItemSize,
  virtualItemStart,
}: ActivityRowProps) {
  // Get icon for activity type with fallback
  const Icon = TYPE_ICONS[activity.type] || TYPE_ICONS.pr;

  // Safely parse date with fallback
  const activityDate = (() => {
    try {
      return activity.created_at ? parseISO(activity.created_at) : new Date();
    } catch {
      return new Date();
    }
  })();

  // Use pre-calculated stats or fallback to minimal stats if not found
  const stats: ContributorStats = contributorStats || {
    login: activity.author.username,
    avatar_url: activity.author.avatar_url || `https://github.com/${activity.author.username}.png`,
    pullRequests: 0,
    percentage: 0,
    recentActivities: [],
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: `${virtualItemSize}px`,
        transform: `translateY(${virtualItemStart}px)`,
      }}
      role="row"
    >
      <div className="flex items-center px-2 sm:px-4 py-2 border-b min-w-[1100px]">
        <div className="flex items-center gap-3 w-full">
          {/* Type */}
          <div className="flex-shrink-0 w-16 sm:w-24" role="cell">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="secondary" className={cn('gap-1', TYPE_COLORS[activity.type])}>
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
          </div>

          {/* Activity */}
          <div className="flex-1 min-w-[250px]" role="cell">
            <Tooltip>
              <TooltipTrigger asChild>
                {activity.url ? (
                  <a
                    href={activity.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium truncate cursor-pointer hover:text-primary hover:underline transition-colors block"
                  >
                    {activity.title}
                  </a>
                ) : (
                  <span className="text-sm font-medium truncate block text-muted-foreground">
                    {activity.title}
                  </span>
                )}
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="font-semibold text-sm">{activity.title}</p>
                <p className="text-xs mt-1">Repository: {activity.repository}</p>
                <p className="text-xs">Created: {format(activityDate, 'PPp')}</p>
                {activity.url && <p className="text-xs">Click to open in GitHub</p>}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Author */}
          <div className="hidden sm:flex flex-shrink-0 w-40 items-center gap-2" role="cell">
            <ContributorHoverCard contributor={stats}>
              <a
                href={`https://github.com/${activity.author.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage
                    src={
                      activity.author.avatar_url ||
                      `https://github.com/${activity.author.username}.png`
                    }
                  />
                  <AvatarFallback>
                    {activity.author.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm truncate hover:text-primary transition-colors">
                  {activity.author.username}
                </span>
              </a>
            </ContributorHoverCard>
          </div>

          {/* Repository */}
          <div className="hidden md:block flex-shrink-0 w-44" role="cell">
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
          </div>

          {/* Status - always render Tooltip to maintain consistent hook count */}
          <div className="hidden sm:block flex-shrink-0 w-36" role="cell">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {activity.status ? (
                    <Badge
                      variant="secondary"
                      className={cn(
                        STATUS_COLORS[activity.status as keyof typeof STATUS_COLORS] || ''
                      )}
                    >
                      {activity.status}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {activity.status ? (
                  <>
                    <p className="font-semibold">Status: {activity.status}</p>
                    <p className="text-xs">
                      {(() => {
                        if (activity.status === 'merged') return 'Successfully merged';
                        if (activity.status === 'open') return 'Awaiting review';
                        if (activity.status === 'closed') return 'Closed without merging';
                        return 'Review approved';
                      })()}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No status</p>
                )}
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Date */}
          <div className="flex-shrink-0 w-44" role="cell">
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(activityDate, {
                    addSuffix: true,
                  })}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-semibold">Exact time</p>
                <p className="text-xs">{format(activityDate, 'PPpp')}</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Link */}
          <div className="w-8 sm:w-12" role="cell">
            {activity.url ? (
              <a
                href={activity.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center justify-center"
                aria-label={`Open ${activity.title} in new tab`}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : (
              <span
                className="text-muted-foreground/30 inline-flex items-center justify-center"
                aria-hidden="true"
              >
                <ExternalLink className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

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

  // Pre-calculate contributor stats efficiently (O(N) instead of O(N*M))
  const contributorStatsMap = useMemo(() => {
    const statsMap = new Map<string, ContributorStats>();
    const activitiesByAuthor = new Map<string, ActivityItem[]>();

    // 1. Group activities by author (Single Pass)
    for (const activity of activities) {
      const username = activity.author.username;
      // Using lowercase for consistent key lookups if needed, but keeping it simple for now as per original logic which relied on exact match
      const key = username;
      if (!activitiesByAuthor.has(key)) {
        activitiesByAuthor.set(key, []);
      }
      activitiesByAuthor.get(key)!.push(activity);
    }

    // 2. Process each author to build stats
    for (const [username, userActivities] of activitiesByAuthor) {
      // Sort by date descending
      userActivities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Get top 5 recent activities
      const recentActivities: RecentActivity[] = userActivities.slice(0, 5).map(a => ({
        id: a.id,
        type: a.type,
        title: a.title,
        created_at: a.created_at,
        status: a.status,
        repository: a.repository,
        url: a.url
      }));

      // Calculate stats
      const pullRequests = userActivities.filter(a => a.type === 'pr').length;

      // Use the first activity to get avatar url
      const avatar_url = userActivities[0].author.avatar_url || `https://github.com/${username}.png`;

      statsMap.set(username, {
        login: username,
        avatar_url,
        pullRequests,
        percentage: 0, // Default as per original code
        recentActivities
      });
    }

    return statsMap;
  }, [activities]);

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

  // Memoize callbacks to prevent infinite re-renders from useVirtualizer
  const getScrollElement = useCallback(() => parentRef.current, []);

  const getItemKey = useCallback(
    (index: number) => {
      const activity = paginatedActivities[index];
      if (!activity) return `empty-${index}`;
      return `${activity.type}-${activity.id}`;
    },
    [paginatedActivities]
  );

  // Virtual scrolling for large datasets
  const virtualizer = useVirtualizer({
    count: paginatedActivities.length,
    getScrollElement,
    estimateSize: () => 60,
    overscan: 5,
    getItemKey,
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

  // Helper function to render sort icon - not a component to avoid hooks issues
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="text-muted-foreground">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 w-full', className)} data-testid="activity-table">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search activities..."
            aria-label="Search activities"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className="w-full sm:w-40 min-h-[44px]"
            aria-label="Filter by activity type"
          >
            <SelectValue placeholder="Filter type" />
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
      <div className="rounded-md border overflow-x-auto" role="table" aria-label="Activity feed">
        {/* Table Header */}
        <div className="border-b bg-muted/50 min-w-[1100px]" role="rowgroup">
          <div className="flex items-center px-4 py-3" role="row">
            <div className="flex items-center gap-3 w-full">
              <div
                className="flex-shrink-0 w-16 sm:w-24"
                role="columnheader"
                aria-sort={getAriaSortValue(sortField, 'type', sortOrder)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('type')}
                >
                  Type
                  {renderSortIcon('type')}
                  <span className="sr-only">{getSortStatusText(sortField, 'type', sortOrder)}</span>
                </Button>
              </div>
              <div className="flex-1 min-w-[250px]" role="columnheader">
                <span className="font-medium text-sm">Activity</span>
              </div>
              <div
                className="hidden sm:block flex-shrink-0 w-40"
                role="columnheader"
                aria-sort={getAriaSortValue(sortField, 'author', sortOrder)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('author')}
                >
                  Author
                  {renderSortIcon('author')}
                  <span className="sr-only">
                    {getSortStatusText(sortField, 'author', sortOrder)}
                  </span>
                </Button>
              </div>
              <div
                className="hidden md:block flex-shrink-0 min-w-[8rem]"
                role="columnheader"
                aria-sort={getAriaSortValue(sortField, 'repository', sortOrder)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('repository')}
                >
                  Repo
                  {renderSortIcon('repository')}
                  <span className="sr-only">
                    {getSortStatusText(sortField, 'repository', sortOrder)}
                  </span>
                </Button>
              </div>
              <div className="hidden sm:block flex-shrink-0 w-36" role="columnheader">
                Status
              </div>
              <div
                className="flex-shrink-0 w-44"
                role="columnheader"
                aria-sort={getAriaSortValue(sortField, 'created_at', sortOrder)}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('created_at')}
                >
                  Date
                  {renderSortIcon('created_at')}
                  <span className="sr-only">
                    {getSortStatusText(sortField, 'created_at', sortOrder)}
                  </span>
                </Button>
              </div>
              <div className="w-8 sm:w-12" role="columnheader">
                <span className="sr-only">Link</span>
              </div>
            </div>
          </div>
        </div>
        {/* Table Body */}
        <div role="rowgroup">
          {paginatedActivities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" role="row">
              <span role="cell">No activities found</span>
            </div>
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
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const activity = paginatedActivities[virtualItem.index];
                  if (!activity) {
                    return null;
                  }
                  return (
                    <ActivityRow
                      key={`${activity.type}-${activity.id}`}
                      activity={activity}
                      contributorStats={contributorStatsMap.get(activity.author.username)}
                      virtualItemSize={virtualItem.size}
                      virtualItemStart={virtualItem.start}
                    />
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
          <p
            className="text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
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
