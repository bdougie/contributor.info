import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Settings, Users, Activity, Trash2, Check } from '@/components/ui/icon';
import { MembersTab } from './MembersTab';
import { ActivityFeed } from './ActivityFeed';
import { supabase } from '@/lib/supabase';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspacePermissionService } from '@/services/workspace-permissions.service';
import { getTierInfo } from '@/types/workspace';
import type { Workspace, WorkspaceMember, WorkspaceVisibility } from '@/types/workspace';

interface WorkspaceSettingsProps {
  workspace: Workspace;
  currentMember: WorkspaceMember;
  memberCount: number;
  onWorkspaceUpdate?: (workspace: Workspace) => void;
}

export function WorkspaceSettings({
  workspace,
  currentMember,
  memberCount,
  onWorkspaceUpdate,
}: WorkspaceSettingsProps) {
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state for general settings
  const [formData, setFormData] = useState({
    name: workspace.name,
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
  const tierInfo = getTierInfo(workspace.tier);

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

    setIsSaving(true);
    try {
      const response = await WorkspaceService.updateWorkspace(workspace.id, currentMember.user_id, {
        name: formData.name,
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
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Workspace Settings</h2>
          <p className="text-muted-foreground mt-1">
            Manage your workspace configuration and team members
          </p>
        </div>
        <Badge variant={workspace.tier === 'free' ? 'secondary' : 'default'}>
          {tierInfo.badge} {tierInfo.name}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
            {memberCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {memberCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* General Settings Tab */}
        <TabsContent value="general" className="space-y-6">
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
                  <Button
                    variant="destructive"
                    onClick={handleDeleteWorkspace}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <MembersTab
            workspaceId={workspace.id}
            currentUserRole={currentMember.role}
            tier={workspace.tier}
            memberCount={memberCount}
          />
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity">
          <ActivityFeed workspaceId={workspace.id} />
        </TabsContent>
      </Tabs>
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
