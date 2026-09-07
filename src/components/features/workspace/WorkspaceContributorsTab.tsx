/**
 * Contributors tab component for workspace page
 */

import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import type { User } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useContributorProfileRoute } from '@/hooks/use-contributor-profile-route';
import { useWorkspaceContributors } from '@/hooks/useWorkspaceContributors';
import {
  exportContributorsToCSV,
  exportReviewCorpusToCSV,
  exportReviewCorpusToJSONL,
} from '@/lib/utils/csv-export';
import { fetchContributorReviews } from '@/lib/contributors/fetch-contributor-reviews';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useContributorGroups } from '@/hooks/useContributorGroups';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Plus,
  Users,
  Search,
  Package,
  Menu,
  GitPullRequest,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Download,
} from '@/components/ui/icon';
import { getOrgAvatarUrl } from '@/lib/utils/avatar';
import type { Repository } from '@/components/features/workspace';
import { ContributorsList, type Contributor } from './ContributorsList';
import { ContributorsTable } from './ContributorsTable';

function getAriaSortValue(
  sortDirection: false | 'asc' | 'desc'
): 'ascending' | 'descending' | undefined {
  if (sortDirection === 'asc') return 'ascending';
  if (sortDirection === 'desc') return 'descending';
  return undefined;
}

// Lazy load modal components to reduce initial bundle size
// These modals are only shown on user interaction, so deferring their load is safe
const ContributorGroupManager = lazy(() =>
  import('./ContributorGroupManager').then((m) => ({ default: m.ContributorGroupManager }))
);

const ContributorNotesDialog = lazy(() =>
  import('./ContributorNotesDialog').then((m) => ({ default: m.ContributorNotesDialog }))
);

const ContributorProfileModal = lazy(() =>
  import('./ContributorProfileModal').then((m) => ({ default: m.ContributorProfileModal }))
);

// Minimal fallback - null prevents layout shift during lazy load
// The modal's own loading state handles UX better than a skeleton overlay
function ModalFallback() {
  return null;
}

export interface ActivityItem {
  id: string;
  type: 'pr' | 'issue' | 'commit' | 'review' | 'comment' | 'star' | 'fork';
  title: string;
  author: {
    username: string;
    avatar_url: string;
  };
  repository: string;
  created_at: string;
  status?: 'open' | 'merged' | 'closed' | 'approved' | 'changes_requested';
  url: string;
  metadata?: {
    additions?: number;
    deletions?: number;
    change_amount?: number;
    current_value?: number;
  };
}

interface WorkspaceContributorsTabProps {
  repositories: Repository[];
  selectedRepositories: string[];
  workspaceId: string;
  userRole?: import('@/types/workspace').WorkspaceRole;
  workspaceTier?: import('@/types/workspace').WorkspaceTier;
  isLoggedIn?: boolean;
  currentUser?: User | null;
  activities?: ActivityItem[];
}

export function WorkspaceContributorsTab({
  repositories,
  selectedRepositories,
  workspaceId,
  userRole,
  workspaceTier,
  isLoggedIn,
  currentUser,
  activities = [],
}: WorkspaceContributorsTabProps) {
  const [showAddContributors, setShowAddContributors] = useState(false);
  const [selectedContributorsToAdd, setSelectedContributorsToAdd] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const debouncedSearchQuery = useDebouncedValue(globalFilter, 300);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearchQuery]);

  // CRM State
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const profileRoute = useContributorProfileRoute();
  const profileTriggerRef = useRef<HTMLElement | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);
  const [selectedContributorsForGroups, setSelectedContributorsForGroups] = useState<Set<string>>(
    new Set()
  );
  const [selectedFilterGroup, setSelectedFilterGroup] = useState<string | null>(null);

  const {
    groups,
    groupMembers,
    notes,
    createGroup,
    updateGroup,
    deleteGroup,
    addContributorToGroup,
    removeContributorFromGroup,
    upsertNote,
    updateNoteById,
    deleteNoteById,
  } = useContributorGroups(workspaceId);

  const contributorGroupsByUsername = useMemo(() => {
    const map = new Map<string, string[]>();
    groupMembers.forEach((member) => {
      const current = map.get(member.contributor_username) || [];
      current.push(member.group_id);
      map.set(member.contributor_username, current);
    });
    return map;
  }, [groupMembers]);

  const {
    contributors,
    allAvailableContributors,
    workspaceContributorIds,
    loading,
    error,
    totalCount,
    hasMore,
    addContributorsToWorkspace,
    removeContributorFromWorkspace,
  } = useWorkspaceContributors({
    workspaceId: workspaceId,
    repositories,
    selectedRepositories,
    searchQuery: showAddContributors ? debouncedSearchQuery : '',
    page: showAddContributors ? page : 0,
    pageSize: showAddContributors ? pageSize : 1000,
  });

  const profileContributor = profileRoute.username
    ? [...contributors, ...allAvailableContributors].find(
        (contributor) => contributor.username.toLowerCase() === profileRoute.username?.toLowerCase()
      ) || null
    : null;
  const noteContributor = profileRoute.username ? profileContributor : selectedContributor;

  const transformedNotes = useMemo(() => {
    const contributorUsername = noteContributor?.username;
    if (!contributorUsername) return [];

    return notes
      .filter((note) => note.contributor_username === contributorUsername)
      .map((note) => {
        const createdBy = note.created_by as
          | {
              auth_user_id: string;
              email: string;
              display_name: string;
            }
          | string
          | null;
        const isObject = typeof createdBy === 'object' && createdBy !== null;

        return {
          ...note,
          created_by: {
            id: isObject ? createdBy.auth_user_id : createdBy || 'unknown',
            email: isObject ? createdBy.email : 'unknown@example.com',
            display_name: isObject
              ? createdBy.display_name || createdBy.email?.split('@')[0]
              : 'Unknown User',
            avatar_url: undefined,
          },
        };
      });
  }, [notes, noteContributor?.username]);

  const contributorGroups = useMemo(() => {
    const map = new Map<string, string[]>();
    const usernameToId = new Map<string, string>();
    contributors.forEach((contributor) => {
      usernameToId.set(contributor.username, contributor.id);
    });

    contributorGroupsByUsername.forEach((groupIds, username) => {
      const contributorId = usernameToId.get(username);
      if (contributorId) {
        map.set(contributorId, groupIds);
      }
    });

    return map;
  }, [contributorGroupsByUsername, contributors]);

  const handleContributorClick = (contributor: Contributor) => {
    profileTriggerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedContributor(contributor);
    profileRoute.openProfile(contributor.username);
  };

  const handleTrackContributor = (contributorId: string) => {
    if (showAddContributors) {
      setSelectedContributorsToAdd((prev) =>
        prev.includes(contributorId)
          ? prev.filter((id) => id !== contributorId)
          : [...prev, contributorId]
      );
    }
  };

  const handleUntrackContributor = async (contributorId: string) => {
    await removeContributorFromWorkspace(contributorId);
  };

  const handleAddContributor = () => {
    setShowAddContributors(true);
    setSelectedContributorsToAdd([]);
    setPage(0);
    setGlobalFilter('');
  };

  const handleSubmitContributors = async () => {
    if (selectedContributorsToAdd.length > 0) {
      await addContributorsToWorkspace(selectedContributorsToAdd);
      setShowAddContributors(false);
      setSelectedContributorsToAdd([]);
    } else {
      toast.warning('Please select at least one contributor to add');
    }
  };

  const handleCancelAdd = () => {
    setShowAddContributors(false);
    setSelectedContributorsToAdd([]);
    setPage(0);
    setGlobalFilter('');
  };

  // Group and note handlers
  const handleAddToGroup = (contributorId: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (contributor) {
      setSelectedContributor(contributor);
      if (!selectedContributorsForGroups.has(contributorId)) {
        setSelectedContributorsForGroups(
          new Set([...selectedContributorsForGroups, contributorId])
        );
      }
      setShowGroupManager(true);
    }
  };

  const handleAddNote = (contributorId: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (contributor) {
      setSelectedContributor(contributor);
      setShowNotesDialog(true);
    }
  };

  const handleRemoveContributor = async (contributorId: string) => {
    await removeContributorFromWorkspace(contributorId);
  };

  const handleExport = () => {
    exportContributorsToCSV(filteredContributors, 'contributors.csv');
  };

  const handleExportReviews = async (contributorIds: string[], format: 'jsonl' | 'csv') => {
    const selected = contributors.filter((c) => contributorIds.includes(c.id));
    if (selected.length === 0) {
      toast.warning('Select at least one contributor to export reviews');
      return;
    }

    try {
      const entries = await Promise.all(
        selected.map(async (contributor) => ({
          reviewer: contributor.username,
          reviews: await fetchContributorReviews(contributor.username, workspaceId),
        }))
      );
      const total = entries.reduce((sum, entry) => sum + entry.reviews.length, 0);
      if (total === 0) {
        toast.info('No reviews captured yet for the selected contributors');
        return;
      }

      if (format === 'jsonl') {
        exportReviewCorpusToJSONL(entries);
      } else {
        exportReviewCorpusToCSV(entries);
      }
      toast.success(
        `Exported ${total} review${total === 1 ? '' : 's'} from ${entries.length} contributor${entries.length === 1 ? '' : 's'}`
      );
    } catch (err) {
      console.error('Error exporting reviews:', err);
      toast.error('Failed to export reviews');
    }
  };

  // CRM handler functions
  const handleCreateGroup = async (name: string, description: string) => {
    try {
      await createGroup(name, description);
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    }
  };

  const handleUpdateGroup = async (groupId: string, name: string, description: string) => {
    try {
      await updateGroup(groupId, name, description);
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error('Failed to update group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteGroup(groupId);
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  const handleAddContributorToGroup = async (contributorId: string, groupId: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (!contributor) {
      toast.error('Contributor not found');
      return;
    }

    try {
      await addContributorToGroup(contributor.username, groupId);
    } catch (error) {
      console.error('Error adding contributor to group:', error);
      toast.error('Failed to add contributor to group');
    }
  };

  const handleBulkAddContributorsToGroups = async (
    contributorIds: string[],
    groupIds: string[]
  ) => {
    if (contributorIds.length === 0 || groupIds.length === 0) {
      toast.error('Please select contributors and groups');
      return;
    }

    const selectedContributors = contributors.filter((c) => contributorIds.includes(c.id));
    if (selectedContributors.length !== contributorIds.length) {
      toast.error('Some contributors not found');
      return;
    }

    const newContributorsGroup = groups.find(
      (g) => g.name.toLowerCase().includes('new') || g.name.toLowerCase().includes('topinos')
    );

    try {
      const promises = [];

      for (const contributor of selectedContributors) {
        for (const groupId of groupIds) {
          promises.push(addContributorToGroup(contributor.username, groupId));
        }

        if (newContributorsGroup) {
          const contributorGroupsList = contributorGroups.get(contributor.id) || [];
          const isInNewGroup = contributorGroupsList.includes(newContributorsGroup.id);

          if (isInNewGroup) {
            promises.push(
              removeContributorFromGroup(contributor.username, newContributorsGroup.id)
            );
          }
        }
      }

      await Promise.all(promises);

      const groupNames = groupIds
        .map((id) => groups.find((g) => g.id === id)?.name)
        .filter(Boolean);
      let message = `Added ${selectedContributors.length} contributor${selectedContributors.length === 1 ? '' : 's'} to ${groupNames.length} group${groupNames.length === 1 ? '' : 's'}`;

      if (newContributorsGroup) {
        message += ` and removed from ${newContributorsGroup.name}`;
      }

      toast.success(message);
    } catch (error) {
      console.error('Error adding contributors to groups:', error);
      toast.error('Failed to add contributors to groups');
    }
  };

  const handleRemoveContributorFromGroup = async (contributorId: string, groupId: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (!contributor) {
      toast.error('Contributor not found');
      return;
    }

    try {
      await removeContributorFromGroup(contributor.username, groupId);
    } catch (error) {
      console.error('Error removing contributor from group:', error);
      toast.error('Failed to remove contributor from group');
    }
  };

  const handleAddNoteToContributor = async (contributorId: string, note: string) => {
    const contributor = contributors.find((c) => c.id === contributorId);
    if (!contributor) {
      toast.error('Contributor not found');
      return;
    }

    try {
      await upsertNote(contributor.username, note);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    }
  };

  const handleUpdateNote = async (noteId: string, note: string) => {
    try {
      await updateNoteById(noteId, note);
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await deleteNoteById(noteId);
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  // Define columns for the add contributors table
  const addColumns: ColumnDef<Contributor>[] = [
    {
      id: 'select',
      size: 40,
      header: ({ table }) => (
        <div className="ml-2">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="ml-2">
          <Checkbox
            checked={selectedContributorsToAdd.includes(row.original.id)}
            onCheckedChange={(value) => {
              if (value) {
                setSelectedContributorsToAdd((prev) => [...prev, row.original.id]);
              } else {
                setSelectedContributorsToAdd((prev) => prev.filter((id) => id !== row.original.id));
              }
            }}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'username',
      header: 'Contributor',
      size: 350,
      cell: ({ row }) => {
        const contributor = row.original;
        return (
          <div className="flex items-center gap-3">
            <img
              src={contributor.avatar_url}
              alt={contributor.username}
              className="h-8 w-8 rounded-full"
            />
            <div>
              <p className="font-medium">{contributor.name || contributor.username}</p>
              <p className="text-sm text-muted-foreground">@{contributor.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      id: 'stats',
      header: () => <div className="text-right">Data</div>,
      size: 450,
      cell: ({ row }) => {
        const stats = row.original.contributions;
        const trend = row.original.stats.contribution_trend;
        let trendColor: string;
        if (trend > 0) {
          trendColor = 'text-green-600';
        } else if (trend < 0) {
          trendColor = 'text-red-600';
        } else {
          trendColor = 'text-muted-foreground';
        }
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
                <span className="font-medium">{stats.pull_requests}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{stats.issues}</span>
              </div>
            </div>
            {displayOwners.length > 0 ? (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {displayOwners.map((owner, i) => (
                    <img
                      key={`${owner}_${i}`}
                      src={getOrgAvatarUrl(owner)}
                      alt={`${owner} organization`}
                      className="h-5 w-5 rounded-sm border border-border object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  ))}
                </div>
                {remainingCount > 0 && (
                  <span className="text-xs text-muted-foreground font-medium">
                    +{remainingCount}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">
                {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
              </span>
            )}
            <div className="flex items-center gap-1.5 min-w-[70px] justify-end">
              <TrendIcon className={`h-4 w-4 ${trendColor}`} />
              <span className={`font-medium ${trendColor}`}>
                {trend > 0 ? '+' : ''}
                {trend}%
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  const addTable = useReactTable({
    data: allAvailableContributors,
    columns: addColumns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });

  const filteredContributors = useMemo(() => {
    if (!selectedFilterGroup) {
      return contributors;
    }

    const usernamesInGroup = new Set(
      groupMembers
        .filter((member) => member.group_id === selectedFilterGroup)
        .map((member) => member.contributor_username)
    );

    return contributors.filter((contributor) => usernamesInGroup.has(contributor.username));
  }, [contributors, selectedFilterGroup, groupMembers]);

  if (error && !profileRoute.username) {
    return (
      <div className="w-full min-w-0">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Contributors</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      {showAddContributors ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Add Contributors to Workspace</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {selectedContributorsToAdd.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAdd}
                  className="min-h-[44px] flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitContributors}
                  disabled={selectedContributorsToAdd.length === 0}
                  className="min-h-[44px] flex-1 sm:flex-none"
                >
                  Add Selected
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username or name..."
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-10 min-h-[44px]"
                />
                {loading && globalFilter && (
                  <div className="absolute right-3 top-2.5">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
              {debouncedSearchQuery && (
                <p className="text-sm text-muted-foreground mt-2">
                  Found {totalCount} contributor{totalCount === 1 ? '' : 's'} matching &quot;
                  {debouncedSearchQuery}&quot;
                </p>
              )}
            </div>

            <div className="rounded-md border">
              <table className="w-full" aria-label="Available contributors to add to workspace">
                <thead>
                  {addTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={getAriaSortValue(header.column.getIsSorted())}
                          className="px-4 py-3 text-left font-medium text-sm"
                          style={{
                            width: header.column.columnDef.size,
                            minWidth: header.column.columnDef.size,
                          }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {addTable.getRowModel().rows.length > 0 ? (
                    addTable.getRowModel().rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-4 py-3"
                            style={{
                              width: cell.column.columnDef.size,
                              minWidth: cell.column.columnDef.size,
                            }}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={addColumns.length}
                        className="px-4 py-8 text-center text-muted-foreground"
                      >
                        No contributors found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalCount)} of{' '}
                {totalCount} contributors
                {debouncedSearchQuery && ' (filtered)'}
              </div>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                  disabled={page === 0 || loading}
                  className="min-h-[44px] px-3"
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">‹</span>
                </Button>
                <span className="text-sm px-2">
                  Page {page + 1} of {Math.ceil(totalCount / pageSize) || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!hasMore || loading}
                  className="min-h-[44px] px-3"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">›</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Groups:</span>
              {groups.map((group) => {
                const count = groupMembers.filter((m) => m.group_id === group.id).length;
                const isSelected = selectedFilterGroup === group.id;

                return (
                  <Button
                    key={group.id}
                    variant={isSelected ? 'default' : 'secondary'}
                    size="sm"
                    onClick={() => setSelectedFilterGroup(isSelected ? null : group.id)}
                    className="h-7"
                  >
                    {group.name}
                    <Badge variant="outline" className="ml-1.5 px-1 h-4 text-xs">
                      {count}
                    </Badge>
                  </Button>
                );
              })}
              {selectedFilterGroup && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFilterGroup(null)}
                  className="h-7 text-xs"
                >
                  Clear filter
                </Button>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle>
                    {selectedFilterGroup
                      ? `${groups.find((g) => g.id === selectedFilterGroup)?.name || 'Group'} Contributors`
                      : 'All Contributors'}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {filteredContributors.length} {selectedFilterGroup ? 'filtered ' : ''}
                    {filteredContributors.length === 1 ? 'contributor' : 'contributors'}
                    {selectedFilterGroup && ` • ${contributors.length} total`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">
                    Open a profile to explore contributions, reviews, and AI insights.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 flex-wrap">
                  <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="px-3 min-h-[36px] min-w-[36px]"
                      title="Grid view"
                      aria-label="Grid view"
                      aria-pressed={viewMode === 'grid'}
                    >
                      <Package className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="px-3 min-h-[36px] min-w-[36px]"
                      title="Table view"
                      aria-label="Table view"
                      aria-pressed={viewMode === 'list'}
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => setShowGroupManager(true)}
                    aria-label="Manage Groups"
                    title="Manage Groups"
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] px-3"
                  >
                    <Users className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Manage Groups</span>
                  </Button>
                  <Button
                    onClick={handleExport}
                    aria-label="Export CSV"
                    title="Export CSV"
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] px-3"
                    disabled={filteredContributors.length === 0}
                  >
                    <Download className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                  <Button
                    onClick={handleAddContributor}
                    size="sm"
                    className="min-h-9 min-w-9 px-2 xl:px-3"
                    aria-label="Add Contributors"
                    title="Add Contributors"
                  >
                    <Plus className="h-4 w-4 xl:mr-1.5" aria-hidden="true" />
                    <span className="hidden xl:inline">Add Contributors</span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {viewMode === 'grid' ? (
                <ContributorsList
                  contributors={filteredContributors}
                  trackedContributors={workspaceContributorIds}
                  onTrackContributor={handleTrackContributor}
                  onUntrackContributor={handleUntrackContributor}
                  onContributorClick={handleContributorClick}
                  onAddToGroup={handleAddToGroup}
                  loading={loading}
                  view="grid"
                  showHeader={false}
                />
              ) : (
                <ContributorsTable
                  contributors={filteredContributors}
                  groups={groups}
                  contributorGroups={contributorGroups}
                  loading={loading}
                  onContributorClick={handleContributorClick}
                  onAddToGroup={handleAddToGroup}
                  onBulkAddToGroups={handleBulkAddContributorsToGroups}
                  onExportReviews={handleExportReviews}
                  onAddNote={handleAddNote}
                  onRemoveContributor={handleRemoveContributor}
                  showHeader={false}
                  selectedContributors={selectedContributorsForGroups}
                  onSelectedContributorsChange={setSelectedContributorsForGroups}
                  userRole={userRole}
                  workspaceTier={workspaceTier}
                  isLoggedIn={isLoggedIn}
                  activities={activities}
                />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {showGroupManager && (
        <Suspense fallback={<ModalFallback />}>
          <ContributorGroupManager
            open={showGroupManager}
            onOpenChange={(open) => {
              setShowGroupManager(open);
              if (!open) {
                setSelectedContributorsForGroups(new Set());
              }
            }}
            groups={groups}
            contributors={contributors}
            contributorGroups={contributorGroups}
            selectedContributorId={selectedContributor?.id}
            selectedContributorIds={selectedContributorsForGroups}
            onCreateGroup={handleCreateGroup}
            onUpdateGroup={handleUpdateGroup}
            onDeleteGroup={handleDeleteGroup}
            onAddContributorToGroup={handleAddContributorToGroup}
            onRemoveContributorFromGroup={handleRemoveContributorFromGroup}
            userRole={userRole}
            workspaceTier={workspaceTier}
            isLoggedIn={isLoggedIn}
          />
        </Suspense>
      )}

      {showNotesDialog && (
        <Suspense fallback={<ModalFallback />}>
          <ContributorNotesDialog
            open={showNotesDialog}
            onOpenChange={setShowNotesDialog}
            contributor={selectedContributor}
            notes={transformedNotes}
            loading={false}
            currentUserId={currentUser?.id}
            onAddNote={handleAddNoteToContributor}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />
        </Suspense>
      )}

      {profileRoute.username && (
        <Suspense fallback={<ModalFallback />}>
          <ContributorProfileModal
            key={profileRoute.username}
            open={true}
            onOpenChange={(open) => {
              if (!open) profileRoute.closeProfile();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (showGroupManager || showNotesDialog) return;
              // Table cells can remount when their column callbacks change. Find the
              // current trigger when the element captured on open is no longer attached.
              const trigger = profileTriggerRef.current?.isConnected
                ? profileTriggerRef.current
                : document.querySelector<HTMLElement>(
                    `[data-contributor-profile="${CSS.escape(profileRoute.username || '')}"]`
                  );
              trigger?.focus();
            }}
            contributor={profileContributor}
            contributorUsername={profileRoute.username}
            loading={loading}
            error={error}
            activeTab={profileRoute.activeTab}
            onTabChange={profileRoute.setActiveTab}
            groups={groups}
            contributorGroups={contributorGroups.get(profileContributor?.id || '') || []}
            notes={transformedNotes}
            workspaceId={workspaceId}
            onManageGroups={() => {
              setSelectedContributor(profileContributor);
              profileRoute.closeProfile();
              if (profileContributor) {
                setSelectedContributorsForGroups(new Set([profileContributor.id]));
              }
              setShowGroupManager(true);
            }}
            onAddNote={() => {
              setSelectedContributor(profileContributor);
              profileRoute.closeProfile();
              setShowNotesDialog(true);
            }}
            userRole={userRole}
            workspaceTier={workspaceTier}
            isLoggedIn={isLoggedIn}
          />
        </Suspense>
      )}
    </div>
  );
}
