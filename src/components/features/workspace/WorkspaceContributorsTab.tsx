/**
 * Contributors tab component for workspace page
 */

import { useState, useEffect, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useWorkspaceContributors } from '@/hooks/useWorkspaceContributors';
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
import { Plus, Users, Search, Package, Menu, GitPullRequest, AlertCircle, TrendingUp, TrendingDown } from '@/components/ui/icon';
import { getOrgAvatarUrl } from '@/lib/utils/avatar';
import type { Repository } from '@/components/features/workspace';
import type {
  Contributor,
  ContributorGroup,
  ContributorNote,
} from '@/types/contributor';
import { ContributorsList } from './ContributorsList';
import { ContributorsTable } from './ContributorsTable';
import { ContributorGroupManager } from './ContributorGroupManager';
import { ContributorNotesDialog } from './ContributorNotesDialog';
import { ContributorProfileModal } from './ContributorProfileModal';

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
  const navigate = useNavigate();
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
  const [showProfileModal, setShowProfileModal] = useState(false);
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

  const transformedNotes = useMemo(() => {
    const contributorUsername = selectedContributor?.username;
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
  }, [notes, selectedContributor?.username]);

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
    setSelectedContributor(contributor);
    setShowProfileModal(true);
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

  if (error) {
    return (
      <div className="container max-w-7xl mx-auto">
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
    <div className="container max-w-7xl mx-auto">
      {showAddContributors ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Add Contributors to Workspace</CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-sm text-muted-foreground">
                  {selectedContributorsToAdd.length} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelAdd}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmitContributors}
                  disabled={selectedContributorsToAdd.length === 0}
                  className="min-h-[44px]"
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
              <table className="w-full">
                <thead>
                  {addTable.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id} className="border-b">
                      {headerGroup.headers.map((header) => (
                        <th
                          key={header.id}
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

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
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
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-lg border bg-muted/50 p-1">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="px-3 min-h-[36px] min-w-[36px]"
                      title="Grid view"
                    >
                      <Package className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="px-3 min-h-[36px] min-w-[36px]"
                      title="Table view"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={() => setShowGroupManager(true)}
                    size="sm"
                    variant="outline"
                    className="min-h-[36px] px-3"
                  >
                    <Users className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Manage Groups</span>
                    <span className="sm:hidden">Groups</span>
                  </Button>
                  <Button onClick={handleAddContributor} size="sm" className="min-h-[36px] px-3">
                    <Plus className="h-4 w-4 mr-1.5" />
                    <span className="hidden sm:inline">Add Contributors</span>
                    <span className="sm:hidden">Add</span>
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

      <ContributorProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        contributor={selectedContributor}
        groups={groups}
        contributorGroups={contributorGroups.get(selectedContributor?.id || '') || []}
        notes={transformedNotes}
        workspaceId={workspaceId}
        onManageGroups={() => {
          setShowProfileModal(false);
          if (selectedContributor) {
            setSelectedContributorsForGroups(new Set([selectedContributor.id]));
          }
          setShowGroupManager(true);
        }}
        onAddNote={() => {
          setShowProfileModal(false);
          setShowNotesDialog(true);
        }}
        userRole={userRole}
        workspaceTier={workspaceTier}
        isLoggedIn={isLoggedIn}
      />
    </div>
  );
}
