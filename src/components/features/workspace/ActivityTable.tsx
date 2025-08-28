import { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
};

const TYPE_COLORS = {
  pr: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  issue: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  commit: 'bg-green-500/10 text-green-700 dark:text-green-400',
  review: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
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

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  }, [sortField, sortOrder]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading activities...</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
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
          </SelectContent>
        </Select>
      </div>

      {/* Table with virtualization */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('type')}
                >
                  Type
                  <SortIcon field="type" />
                </Button>
              </TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('author')}
                >
                  Author
                  <SortIcon field="author" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('repository')}
                >
                  Repository
                  <SortIcon field="repository" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort('created_at')}
                >
                  Date
                  <SortIcon field="created_at" />
                </Button>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedActivities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No activities found
                </TableCell>
              </TableRow>
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
                          <div className="flex items-center gap-8 w-full">
                            {/* Type */}
                            <div className="w-24">
                              <Badge variant="secondary" className={cn('gap-1', TYPE_COLORS[activity.type])}>
                                <Icon className="h-3 w-3" />
                                {activity.type.toUpperCase()}
                              </Badge>
                            </div>

                            {/* Activity */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{activity.title}</p>
                            </div>

                            {/* Author */}
                            <div className="w-32 flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={activity.author.avatar_url} />
                                <AvatarFallback>
                                  {activity.author.username.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{activity.author.username}</span>
                            </div>

                            {/* Repository */}
                            <div className="w-40">
                              <p className="text-sm text-muted-foreground truncate">{activity.repository}</p>
                            </div>

                            {/* Status */}
                            <div className="w-32">
                              {activity.status && (
                                <Badge
                                  variant="secondary"
                                  className={STATUS_COLORS[activity.status as keyof typeof STATUS_COLORS] || ''}
                                >
                                  {activity.status}
                                </Badge>
                              )}
                            </div>

                            {/* Date */}
                            <div className="w-32">
                              <p className="text-sm text-muted-foreground" title={format(parseISO(activity.created_at), 'PPpp')}>
                                {formatDistanceToNow(parseISO(activity.created_at), { addSuffix: true })}
                              </p>
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
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, processedActivities.length)} of{' '}
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