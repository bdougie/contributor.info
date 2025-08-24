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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Circle, 
  CheckCircle2, 
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  MessageSquare
} from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface Issue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  repository: {
    name: string;
    owner: string;
    avatar_url?: string;
  };
  author: {
    username: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comments_count: number;
  labels: Array<{
    name: string;
    color: string;
  }>;
  linked_pull_requests?: Array<{
    number: number;
    url: string;
    state: 'open' | 'closed' | 'merged';
  }>;
  url: string;
}

export interface WorkspaceIssuesTableProps {
  issues: Issue[];
  loading?: boolean;
  className?: string;
  onIssueClick?: (issue: Issue) => void;
  onRepositoryClick?: (owner: string, name: string) => void;
}

const columnHelper = createColumnHelper<Issue>();

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

export function WorkspaceIssuesTable({
  issues,
  loading = false,
  className,
  onIssueClick,
  onRepositoryClick,
}: WorkspaceIssuesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated_at', desc: true }
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<Issue>[]>(
    () => ([
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
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const state = row.original.state;
          return (
            <div className="flex items-center">
              {state === 'open' ? (
                <Circle className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              )}
              <span className="ml-2 capitalize">{state}</span>
            </div>
          );
        },
        size: 100,
      }),
      columnHelper.accessor('title', {
        header: 'Issue',
        cell: ({ row }) => {
          const issue = row.original;
          const truncatedTitle = issue.title.length > 50 
            ? issue.title.substring(0, 50) + '...' 
            : issue.title;
          
          return (
            <div className="flex flex-col gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (onIssueClick) {
                          e.preventDefault();
                          onIssueClick(issue);
                        }
                      }}
                      className="font-medium hover:text-primary transition-colors text-left inline-flex items-center gap-1"
                    >
                      <span className="line-clamp-1">{truncatedTitle}</span>
                      <span className="text-muted-foreground">#{issue.number}</span>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-md">
                    <p>{issue.title} #{issue.number}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {issue.labels.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {issue.labels.slice(0, 3).map((label) => (
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
                  {issue.labels.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{issue.labels.length - 3}
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
          const avatarUrl = repo.avatar_url || `https://github.com/${repo.owner}.png`;
          
          return (
            <button
              onClick={() => onRepositoryClick?.(repo.owner, repo.name)}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
            >
              <img
                src={avatarUrl}
                alt={repo.owner}
                className="h-5 w-5 rounded"
                onError={(e) => {
                  e.currentTarget.src = `https://github.com/${repo.owner}.png`;
                }}
              />
              <span>{repo.name}</span>
            </button>
          );
        },
        size: 180,
      }),
      columnHelper.accessor('author', {
        header: 'Author',
        cell: ({ row }) => {
          const author = row.original.author;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <img
                    src={author.avatar_url}
                    alt={author.username}
                    className="h-6 w-6 rounded-full cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{author.username}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
        size: 60,
      }),
      columnHelper.accessor('linked_pull_requests', {
        header: 'Linked PRs',
        cell: ({ row }) => {
          const prs = row.original.linked_pull_requests;
          if (!prs || prs.length === 0) {
            return <span className="text-sm text-muted-foreground">-</span>;
          }
          
          return (
            <div className="flex items-center gap-1 flex-wrap">
              {prs.slice(0, 2).map((pr) => (
                <a
                  key={pr.number}
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-sm font-medium hover:underline",
                    pr.state === 'merged' && "text-purple-600 dark:text-purple-400",
                    pr.state === 'open' && "text-green-600 dark:text-green-400",
                    pr.state === 'closed' && "text-red-600 dark:text-red-400"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  #{pr.number}
                </a>
              ))}
              {prs.length > 2 && (
                <span className="text-sm text-muted-foreground">
                  +{prs.length - 2}
                </span>
              )}
            </div>
          );
        },
        size: 120,
      }),
      columnHelper.accessor('comments_count', {
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            <MessageSquare className="h-4 w-4" />
            {column.getIsSorted() === 'asc' ? (
              <ChevronUp className="ml-1 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-1 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-1 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-center">
            <span className="text-sm text-muted-foreground">
              {row.original.comments_count}
            </span>
          </div>
        ),
        size: 60,
        minSize: 50,
        maxSize: 80,
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
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getRelativeTime(row.original.created_at)}
          </span>
        ),
        size: 100,
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
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : column.getIsSorted() === 'desc' ? (
              <ChevronDown className="ml-2 h-4 w-4" />
            ) : (
              <ChevronsUpDown className="ml-2 h-4 w-4" />
            )}
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {getRelativeTime(row.original.updated_at)}
          </span>
        ),
        size: 100,
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
        size: 50,
      }),
    ] as ColumnDef<Issue>[]),
    [onIssueClick, onRepositoryClick]
  );

  const table = useReactTable({
    data: issues,
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
          <CardTitle>Issues</CardTitle>
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
          <CardTitle>Issues</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search issues..."
                value={globalFilter ?? ''}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-10 w-[300px]"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No issues found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Issues from your tracked repositories will appear here
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b">
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            className={cn(
                              "px-4 py-3 font-medium text-sm whitespace-nowrap",
                              header.column.id === 'comments_count' ? "text-center" : "text-left"
                            )}
                            style={{
                              width: header.column.columnDef.size,
                              minWidth: header.column.columnDef.minSize,
                              maxWidth: header.column.columnDef.maxSize,
                            }}
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
                          <td key={cell.id} className="px-4 py-4">
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
                  issues.length
                )}{' '}
                of {issues.length} issues
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
export function WorkspaceIssuesTableSkeleton({ className }: { className?: string }) {
  return <WorkspaceIssuesTable issues={[]} loading={true} className={className} />;
}