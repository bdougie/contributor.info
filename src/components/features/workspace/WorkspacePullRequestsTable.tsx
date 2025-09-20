import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { InlineCodeDiff } from '@/components/ui/code-diff';
import {
  GitPullRequest,
  GitBranch,
  XCircle,
  FileText as GitPullRequestDraft,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  ExternalLink,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useWorkspaceFiltersStore, type PRState } from '@/lib/workspace-filters-store';
import { PRFilters } from './filters/TableFilters';

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  repository: {
    name: string;
    owner: string;
    avatar_url?: string;
  };
  author: {
    username: string;
    avatar_url: string;
    isBot?: boolean;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  merged_at?: string;
  comments_count: number;
  commits_count: number;
  additions: number;
  deletions: number;
  changed_files: number;
  labels: Array<{
    name: string;
    color: string;
  }>;
  reviewers: Array<{
    username: string;
    avatar_url: string;
    approved: boolean;
  }>;
  url: string;
}

export interface WorkspacePullRequestsTableProps {
  pullRequests: PullRequest[];
  loading?: boolean;
  className?: string;
  onPullRequestClick?: (pr: PullRequest) => void;
  onRepositoryClick?: (owner: string, name: string) => void;
}

const columnHelper = createColumnHelper<PullRequest>();

function getRelativeTime(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'today';
  if (diffInDays === 1) return 'yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

function getPRIcon(state: PullRequest['state']) {
  switch (state) {
    case 'open':
      return <GitPullRequest className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case 'merged':
      return <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    case 'closed':
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    case 'draft':
      return <GitPullRequestDraft className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
  }
}

export function WorkspacePullRequestsTable({
  pullRequests,
  loading = false,
  className,
  onPullRequestClick,
  onRepositoryClick,
}: WorkspacePullRequestsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'updated_at', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Get filter state from store
  const { prStates, prIncludeBots, togglePRState, setPRIncludeBots, resetPRFilters } =
    useWorkspaceFiltersStore();

  // Check if there are any bot PRs - using useMemo for performance
  const hasBots = useMemo(() => {
    return pullRequests.some(
      (pr) => pr.author.isBot === true || pr.author.username.toLowerCase().includes('bot')
    );
  }, [pullRequests]);

  // Filter pull requests based on state and bot settings
  const filteredPullRequests = useMemo(() => {
    return pullRequests.filter((pr) => {
      // Filter by state
      const stateMatch = prStates.includes(pr.state as PRState);

      // Filter by bot status
      const isBot = pr.author.isBot === true || pr.author.username.toLowerCase().includes('bot');
      const botMatch = prIncludeBots || !isBot;

      return stateMatch && botMatch;
    });
  }, [pullRequests, prStates, prIncludeBots]);

  const columns = useMemo<ColumnDef<PullRequest>[]>(
    () =>
      [
        columnHelper.accessor('state', {
          size: 120,
          minSize: 100,
          header: ({ column }) => (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              State
              {(() => {
                if (column.getIsSorted() === 'asc') {
                  return <ChevronUp className="ml-2 h-4 w-4" />;
                }
                if (column.getIsSorted() === 'desc') {
                  return <ChevronDown className="ml-2 h-4 w-4" />;
                }
                return <ChevronsUpDown className="ml-2 h-4 w-4" />;
              })()}
            </Button>
          ),
          cell: ({ row }) => {
            const state = row.original.state;
            return (
              <div className="flex items-center">
                {getPRIcon(state)}
                <span className="ml-2 capitalize">{state}</span>
              </div>
            );
          },
        }),
        columnHelper.accessor('title', {
          size: 350,
          minSize: 250,
          header: 'Pull Request',
          cell: ({ row }) => {
            const pr = row.original;
            const truncatedTitle =
              pr.title.length > 50 ? pr.title.substring(0, 50) + '...' : pr.title;

            return (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (onPullRequestClick) {
                          e.preventDefault();
                          onPullRequestClick(pr);
                        }
                      }}
                      className="font-medium hover:text-primary transition-colors text-left inline-flex items-center gap-1"
                    >
                      <span className="line-clamp-1">{truncatedTitle}</span>
                      <span className="text-muted-foreground">#{pr.number}</span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <p>
                      {pr.title} #{pr.number}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          },
        }),
        columnHelper.accessor('repository', {
          size: 200,
          minSize: 150,
          header: 'Repository',
          cell: ({ row }) => {
            const repo = row.original.repository;
            const avatarUrl =
              repo.avatar_url || `https://avatars.githubusercontent.com/${repo.owner}`;

            return (
              <button
                onClick={() => onRepositoryClick?.(repo.owner, repo.name)}
                className="flex items-center gap-2 text-sm hover:text-primary transition-colors min-w-0"
              >
                <img
                  src={avatarUrl}
                  alt={repo.owner}
                  className="h-5 w-5 rounded flex-shrink-0"
                  onError={(e) => {
                    e.currentTarget.src = `https://avatars.githubusercontent.com/${repo.owner}`;
                  }}
                />
                <span className="truncate">{repo.name}</span>
              </button>
            );
          },
        }),
        columnHelper.accessor('author', {
          size: 150,
          minSize: 120,
          header: 'Author',
          cell: ({ row }) => {
            const author = row.original.author;
            return (
              <div className="flex items-center gap-2">
                <img
                  src={author.avatar_url}
                  alt={author.username}
                  className="h-6 w-6 rounded-full"
                />
                <span className="text-sm truncate">{author.username}</span>
              </div>
            );
          },
        }),
        columnHelper.display({
          id: 'changes',
          size: 120,
          minSize: 100,
          header: 'Changes',
          cell: ({ row }) => {
            const pr = row.original;
            return <InlineCodeDiff additions={pr.additions} deletions={pr.deletions} />;
          },
        }),
        columnHelper.accessor('reviewers', {
          size: 130,
          minSize: 100,
          header: 'Reviews',
          cell: ({ row }) => {
            const reviewers = row.original.reviewers;
            if (!reviewers || reviewers.length === 0) {
              return (
                <div className="text-sm text-muted-foreground">
                  <span>-</span>
                </div>
              );
            }

            const approved = reviewers.filter((r) => r.approved).length;
            const pending = reviewers.length - approved;

            return (
              <div className="text-sm">
                {approved > 0 && (
                  <span className="text-green-600 dark:text-green-400">{approved} approved</span>
                )}
                {approved > 0 && pending > 0 && <span className="text-muted-foreground"> / </span>}
                {pending > 0 && <span className="text-muted-foreground">{pending} pending</span>}
              </div>
            );
          },
        }),
        columnHelper.accessor('created_at', {
          size: 120,
          minSize: 100,
          header: ({ column }) => (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Created
              {(() => {
                if (column.getIsSorted() === 'asc') {
                  return <ChevronUp className="ml-2 h-4 w-4" />;
                }
                if (column.getIsSorted() === 'desc') {
                  return <ChevronDown className="ml-2 h-4 w-4" />;
                }
                return <ChevronsUpDown className="ml-2 h-4 w-4" />;
              })()}
            </Button>
          ),
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
              {getRelativeTime(row.original.created_at)}
            </span>
          ),
        }),
        columnHelper.accessor('updated_at', {
          size: 120,
          minSize: 100,
          header: ({ column }) => (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 h-8 data-[state=open]:bg-accent"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Updated
              {(() => {
                if (column.getIsSorted() === 'asc') {
                  return <ChevronUp className="ml-2 h-4 w-4" />;
                }
                if (column.getIsSorted() === 'desc') {
                  return <ChevronDown className="ml-2 h-4 w-4" />;
                }
                return <ChevronsUpDown className="ml-2 h-4 w-4" />;
              })()}
            </Button>
          ),
          cell: ({ row }) => (
            <span className="text-sm text-muted-foreground">
              {getRelativeTime(row.original.updated_at)}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          cell: ({ row }) => (
            <a
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          ),
        }),
      ] as ColumnDef<PullRequest>[],
    [onPullRequestClick, onRepositoryClick]
  );

  const table = useReactTable({
    data: filteredPullRequests,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  if (loading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <CardTitle>Pull Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Pull Requests</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pull requests..."
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10 w-full sm:w-[300px] min-h-[44px]"
                />
              </div>
            </div>
          </div>
          <PRFilters
            selectedStates={prStates}
            includeBots={prIncludeBots}
            onToggleState={togglePRState}
            onIncludeBotsChange={setPRIncludeBots}
            onReset={resetPRFilters}
            hasBots={hasBots}
          />
        </div>
      </CardHeader>
      <CardContent>
        {pullRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <GitPullRequest className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pull requests found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pull requests from your tracked repositories will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] md:min-w-[1400px]">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-left font-medium text-sm whitespace-nowrap"
                            style={{
                              width: header.column.columnDef.size,
                              minWidth: header.column.columnDef.minSize,
                            }}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-4 py-4"
                            style={{
                              width: cell.column.columnDef.size,
                              minWidth: cell.column.columnDef.minSize,
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing {table.getState().pagination.pageIndex * 10 + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * 10,
                  filteredPullRequests.length
                )}{' '}
                of {filteredPullRequests.length} pull requests
                {filteredPullRequests.length < pullRequests.length && (
                  <span className="text-muted-foreground">
                    {' '}
                    (filtered from {pullRequests.length})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  className="min-h-[44px] px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline ml-2">Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  className="min-h-[44px] px-3"
                >
                  <span className="hidden sm:inline mr-2">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Skeleton component for loading state
export function WorkspacePullRequestsTableSkeleton({ className }: { className?: string }) {
  return <WorkspacePullRequestsTable pullRequests={[]} loading={true} className={className} />;
}
