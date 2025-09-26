import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Users, Plus, Settings, AlertCircle } from '@/components/ui/icon';
import { GroupManagementCTA } from '@/components/ui/permission-upgrade-cta';
import { useGroupManagementPermissions } from '@/hooks/useWorkspacePermissions';
import type { ContributorGroup } from './ContributorsTable';
import type { Contributor } from './ContributorsList';
import type { WorkspaceRole, WorkspaceTier } from '@/types/workspace';

export interface ContributorGroupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ContributorGroup[];
  contributors: Contributor[];
  contributorGroups: Map<string, string[]>; // contributorId -> groupIds[]
  selectedContributorId?: string; // If managing groups for a specific contributor
  selectedContributorIds?: Set<string>; // Multiple selected contributors for bulk operations
  onCreateGroup: (name: string, description: string) => Promise<void>;
  onUpdateGroup: (groupId: string, name: string, description: string) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onAddContributorToGroup: (contributorId: string, groupId: string) => Promise<void>;
  onRemoveContributorFromGroup: (contributorId: string, groupId: string) => Promise<void>;
  // Permission context
  userRole?: WorkspaceRole;
  workspaceTier?: WorkspaceTier;
  isLoggedIn?: boolean;
}

export function ContributorGroupManager({
  open,
  onOpenChange,
  groups,
  contributors,
  contributorGroups,
  selectedContributorId,
  selectedContributorIds,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddContributorToGroup,
  onRemoveContributorFromGroup,
  userRole,
  workspaceTier,
  isLoggedIn = false,
}: ContributorGroupManagerProps) {
  // Determine selected contributors - prioritize multiple selection over single
  const hasSelection = selectedContributorIds?.size || selectedContributorId;
  const [activeTab, setActiveTab] = useState(hasSelection ? 'assign' : 'manage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Permission checks
  const permissions = useGroupManagementPermissions({
    userRole,
    workspaceTier,
    isLoggedIn,
  });

  // Create group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');

  // Edit group state
  const [editingGroup, setEditingGroup] = useState<ContributorGroup | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Assignment state - removed as not used in current implementation

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onCreateGroup(newGroupName, newGroupDescription);
      setNewGroupName('');
      setNewGroupDescription('');
      setActiveTab('manage');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !editName.trim()) return;

    setLoading(true);
    setError(null);

    try {
      await onUpdateGroup(editingGroup.id, editName, editDescription);
      setEditingGroup(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;

    setLoading(true);
    setError(null);

    try {
      await onDeleteGroup(groupId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  const startEditingGroup = (group: ContributorGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDescription(''); // Add description field to group type
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Contributor Groups</DialogTitle>
          <DialogDescription>
            Create and manage groups to organize your contributors
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manage">Manage Groups</TabsTrigger>
            <TabsTrigger value="create">Create Group</TabsTrigger>
            <TabsTrigger value="assign">Assign Contributors</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-4">
            {!permissions.canManageGroups ? (
              <GroupManagementCTA
                message={permissions.getGroupManagementMessage()}
                variant="card"
                size="md"
              />
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                {groups.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-2 text-sm font-semibold">No groups yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Create your first group to start organizing contributors
                    </p>
                    <Button className="mt-4" onClick={() => setActiveTab('create')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Group
                    </Button>
                  </div>
                ) : (
                <div className="space-y-2">
                  {groups.map((group) => {
                    const memberCount = contributors.filter((c) =>
                      (contributorGroups.get(c.id) || []).includes(group.id)
                    ).length;

                    if (editingGroup?.id === group.id) {
                      return (
                        <div key={group.id} className="p-4 border rounded-lg space-y-3">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Group name"
                            disabled={loading}
                          />
                          <Textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                            disabled={loading}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdateGroup} disabled={loading}>
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingGroup(null)}
                              disabled={loading}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={group.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{group.name}</Badge>
                          {group.is_system && (
                            <Badge variant="outline" className="text-xs">
                              System
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                        {!group.is_system && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingGroup(group)}
                              disabled={loading}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGroup(group.id)}
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
            {!permissions.canManageGroups ? (
              <GroupManagementCTA
                message={permissions.getGroupManagementMessage()}
                variant="card"
                size="md"
              />
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g., Core Maintainers"
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder="Describe the purpose of this group..."
                    rows={3}
                    disabled={loading}
                  />
                </div>
                <Button
                  onClick={handleCreateGroup}
                  disabled={loading || !newGroupName.trim()}
                  className="w-full"
                >
                  Create Group
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="assign" className="space-y-4">
            {!permissions.canAssignContributorsToGroups ? (
              <GroupManagementCTA
                message={permissions.getGroupAssignmentMessage()}
                variant="card"
                size="md"
              />
            ) : (
              <div className="space-y-4">
                {/* Determine which contributors are selected */}
                {(() => {
                  // Use selectedContributorIds if available, otherwise fall back to single selectedContributorId
                  const selectedIds = selectedContributorIds?.size
                    ? Array.from(selectedContributorIds)
                    : selectedContributorId
                      ? [selectedContributorId]
                      : [];

                  if (selectedIds.length === 0) {
                    return (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No contributors selected. Please select contributors from the table to manage their group assignments.
                        </AlertDescription>
                      </Alert>
                    );
                  }

                  const selectedContributorsList = contributors.filter((c) => selectedIds.includes(c.id));

                  return (
                    <div className="space-y-3">
                      {/* Show selected contributors */}
                      <div className="p-3 border rounded-lg">
                        <Label className="text-sm mb-2 block">Selected Contributors ({selectedContributorsList.length})</Label>
                        <div className="flex flex-wrap gap-2">
                          {selectedContributorsList
                            .map((contributor) => (
                              <div key={contributor.id} className="flex items-center gap-2 p-1 border rounded">
                                <img
                                  src={contributor.avatar_url}
                                  alt={contributor.username}
                                  className="h-6 w-6 rounded-full"
                                />
                                <span className="text-sm">@{contributor.username}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      <div>
                        <Label>Assign to Groups</Label>
                        <ScrollArea className="h-[300px] mt-2">
                          {groups.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-sm text-muted-foreground">
                                No groups available. Create a group first.
                              </p>
                            </div>
                          ) : (
                            groups.map((group) => {
                              // Check if ALL selected contributors are in this group
                              const allInGroup = selectedIds.every((id) =>
                                (contributorGroups.get(id) || []).includes(group.id)
                              );
                              // Check if SOME (but not all) are in this group
                              const someInGroup = selectedIds.some((id) =>
                                (contributorGroups.get(id) || []).includes(group.id)
                              ) && !allInGroup;

                              return (
                                <div
                                  key={group.id}
                                  className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded"
                                >
                                  <Checkbox
                                    id={`group-${group.id}`}
                                    checked={someInGroup ? 'indeterminate' : allInGroup}
                                    onCheckedChange={async (checked) => {
                                      // If indeterminate (some selected), checking means select all
                                      const shouldAdd = someInGroup || checked;

                                      // Handle bulk assignment/removal
                                      for (const contributorId of selectedIds) {
                                        const currentlyInGroup = (contributorGroups.get(contributorId) || []).includes(group.id);
                                        if (shouldAdd && !currentlyInGroup) {
                                          await onAddContributorToGroup(contributorId, group.id);
                                        } else if (!shouldAdd && currentlyInGroup) {
                                          await onRemoveContributorFromGroup(contributorId, group.id);
                                        }
                                      }
                                    }}
                                    disabled={loading}
                                  />
                                  <label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary">{group.name}</Badge>
                                      {group.is_system && (
                                        <Badge variant="outline" className="text-xs">
                                          System
                                        </Badge>
                                      )}
                                      <span className="text-xs text-muted-foreground">
                                        ({contributors.filter((c) =>
                                          (contributorGroups.get(c.id) || []).includes(group.id)
                                        ).length} members)
                                      </span>
                                    </div>
                                  </label>
                                </div>
                              );
                            })
                          )}
                        </ScrollArea>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
