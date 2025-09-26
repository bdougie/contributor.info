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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Users, Plus, Settings, AlertCircle } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { ContributorGroup } from './ContributorsTable';
import type { Contributor } from './ContributorsList';

export interface ContributorGroupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ContributorGroup[];
  contributors: Contributor[];
  contributorGroups: Map<string, string[]>; // contributorId -> groupIds[]
  selectedContributorId?: string; // If managing groups for a specific contributor
  onCreateGroup: (name: string, description: string, color: string) => Promise<void>;
  onUpdateGroup: (
    groupId: string,
    name: string,
    description: string,
    color: string
  ) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onAddContributorToGroup: (contributorId: string, groupId: string) => Promise<void>;
  onRemoveContributorFromGroup: (contributorId: string, groupId: string) => Promise<void>;
}

const GROUP_COLORS = [
  { value: 'default', label: 'Primary', preview: 'bg-primary' },
  { value: 'secondary', label: 'Secondary', preview: 'bg-secondary' },
  { value: 'outline', label: 'Outline', preview: 'bg-border' },
  { value: 'destructive', label: 'Destructive', preview: 'bg-destructive' },
] as const;

export function ContributorGroupManager({
  open,
  onOpenChange,
  groups,
  contributors,
  contributorGroups,
  selectedContributorId,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onAddContributorToGroup,
  onRemoveContributorFromGroup,
}: ContributorGroupManagerProps) {
  const [activeTab, setActiveTab] = useState(selectedContributorId ? 'assign' : 'manage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupColor, setNewGroupColor] = useState<string>('secondary');

  // Edit group state
  const [editingGroup, setEditingGroup] = useState<ContributorGroup | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState<string>('secondary');

  // Assignment state - removed as not used in current implementation

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onCreateGroup(newGroupName, newGroupDescription, newGroupColor);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupColor('secondary');
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
      await onUpdateGroup(editingGroup.id, editName, editDescription, editColor);
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

  const toggleContributorInGroup = async (contributorId: string, groupId: string) => {
    const currentGroups = contributorGroups.get(contributorId) || [];
    const isInGroup = currentGroups.includes(groupId);

    setLoading(true);
    setError(null);

    try {
      if (isInGroup) {
        await onRemoveContributorFromGroup(contributorId, groupId);
      } else {
        await onAddContributorToGroup(contributorId, groupId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group membership');
    } finally {
      setLoading(false);
    }
  };

  const startEditingGroup = (group: ContributorGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDescription(''); // Add description field to group type
    setEditColor(group.color);
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
                          <Select value={editColor} onValueChange={setEditColor} disabled={loading}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {GROUP_COLORS.map((color) => (
                                <SelectItem key={color.value} value={color.value}>
                                  <div className="flex items-center gap-2">
                                    <div className={cn('h-3 w-3 rounded', color.preview)} />
                                    {color.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                          <Badge variant={group.color}>{group.name}</Badge>
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
          </TabsContent>

          <TabsContent value="create" className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select value={newGroupColor} onValueChange={setNewGroupColor} disabled={loading}>
                  <SelectTrigger id="color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_COLORS.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={cn('h-3 w-3 rounded', color.preview)} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateGroup}
                disabled={loading || !newGroupName.trim()}
                className="w-full"
              >
                Create Group
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="assign" className="space-y-4">
            <div className="space-y-4">
              {selectedContributorId ? (
                // Single contributor mode
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    {contributors
                      .filter((c) => c.id === selectedContributorId)
                      .map((contributor) => (
                        <div key={contributor.id} className="flex items-center gap-3">
                          <img
                            src={contributor.avatar_url}
                            alt={contributor.username}
                            className="h-8 w-8 rounded-full"
                          />
                          <div>
                            <p className="font-medium">
                              {contributor.name || contributor.username}
                            </p>
                            <p className="text-sm text-muted-foreground">@{contributor.username}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                  <Label>Assign to Groups</Label>
                  <ScrollArea className="h-[300px]">
                    {groups.map((group) => {
                      const isInGroup = (
                        contributorGroups.get(selectedContributorId) || []
                      ).includes(group.id);
                      return (
                        <div
                          key={group.id}
                          className="flex items-center space-x-2 p-2 hover:bg-muted/50 rounded"
                        >
                          <Checkbox
                            id={`group-${group.id}`}
                            checked={isInGroup}
                            onCheckedChange={() =>
                              toggleContributorInGroup(selectedContributorId, group.id)
                            }
                            disabled={loading}
                          />
                          <label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <Badge variant={group.color}>{group.name}</Badge>
                              {group.is_system && (
                                <Badge variant="outline" className="text-xs">
                                  System
                                </Badge>
                              )}
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </ScrollArea>
                </div>
              ) : (
                // Multi-select mode
                <div className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h3 className="mt-2 text-sm font-semibold">
                    Select contributors to manage groups
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose contributors from the table to assign them to groups
                  </p>
                </div>
              )}
            </div>
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
