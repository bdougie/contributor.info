import { useState, useMemo } from "react";
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
} from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  GitPullRequestDraft,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Plus,
  Minus,
  FileText
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { humanizeNumber } from "@/lib/utils";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  repository: {
    name: string;
    owner: string;
  };
  author: {
    username: string;
    avatar_url: string;
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
      return <GitMerge className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
    case 'closed':
      return <GitPullRequestClosed className="h-4 w-4 text-red-600 dark:text-red-400" />;
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
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated_at', desc: true }
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<PullRequest>[]>(
    () => [
      columnHelper.accessor('state', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            State
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
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
        header: 'Pull Request',
        cell: ({ row }) => {
          const pr = row.original;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPullRequestClick?.(pr)}
                  className="font-medium hover:text-primary transition-colors text-left line-clamp-1"
                >
                  {pr.title}
                </button>
                <span className="text-muted-foreground text-sm">
                  #{pr.number}
                </span>
              </div>
              {pr.labels.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {pr.labels.slice(0, 3).map((label) => (
                    <Badge
                      key={label.name}
                      variant="secondary"
                      className="text-xs"
                      style={{
                        backgroundColor: `#${label.color}20`,
                        color: `#${label.color}`,
                        borderColor: `#${label.color}40`,
                      }}
                    >
                      {label.name}
                    </Badge>
                  ))}
                  {pr.labels.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{pr.labels.length - 3}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor('repository', {
        header: 'Repository',
        cell: ({ row }) => {
          const repo = row.original.repository;
          return (
            <button
              onClick={() => onRepositoryClick?.(repo.owner, repo.name)}
              className="text-sm hover:text-primary transition-colors"
            >
              {repo.owner}/{repo.name}
            </button>
          );
        },
      }),
      columnHelper.accessor('author', {
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
              <span className="text-sm">{author.username}</span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'changes',
        header: 'Changes',
        cell: ({ row }) => {
          const pr = row.original;
          return (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <Plus className="h-3 w-3 text-green-600 dark:text-green-400" />
                <span className="text-green-600 dark:text-green-400">
                  {humanizeNumber(pr.additions)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Minus className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-red-600 dark:text-red-400">
                  {humanizeNumber(pr.deletions)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {pr.changed_files}
                </span>
              </div>
            </div>
          );
        },
      }),
      columnHelper.accessor('reviewers', {
        header: 'Reviews',
        cell: ({ row }) => {
          const reviewers = row.original.reviewers;
          if (reviewers.length === 0) {
            return <span className="text-sm text-muted-foreground">No reviews</span>;
          }
          
          const approved = reviewers.filter(r => r.approved).length;
          const pending = reviewers.length - approved;
          
          return (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {reviewers.slice(0, 3).map((reviewer) => (
                  <img
                    key={reviewer.username}
                    src={reviewer.avatar_url}
                    alt={reviewer.username}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 border-background",
                      reviewer.approved && "ring-2 ring-green-500"
                    )}
                  />
                ))}
                {reviewers.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                    <span className="text-xs">+{reviewers.length - 3}</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {approved > 0 && `${approved} approved`}
                {approved > 0 && pending > 0 && ', '}
                {pending > 0 && `${pending} pending`}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('created_at', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Created
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getRelativeTime(row.original.created_at)}
          </span>
        ),
      }),
      columnHelper.accessor('updated_at', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Updated
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUpDown className="ml-2 h-4 w-4" />
            )}
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
    ],
    [onPullRequestClick, onRepositoryClick]
  );

  const table = useReactTable({
    data: pullRequests,
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
      <Card className={cn("w-full", className)}>
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
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Pull Requests</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search pull requests..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
          </div>
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
                <table className="w-full">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className="px-4 py-3 text-left font-medium text-sm"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b hover:bg-muted/50 transition-colors"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-4 py-3">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * 10 + 1} to{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * 10,
                  pullRequests.length
                )}{' '}
                of {pullRequests.length} pull requests
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
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