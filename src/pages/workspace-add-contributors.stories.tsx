import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  GitPullRequest, 
  AlertCircle, 
  Plus,
  TrendingUp, 
  TrendingDown, 
  Search,
  X
} from '@/components/ui/icon';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { useState } from 'react';
import type { Contributor } from '@/components/features/workspace/ContributorsList';

// Mock data for available contributors
const mockAvailableContributors: Contributor[] = [
  {
    id: '4',
    username: 'alice',
    avatar_url: 'https://github.com/alice.png',
    name: 'Alice Johnson',
    company: 'StartupCo',
    location: 'Seattle, WA',
    contributions: {
      commits: 156,
      pull_requests: 45,
      issues: 23,
      reviews: 67,
      comments: 89,
    },
    stats: {
      total_contributions: 380,
      contribution_trend: 12.3,
      last_active: '2024-01-16T14:20:00Z',
      repositories_contributed: 4,
    },
  },
  {
    id: '5',
    username: 'charlie',
    avatar_url: 'https://github.com/charlie.png',
    name: 'Charlie Wilson',
    bio: 'DevOps Engineer',
    location: 'Denver, CO',
    contributions: {
      commits: 423,
      pull_requests: 156,
      issues: 67,
      reviews: 234,
      comments: 345,
    },
    stats: {
      total_contributions: 1225,
      contribution_trend: -8.7,
      last_active: '2024-01-15T09:45:00Z',
      repositories_contributed: 9,
    },
  },
  {
    id: '6',
    username: 'diana',
    avatar_url: 'https://github.com/diana.png',
    name: 'Diana Prince',
    company: 'Tech Giants Inc',
    contributions: {
      commits: 789,
      pull_requests: 345,
      issues: 123,
      reviews: 456,
      comments: 567,
    },
    stats: {
      total_contributions: 2280,
      contribution_trend: 45.2,
      last_active: '2024-01-16T16:30:00Z',
      repositories_contributed: 15,
    },
  },
  {
    id: '7',
    username: 'edward',
    avatar_url: 'https://github.com/edward.png',
    name: 'Edward Norton',
    location: 'Boston, MA',
    contributions: {
      commits: 234,
      pull_requests: 89,
      issues: 45,
      reviews: 123,
      comments: 167,
    },
    stats: {
      total_contributions: 658,
      contribution_trend: 0,
      last_active: '2024-01-14T11:15:00Z',
      repositories_contributed: 6,
    },
  },
];

// Component wrapper for the Add Contributors table view
function AddContributorsTableView({ 
  contributors = mockAvailableContributors,
  onClose = () => console.log('Close clicked'),
  onAddSelected = (ids: string[]) => console.log('Adding contributors:', ids)
}: { 
  contributors?: Contributor[];
  onClose?: () => void;
  onAddSelected?: (contributorIds: string[]) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});

  const columns: ColumnDef<Contributor>[] = [
    {
      id: 'select',
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
    },
    {
      accessorKey: 'username',
      size: 250,
      header: 'Contributor',
      cell: ({ row }) => {
        const contributor = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={contributor.avatar_url}
              alt={contributor.username}
              className="h-10 w-10 rounded-full"
            />
            <div className="flex flex-col">
              <span className="font-medium">{contributor.name || contributor.username}</span>
              <span className="text-sm text-muted-foreground">@{contributor.username}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'activity',
      size: 350,
      header: () => <div className="text-right">Activity</div>,
      cell: ({ row }) => {
        const stats = row.original.stats;
        const contributions = row.original.contributions;
        const trend = stats.contribution_trend;
        const trendColor = trend > 0 ? "text-green-600" : trend < 0 ? "text-red-600" : "text-muted-foreground";
        const TrendIcon = trend > 0 ? TrendingUp : TrendingDown;
        
        const repoCount = row.original.stats.repositories_contributed;
        const repoOwners: string[] = [];
        const maxDisplay = 4;
        const displayOwners = repoOwners.slice(0, maxDisplay);
        const remainingCount = Math.max(0, repoCount - maxDisplay);
        
        return (
          <div className="flex items-center justify-end gap-6 text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <GitPullRequest className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{contributions.pull_requests}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{contributions.issues}</span>
              </div>
            </div>
            {displayOwners.length > 0
? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {displayOwners.map((owner, i) => (
                    <img
                      key={`${owner}_${i}`}
                      src={`https://github.com/${owner}.png?size=40`}
                      alt={`${owner} organization`}
                      className="h-5 w-5 rounded-sm border border-border object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
                {remainingCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    +{remainingCount}
                  </span>
                )}
              </div>
            )
: (
              <div className="text-xs text-muted-foreground">
                {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
              </div>
            )}
            <div className="flex items-center gap-1">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`text-sm font-medium ${trendColor}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: contributors,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection: selectedRows,
    },
    onRowSelectionChange: setSelectedRows,
  });

  const selectedCount = Object.keys(selectedRows).filter(key => selectedRows[key]).length;

  const handleAddSelected = () => {
    const selectedIds = Object.keys(selectedRows)
      .filter(key => selectedRows[key])
      .map(index => contributors[parseInt(index)]?.id)
      .filter(Boolean);
    onAddSelected(selectedIds);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Add Contributors to Workspace</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Actions */}
        <div className="flex items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contributors..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            {selectedCount > 0 && (
              <span className="text-sm text-muted-foreground">
                {selectedCount} selected
              </span>
            )}
            <Button
              onClick={handleAddSelected}
              disabled={selectedCount === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add {selectedCount > 0 ? `${selectedCount} ` : ''}Contributors
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium text-sm"
                      style={{
                        width: header.column.columnDef.size,
                        minWidth: header.column.columnDef.size,
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0
? (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td 
                        key={cell.id} 
                        className="px-4 py-3"
                        style={{
                          width: cell.column.columnDef.size,
                          minWidth: cell.column.columnDef.size,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )
: (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                    No contributors found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {table.getState().pagination.pageIndex * 10 + 1} to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * 10,
              contributors.length
            )}{" "}
            of {contributors.length} contributors
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const meta: Meta<typeof AddContributorsTableView> = {
  title: 'Pages/Workspace/AddContributorsTable',
  component: AddContributorsTableView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'The add contributors table view that appears when adding new contributors to a workspace.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="container max-w-4xl mx-auto p-6">
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    contributors: mockAvailableContributors,
  },
};

export const EmptyState: Story = {
  args: {
    contributors: [],
  },
};

export const WithManyContributors: Story = {
  args: {
    contributors: [
      ...mockAvailableContributors,
      ...mockAvailableContributors.map((c, i) => ({
        ...c,
        id: `${c.id}-duplicate-${i}`,
        username: `${c.username}${i + 2}`,
        name: `${c.name} ${i + 2}`,
      })),
      ...mockAvailableContributors.map((c, i) => ({
        ...c,
        id: `${c.id}-duplicate-2-${i}`,
        username: `${c.username}${i + 5}`,
        name: `${c.name} ${i + 5}`,
      })),
    ],
  },
};

export const WithHighActivityContributors: Story = {
  args: {
    contributors: mockAvailableContributors.map(c => ({
      ...c,
      contributions: {
        commits: Math.floor(Math.random() * 1000) + 500,
        pull_requests: Math.floor(Math.random() * 300) + 100,
        issues: Math.floor(Math.random() * 200) + 50,
        reviews: Math.floor(Math.random() * 400) + 200,
        comments: Math.floor(Math.random() * 500) + 300,
      },
      stats: {
        ...c.stats,
        total_contributions: Math.floor(Math.random() * 3000) + 1500,
        contribution_trend: (Math.random() - 0.5) * 100,
        repositories_contributed: Math.floor(Math.random() * 20) + 5,
      },
    })),
  },
};

export const SingleContributor: Story = {
  args: {
    contributors: [mockAvailableContributors[0]],
  },
};