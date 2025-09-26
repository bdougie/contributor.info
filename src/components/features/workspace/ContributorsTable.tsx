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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  MessageSquare,
  Eye,
  Users,
  GitPullRequest,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { humanizeNumber } from '@/lib/utils';
import type { Contributor } from './ContributorsList';

export interface ContributorGroup {
  id: string;
  name: string;
  color: 'default' | 'secondary' | 'outline' | 'destructive';
  is_system: boolean;
}

export interface ContributorsTableProps {
  contributors: Contributor[];
  groups?: ContributorGroup[];
  contributorGroups?: Map<string, string[]>; // contributorId -> groupIds[]
  loading?: boolean;
  className?: string;
  onContributorClick?: (contributor: Contributor) => void;
  onAddToGroup?: (contributorId: string) => void;
  onAddNote?: (contributorId: string) => void;
  onRemoveContributor?: (contributorId: string) => void;
  showHeader?: boolean;
}

const columnHelper = createColumnHelper<Contributor>();

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

export function ContributorsTable({
  contributors,
  groups = [],
  contributorGroups = new Map(),
  loading = false,
  className,
  onContributorClick,
  onAddToGroup,
  onAddNote,
  onRemoveContributor,
  showHeader = true,
}: ContributorsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'stats.total_contributions', desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const columns = useMemo<ColumnDef<Contributor>[]>(
    () => [
      columnHelper.display({
        id: 'username',
        size: 350,
        minSize: 300,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Contributor
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
          const contributor = row.original;
          const groupIds = contributorGroups.get(contributor.id) || [];
          const contributorGroupsList = groups.filter((g) => groupIds.includes(g.id));

          return (
            <button
              onClick={() => onContributorClick?.(contributor)}
              className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            >
              <img
                src={contributor.avatar_url}
                alt={contributor.username}
                className="h-8 w-8 rounded-full"
              />
              <div className="space-y-1">
                <p className="font-medium">@{contributor.username}</p>
                <div className="flex flex-wrap gap-1">
                  {contributorGroupsList.length > 0 ? (
                    contributorGroupsList.map((group) => (
                      <Badge key={group.id} variant={group.color} className="text-xs">
                        {group.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">No groups</span>
                  )}
                </div>
              </div>
            </button>
          );
        },
      }),
      columnHelper.display({
        id: 'trend',
        size: 100,
        minSize: 80,
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 data-[state=open]:bg-accent"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Trend
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
          const trend = row.original.stats.contribution_trend;
          let TrendIcon = Minus;
          let trendColor = 'text-muted-foreground';

          if (trend > 0) {
            TrendIcon = TrendingUp;
            trendColor = 'text-green-600';
          } else if (trend < 0) {
            TrendIcon = TrendingDown;
            trendColor = 'text-red-600';
          }

          return (
            <div className={cn('flex items-center gap-1', trendColor)}>
              <TrendIcon className="h-4 w-4" />
              <span className="font-medium">
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'activity',
        size: 150,
        minSize: 120,
        header: 'Activity',
        cell: ({ row }) => {
          const stats = row.original.contributions;
          return (
            <div className="flex items-center gap-3 text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                    <span>{humanizeNumber(stats.pull_requests)}</span>
                  </TooltipTrigger>
                  <TooltipContent>Pull Requests</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    <span>{humanizeNumber(stats.issues)}</span>
                  </TooltipTrigger>
                  <TooltipContent>Issues</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <span>{humanizeNumber(stats.reviews)}</span>
                  </TooltipTrigger>
                  <TooltipContent>Reviews</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'last_active',
        size: 120,
        minSize: 100,
        header: 'Last Active',
        cell: ({ row }) => {
          const date = row.original.stats.last_active;
          return <span className="text-sm">{getRelativeTime(date)}</span>;
        },
      }),
      columnHelper.display({
        id: 'repositories',
        size: 120,
        minSize: 100,
        header: 'Repositories',
        cell: ({ row }) => {
          const count = row.original.stats.repositories_contributed;
          return (
            <span className="text-sm">
              {count} {count === 1 ? 'repo' : 'repos'}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        size: 60,
        minSize: 60,
        cell: ({ row }) => {
          const contributor = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onContributorClick?.(contributor)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddToGroup?.(contributor.id)}>
                  <Users className="mr-2 h-4 w-4" />
                  Manage Groups
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAddNote?.(contributor.id)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Add Note
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onRemoveContributor?.(contributor.id)}
                  className="text-destructive"
                >
                  Remove from Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      }),
    ],
    [groups, contributorGroups, onContributorClick, onAddToGroup, onAddNote, onRemoveContributor]
  );

  const table = useReactTable({
    data: contributors,
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
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="h-5 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tableContent = (
    <>
      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contributors..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-sm"
                    style={{
                      width: header.column.columnDef.size,
                      minWidth: header.column.columnDef.minSize,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3"
                      style={{
                        width: cell.column.columnDef.size,
                        minWidth: cell.column.columnDef.minSize,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="h-24 text-center">
                  No contributors found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="flex-1 text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} contributor(s).
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Page</p>
            <p className="text-sm font-medium">
              {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </p>
          </div>
          <div className="flex items-center space-x-2">
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
      </div>
    </>
  );

  if (!showHeader) {
    return <div className={className}>{tableContent}</div>;
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">{tableContent}</CardContent>
    </Card>
  );
}
