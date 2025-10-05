import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Check, Copy } from '@/components/ui/icon';
import { MembersTab } from './MembersTab';
import { supabase } from '@/lib/supabase';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspacePermissionService } from '@/services/workspace-permissions.service';
import type { Workspace, WorkspaceMember, WorkspaceVisibility } from '@/types/workspace';
import { WorkspaceBackfillManager } from '../WorkspaceBackfillManager';

interface Repository {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  stargazers_count?: number;
  forks_count?: number;
}

interface WorkspaceSettingsProps {
  workspace: Workspace;
  currentMember: WorkspaceMember;
  memberCount: number;
  repositories?: Repository[];
  onWorkspaceUpdate?: (workspace: Workspace) => void;
}

export function WorkspaceSettings({
  workspace,
  currentMember,
  memberCount,
  repositories = [],
  onWorkspaceUpdate,
}: WorkspaceSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state for general settings
  const [formData, setFormData] = useState({
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description || '',
    visibility: workspace.visibility,
    notifications: {
      email: workspace.settings?.notifications?.email ?? true,
      in_app: workspace.settings?.notifications?.in_app ?? true,
    },
  });

  // Get UI permissions based on role and tier
  const permissions = WorkspacePermissionService.getUIPermissions(
    currentMember.role,
    workspace,
    memberCount
  );

  // Handle form changes
  const handleInputChange = (field: string, value: string | boolean) => {
    if (field.startsWith('notifications.')) {
      const notificationField = field.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          [notificationField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  // Save general settings
  const handleSaveGeneralSettings = async () => {
    if (!permissions.canEditSettings) {
      toast({
        title: 'Permission Denied',
        description: 'You do not have permission to edit workspace settings',
        variant: 'destructive',
      });
      return;
    }

    // Validate slug format
    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(formData.slug)) {
      toast({
        title: 'Invalid Slug',
        description: 'Slug can only contain lowercase letters, numbers, and hyphens',
        variant: 'destructive',
      });
      return;
    }

    // Check if slug is being changed and show warning
    if (formData.slug !== workspace.slug) {
      const confirmed = window.confirm(
        '⚠️ WARNING: Changing your workspace slug will break all existing external links!\n\n' +
          `Current URL: /i/${workspace.slug}\n` +
          `New URL: /i/${formData.slug}\n\n` +
          'All bookmarks, shared links, and external references will stop working.\n\n' +
          'Are you sure you want to continue?'
      );

      if (!confirmed) {
        // Reset slug to original value
        setFormData((prev) => ({ ...prev, slug: workspace.slug }));
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await WorkspaceService.updateWorkspace(workspace.id, currentMember.user_id, {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || undefined,
        visibility: formData.visibility as WorkspaceVisibility,
        settings: {
          ...workspace.settings,
          notifications: formData.notifications,
        },
      });

      if (response.success && response.data) {
        toast({
          title: 'Settings Saved',
          description: 'Workspace settings have been updated successfully',
        });
        onWorkspaceUpdate?.(response.data);
      } else {
        throw new Error(response.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete workspace
  const handleDeleteWorkspace = async () => {
    if (!permissions.canDeleteWorkspace) {
      toast({
        title: 'Permission Denied',
        description: 'Only workspace owners can delete workspaces',
        variant: 'destructive',
      });
      return;
    }

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete "${workspace.name}"? This action cannot be undone and will remove all data associated with this workspace.`
    );

    if (!confirmed) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ is_active: false })
        .eq('id', workspace.id);

      if (error) throw error;

      toast({
        title: 'Workspace Deleted',
        description: 'The workspace has been deleted successfully',
      });

      // Redirect to workspaces list
      window.location.href = '/workspaces';
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workspace',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* General Information */}
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>
            Update your workspace name, description, and visibility settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Workspace Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              disabled={!permissions.canEditSettings || isSaving}
              placeholder="Enter workspace name"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="slug">Workspace Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase())}
              disabled={!permissions.canEditSettings || isSaving}
              placeholder="workspace-url-slug"
              className="mt-1"
              pattern="^[a-z0-9-]+$"
            />
            {formData.slug !== workspace.slug && (
              <p className="text-sm text-amber-600 dark:text-amber-500 mt-1 font-medium">
                ⚠️ Warning: Changing the slug will break all existing links to this workspace
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              URL-friendly identifier for your workspace (lowercase letters, numbers, and hyphens
              only)
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              disabled={!permissions.canEditSettings || isSaving}
              placeholder="Describe your workspace..."
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="visibility">Visibility</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value) => handleInputChange('visibility', value)}
              disabled={!permissions.canEditSettings || isSaving}
            >
              <SelectTrigger id="visibility" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground mt-1">
              {formData.visibility === 'public'
                ? 'Anyone can view this workspace'
                : 'Only members can view this workspace'}
            </p>
          </div>

          {permissions.canEditSettings && (
            <Button onClick={handleSaveGeneralSettings} disabled={isSaving}>
              <Check className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Debug Information */}
      <Card>
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
          <CardDescription>
            Technical details for debugging and integration purposes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Workspace ID</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono">{workspace.id}</code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(workspace.id);
                    toast({
                      title: 'Copied',
                      description: 'Workspace ID copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Workspace Slug</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono">
                  {workspace.slug}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(workspace.slug);
                    toast({
                      title: 'Copied',
                      description: 'Workspace slug copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Owner ID</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-muted px-2 py-1 rounded font-mono text-xs">
                  {workspace.owner_id}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(workspace.owner_id);
                    toast({
                      title: 'Copied',
                      description: 'Owner ID copied to clipboard',
                    });
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="text-sm mt-1">
                {new Date(workspace.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Configure how you receive notifications for this workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive email updates about workspace activity
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={formData.notifications.email}
              onCheckedChange={(checked) => handleInputChange('notifications.email', checked)}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="in-app-notifications">In-App Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Show notifications within the application
              </p>
            </div>
            <Switch
              id="in-app-notifications"
              checked={formData.notifications.in_app}
              onCheckedChange={(checked) => handleInputChange('notifications.in_app', checked)}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Event Data Backfill Section */}
      {repositories.length > 0 && (
        <WorkspaceBackfillManager
          workspaceId={workspace.id}
          repositories={repositories.map((repo) => ({
            id: repo.id,
            owner: repo.owner,
            name: repo.name,
            full_name: repo.full_name,
            stargazers_count: repo.stargazers_count || 0,
            forks_count: repo.forks_count || 0,
          }))}
        />
      )}

      {/* Team Members Section */}
      <MembersTab
        workspaceId={workspace.id}
        currentUserRole={currentMember.role}
        tier={workspace.tier}
        memberCount={memberCount}
      />

      {/* Danger Zone */}
      {permissions.canDeleteWorkspace && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Permanent actions that cannot be undone</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Workspace</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this workspace and all associated data
                </p>
              </div>
              <Button variant="destructive" onClick={handleDeleteWorkspace} disabled={isLoading}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Loading skeleton for settings
export function WorkspaceSettingsSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>

      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-32" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
