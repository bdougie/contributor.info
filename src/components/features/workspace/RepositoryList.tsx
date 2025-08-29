import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Star,
  GitPullRequest,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  Target,
  MoreHorizontal,
  Settings,
} from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, humanizeNumber } from '@/lib/utils';
import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';

export interface Repository {
  id: string;
  full_name: string;
  owner: string;
  name: string;
  description?: string;
  language?: string;
  stars: number;
  forks: number;
  open_prs: number;
  open_issues: number;
  contributors: number;
  last_activity: string;
  is_pinned?: boolean;
  avatar_url?: string;
  html_url: string;
}

export interface RepositoryListProps {
  repositories: Repository[];
  loading?: boolean;
  onRepositoryClick?: (repo: Repository) => void;
  onPinToggle?: (repo: Repository) => void;
  onRemove?: (repo: Repository) => void;
  onAddRepository?: () => void;
  showActions?: boolean;
  className?: string;
  emptyMessage?: string;
}

const columnHelper = createColumnHelper<Repository>();

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

export function RepositoryList({
  repositories,
  loading = false,
  onRepositoryClick,
  onPinToggle,
  onRemove,
  onAddRepository,
  showActions = true,
  className,
  emptyMessage = 'No repositories in this workspace yet',
}: RepositoryListProps) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'is_pinned', desc: true },
    { id: 'last_activity', desc: true },
  ]);

  const columns = useMemo<ColumnDef<Repository>[]>(() => {
    const cols: ColumnDef<Repository>[] = [
      columnHelper.accessor('full_name', {
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Repository
              {column.getIsSorted() === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === 'desc' ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
            </button>
          );
        },
        cell: ({ row }) => {
          const repo = row.original;
          return (
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={repo.avatar_url} alt={repo.owner} />
                  <AvatarFallback>{repo.owner.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {repo.is_pinned && (
                  <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-muted rounded-full flex items-center justify-center border border-background">
                    <Target className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{repo.full_name}</span>
                  {repo.language && (
                    <Badge variant="outline" className="text-xs flex-shrink-0">
                      {repo.language}
                    </Badge>
                  )}
                </div>
                {repo.description && (
                  <p className="text-xs text-muted-foreground truncate max-w-md">
                    {repo.description}
                  </p>
                )}
              </div>
            </div>
          );
        },
        enableSorting: true,
        enableGlobalFilter: true,
      }),
      columnHelper.accessor('stars', {
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              <Star className="h-3 w-3" />
              Stars
              {column.getIsSorted() === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === 'desc' ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
            </button>
          );
        },
        cell: ({ getValue }) => {
          const stars = getValue();
          return <span className="tabular-nums font-medium">{humanizeNumber(stars)}</span>;
        },
        enableSorting: true,
      }),
      columnHelper.accessor('open_prs', {
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              <GitPullRequest className="h-3 w-3" />
              PRs
              {column.getIsSorted() === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === 'desc' ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
            </button>
          );
        },
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{humanizeNumber(getValue())}</span>
        ),
        enableSorting: true,
      }),
      columnHelper.accessor('contributors', {
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              <Users className="h-3 w-3" />
              Contributors
              {column.getIsSorted() === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === 'desc' ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
            </button>
          );
        },
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">{humanizeNumber(getValue())}</span>
        ),
        enableSorting: true,
      }),
      columnHelper.accessor('last_activity', {
        header: ({ column }) => {
          return (
            <button
              className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            >
              Last Activity
              {column.getIsSorted() === 'asc' ? (
                <ChevronUp className="h-3 w-3" />
              ) : column.getIsSorted() === 'desc' ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronsUpDown className="h-3 w-3" />
              )}
            </button>
          );
        },
        cell: ({ getValue }) => (
          <span className="text-muted-foreground whitespace-nowrap">{formatDate(getValue())}</span>
        ),
        enableSorting: true,
      }),
      // Hidden column for pinned state (used for sorting)
      columnHelper.accessor('is_pinned', {
        header: () => null,
        cell: () => null,
        enableSorting: true,
        enableHiding: true,
      }),
    ];

    if (showActions) {
      cols.push(
        columnHelper.display({
          id: 'actions',
          cell: ({ row }) => {
            const repo = row.original;
            return (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onRepositoryClick?.(repo)}>
                    <ExternalLink className="mr-2 h-3 w-3" />
                    View repo page
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPinToggle?.(repo)}>
                    <Target className="mr-2 h-3 w-3" />
                    {repo.is_pinned ? 'Unpin' : 'Pin'} repository
                  </DropdownMenuItem>
                  {onRemove && (
                    <DropdownMenuItem onClick={() => onRemove(repo)} className="text-destructive">
                      Remove from workspace
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        })
      );
    }

    return cols;
  }, [showActions, onPinToggle, onRemove]);

  const table = useReactTable({
    data: repositories,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // Custom sorting for pinned items
    sortingFns: {
      auto: (rowA, rowB, columnId) => {
        // Pinned items always come first
        if (columnId === 'is_pinned') {
          const a = rowA.getValue(columnId) as boolean;
          const b = rowB.getValue(columnId) as boolean;
          if (a && !b) return 1;
          if (!a && b) return -1;
          return 0;
        }
        // Default sorting for other columns
        return 0;
      },
    },
  });

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Repositories</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{repositories.length} total</Badge>
            {onAddRepository && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAddRepository}
                className="h-7"
                title="Manage repositories"
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search repositories..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {table.getRowModel().rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        // Skip the hidden is_pinned column
                        if (header.column.id === 'is_pinned') return null;

                        return (
                          <TableHead
                            key={header.id}
                            className={cn(
                              header.column.id === 'full_name' && 'w-[40%] min-w-[250px]',
                              header.column.id === 'stars' && 'w-[15%] min-w-[100px] text-right',
                              header.column.id === 'open_prs' && 'w-[10%] min-w-[80px] text-right',
                              header.column.id === 'contributors' &&
                                'w-[15%] min-w-[120px] text-right',
                              header.column.id === 'last_activity' && 'w-[15%] min-w-[120px]',
                              header.column.id === 'actions' && 'w-[5%] min-w-[50px]'
                            )}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        'cursor-pointer hover:bg-muted/50',
                        row.original.is_pinned && 'bg-muted/30'
                      )}
                      onClick={(e) => {
                        // Don't trigger row click if clicking on action buttons
                        if (!(e.target as HTMLElement).closest('[role="button"]')) {
                          onRepositoryClick?.(row.original);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        // Skip the hidden is_pinned column
                        if (cell.column.id === 'is_pinned') return null;

                        return (
                          <TableCell
                            key={cell.id}
                            onClick={(e) => {
                              // Prevent row click for action column
                              if (cell.column.id === 'actions') {
                                e.stopPropagation();
                              }
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RepositoryListSkeleton({ className }: { className?: string }) {
  return <RepositoryList repositories={[]} loading={true} className={className} />;
}
