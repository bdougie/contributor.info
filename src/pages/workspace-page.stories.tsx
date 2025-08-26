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
  Menu,
  Package
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

// Mock data for contributors
const mockContributors: Contributor[] = [
  {
    id: '1',
    username: 'johndoe',
    avatar_url: 'https://github.com/johndoe.png',
    name: 'John Doe',
    company: 'Acme Corp',
    location: 'San Francisco, CA',
    contributions: {
      commits: 245,
      pull_requests: 89,
      issues: 45,
      reviews: 123,
      comments: 234,
    },
    stats: {
      total_contributions: 691,
      contribution_trend: 15.5,
      last_active: '2024-01-15T10:30:00Z',
      repositories_contributed: 8,
    },
    is_tracked: true,
  },
  {
    id: '2',
    username: 'janedoe',
    avatar_url: 'https://github.com/janedoe.png',
    name: 'Jane Doe',
    company: 'Tech Inc',
    location: 'New York, NY',
    contributions: {
      commits: 189,
      pull_requests: 67,
      issues: 34,
      reviews: 98,
      comments: 156,
    },
    stats: {
      total_contributions: 544,
      contribution_trend: -5.2,
      last_active: '2024-01-14T15:45:00Z',
      repositories_contributed: 5,
    },
    is_tracked: false,
  },
  {
    id: '3',
    username: 'bobsmith',
    avatar_url: 'https://github.com/bobsmith.png',
    name: 'Bob Smith',
    bio: 'Full-stack developer',
    location: 'Austin, TX',
    contributions: {
      commits: 567,
      pull_requests: 234,
      issues: 89,
      reviews: 345,
      comments: 456,
    },
    stats: {
      total_contributions: 1691,
      contribution_trend: 28.3,
      last_active: '2024-01-16T08:15:00Z',
      repositories_contributed: 12,
    },
    is_tracked: true,
  },
];

// Component wrapper for the Contributors table view
function ContributorsTableView({ 
  contributors = mockContributors,
  viewMode: initialViewMode = 'list'
}: { 
  contributors?: Contributor[];
  viewMode?: 'grid' | 'list';
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(initialViewMode);

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
    {
      id: 'actions',
      size: 100,
      cell: ({ row }) => {
        const isTracked = row.original.is_tracked;
        return (
          <Button
            variant={isTracked ? "outline" : "default"}
            size="sm"
            onClick={() => console.log('Toggle tracking for', row.original.username)}
          >
            {isTracked ? 'Untrack' : 'Track'}
          </Button>
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

  return (
    <div className="space-y-4">
      {/* View Toggle and Search */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contributors</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contributors..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 w-[200px]"
            />
          </div>
          <div className="flex items-center rounded-lg border bg-muted/50 p-1">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="px-3"
              title="Grid view"
            >
              <Package className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="px-3"
              title="List view"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Contributors
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
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
              {table.getRowModel().rows.map((row) => (
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
                      }}
                    >
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

        {/* Pagination */}
        <div className="flex items-center justify-between p-4">
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
      </Card>
    </div>
  );
}

const meta: Meta<typeof ContributorsTableView> = {
  title: 'Pages/Workspace/ContributorsTable',
  component: ContributorsTableView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'The contributors table view from the workspace page, showing contributor activity and tracking status.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="container max-w-7xl mx-auto p-6">
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
    contributors: mockContributors,
    viewMode: 'list',
  },
};

export const EmptyState: Story = {
  args: {
    contributors: [],
    viewMode: 'list',
  },
};

export const GridView: Story = {
  args: {
    contributors: mockContributors,
    viewMode: 'grid',
  },
};

export const ManyContributors: Story = {
  args: {
    contributors: [
      ...mockContributors,
      ...mockContributors.map((c, i) => ({
        ...c,
        id: `${c.id}-duplicate-${i}`,
        username: `${c.username}${i + 2}`,
        name: `${c.name} ${i + 2}`,
      })),
      ...mockContributors.map((c, i) => ({
        ...c,
        id: `${c.id}-duplicate-2-${i}`,
        username: `${c.username}${i + 5}`,
        name: `${c.name} ${i + 5}`,
      })),
    ],
    viewMode: 'list',
  },
};

export const MixedTrackingStatus: Story = {
  args: {
    contributors: mockContributors.map((c, i) => ({
      ...c,
      is_tracked: i % 2 === 0,
    })),
    viewMode: 'list',
  },
};

export const WithHighActivity: Story = {
  args: {
    contributors: mockContributors.map(c => ({
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
    viewMode: 'list',
  },
};