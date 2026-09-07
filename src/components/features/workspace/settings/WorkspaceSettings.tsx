import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { getSupabase } from '@/lib/supabase-lazy';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { Trash2, Loader2 } from '@/components/ui/icon';
import { CopyButton } from '@/components/ui/copy-button';
import { MembersTab } from './MembersTab';
import { WorkspaceService } from '@/services/workspace.service';
import { WorkspacePermissionService } from '@/services/workspace-permissions.service';
import type { Workspace, WorkspaceMember, WorkspaceVisibility } from '@/types/workspace';
import { WorkspaceBackfillManager } from '../WorkspaceBackfillManager';
import { SlackIntegrationCard } from './SlackIntegrationCard';
import { TUISetupTab } from './TUISetupTab';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { SettingsDisclosure } from './SettingsDisclosure';

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

function getFormData(workspace: Workspace) {
  return {
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description || '',
    visibility: workspace.visibility,
    notifications: {
      email: workspace.settings?.notifications?.email ?? true,
      in_app: workspace.settings?.notifications?.in_app ?? true,
    },
  };
}

export function WorkspaceSettings(props: WorkspaceSettingsProps) {
  return <WorkspaceSettingsForm key={props.workspace.id} {...props} />;
}

function WorkspaceSettingsForm({
  workspace,
  currentMember,
  memberCount,
  repositories = [],
  onWorkspaceUpdate,
}: WorkspaceSettingsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { refreshWorkspaces } = useWorkspaceContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState(() => getFormData(workspace));
  const [savedFormData, setSavedFormData] = useState(formData);
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(savedFormData);

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

    if (isSaving || !hasChanges) return;

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
    if (formData.slug !== savedFormData.slug) {
      const confirmed = window.confirm(
        '⚠️ WARNING: Changing your workspace slug will break all existing external links!\n\n' +
          `Current URL: /i/${savedFormData.slug}\n` +
          `New URL: /i/${formData.slug}\n\n` +
          'All bookmarks, shared links, and external references will stop working.\n\n' +
          'Are you sure you want to continue?'
      );

      if (!confirmed) {
        // Reset slug to original value
        setFormData((prev) => ({ ...prev, slug: savedFormData.slug }));
        return;
      }
    }

    setIsSaving(true);
    try {
      const response = await WorkspaceService.updateWorkspace(workspace.id, currentMember.user_id, {
        name: formData.name,
        slug: formData.slug,
        description: formData.description || null,
        visibility: formData.visibility as WorkspaceVisibility,
        settings: {
          ...workspace.settings,
          notifications: formData.notifications,
        },
      });

      if (response.success && response.data) {
        const saved = getFormData(response.data);
        setFormData(saved);
        setSavedFormData(saved);
        toast({
          title: 'Settings Saved',
          description: 'Workspace settings have been updated successfully',
        });
        onWorkspaceUpdate?.(response.data);
        // The page fetches by the slug in the URL; move there before the
        // workspace list refresh retriggers that fetch with the old slug.
        if (response.data.slug !== savedFormData.slug) {
          navigate(`/i/${response.data.slug}/settings`, { replace: true });
        }
        refreshWorkspaces();
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

  // Normalize optional counts once; the parent passes a memoized array so this
  // only recomputes when the repository list actually changes.
  const memoizedRepositories = useMemo(
    () =>
      repositories.map((repo) => ({
        id: repo.id,
        owner: repo.owner,
        name: repo.name,
        full_name: repo.full_name,
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
      })),
    [repositories]
  );

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
      const supabase = await getSupabase();
      const { data: deleted, error } = await supabase
        .from('workspaces')
        .update({ is_active: false })
        .eq('id', workspace.id)
        .select('id');

      if (error) throw error;

      // RLS blocks manifest as 0 affected rows with no error — don't report success
      if (!deleted || deleted.length === 0) {
        throw new Error('No workspace was deleted — you may not have permission');
      }

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
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Workspace settings</h2>
        {!permissions.canEditSettings && (
          <p className="text-sm text-muted-foreground">
            Only owners and maintainers can edit settings.
          </p>
        )}
      </div>

      <form
        aria-label="Workspace preferences"
        className="overflow-hidden rounded-xl border bg-card text-card-foreground"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSaveGeneralSettings();
        }}
      >
        <section
          aria-labelledby="general-heading"
          className="grid gap-6 p-5 sm:p-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10"
        >
          <div>
            <h3 id="general-heading" className="font-semibold">
              General
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your workspace identity and access.
            </p>
          </div>
          <div className="min-w-0 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={!permissions.canEditSettings || isSaving}
                placeholder="Enter workspace name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Workspace URL</Label>
              <div className="flex items-center rounded-md border border-input focus-within:ring-1 focus-within:ring-ring">
                <span className="pl-3 text-sm text-muted-foreground" aria-hidden="true">
                  /i/
                </span>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleInputChange('slug', e.target.value.toLowerCase())}
                  disabled={!permissions.canEditSettings || isSaving}
                  placeholder="workspace-url-slug"
                  pattern="[a-z0-9\-]+"
                  required
                  aria-describedby={
                    formData.slug !== savedFormData.slug ? 'slug-help slug-warning' : 'slug-help'
                  }
                  className="min-w-0 border-0 bg-transparent pl-1 shadow-none focus-visible:ring-0"
                />
              </div>
              <p id="slug-help" className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens.
              </p>
              {formData.slug !== savedFormData.slug && (
                <p
                  id="slug-warning"
                  role="status"
                  className="text-sm font-medium text-amber-700 dark:text-amber-400"
                >
                  Changing the URL will break existing links to this workspace.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={!permissions.canEditSettings || isSaving}
                placeholder="What is this workspace for?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value) => handleInputChange('visibility', value)}
                disabled={!permissions.canEditSettings || isSaving}
              >
                <SelectTrigger id="visibility" aria-describedby="visibility-help">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
              <p id="visibility-help" className="text-xs text-muted-foreground">
                {formData.visibility === 'public'
                  ? 'Anyone can view this workspace.'
                  : 'Only members can view this workspace.'}
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="notifications-heading"
          className="grid gap-6 border-t p-5 sm:p-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-10"
        >
          <div>
            <h3 id="notifications-heading" className="font-semibold">
              Notifications
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">Updates about workspace activity.</p>
          </div>
          <div className="min-w-0 divide-y">
            <div className="flex items-center justify-between gap-6 pb-4">
              <div className="space-y-1">
                <Label htmlFor="email-notifications">Email</Label>
                <p id="email-help" className="text-sm text-muted-foreground">
                  Receive updates in your inbox.
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={formData.notifications.email}
                onCheckedChange={(checked) => handleInputChange('notifications.email', checked)}
                aria-describedby="email-help"
                disabled={!permissions.canEditSettings || isSaving}
              />
            </div>
            <div className="flex items-center justify-between gap-6 pt-4">
              <div className="space-y-1">
                <Label htmlFor="in-app-notifications">In-app</Label>
                <p id="in-app-help" className="text-sm text-muted-foreground">
                  Show updates in contributor.info.
                </p>
              </div>
              <Switch
                id="in-app-notifications"
                checked={formData.notifications.in_app}
                onCheckedChange={(checked) => handleInputChange('notifications.in_app', checked)}
                aria-describedby="in-app-help"
                disabled={!permissions.canEditSettings || isSaving}
              />
            </div>
          </div>
        </section>

        {permissions.canEditSettings && (
          <div className="flex flex-col gap-3 border-t bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p role="status" className="text-sm text-muted-foreground">
              {hasChanges ? 'Unsaved changes' : 'No unsaved changes'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => setFormData(savedFormData)}
                disabled={!hasChanges || isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 sm:flex-none"
                disabled={!hasChanges || isSaving}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        )}
      </form>

      <MembersTab
        workspaceId={workspace.id}
        currentUserRole={currentMember.role}
        tier={workspace.tier}
        memberCount={memberCount}
      />

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Review labels</h3>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Invite your team to label past reviews and see when personal invite links are viewed and
            accepted.
          </p>
          <Button
            variant="outline"
            onClick={() => navigate(`/review-labels?workspace=${workspace.id}`)}
          >
            Open review labels
          </Button>
        </CardContent>
      </Card>

      <SlackIntegrationCard
        workspaceId={workspace.id}
        canEditSettings={permissions.canEditSettings}
      />

      <section aria-labelledby="tools-heading" className="space-y-4">
        <h3 id="tools-heading" className="font-semibold">
          Tools & details
        </h3>
        <div className="divide-y rounded-xl border bg-card">
          <SettingsDisclosure title="Repository insights TUI">
            <TUISetupTab />
          </SettingsDisclosure>
          {repositories.length > 0 && (
            <SettingsDisclosure title="Event history backfill">
              <WorkspaceBackfillManager
                workspaceId={workspace.id}
                repositories={memoizedRepositories}
              />
            </SettingsDisclosure>
          )}
          <SettingsDisclosure title="Workspace details">
            <dl className="grid min-w-0 gap-5 sm:grid-cols-2">
              {[
                { label: 'Workspace ID', value: workspace.id },
                { label: 'Workspace slug', value: workspace.slug },
                { label: 'Owner ID', value: workspace.owner_id },
              ].map(({ label, value }) => (
                <div key={label} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 flex min-w-0 items-center gap-2">
                    <code className="min-w-0 break-all text-xs">{value}</code>
                    <CopyButton
                      value={value}
                      size="sm"
                      iconClassName="h-3 w-3"
                      successMessage={`${label} copied to clipboard`}
                      label={`Copy ${label}`}
                    />
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-xs text-muted-foreground">Created</dt>
                <dd className="mt-2 text-sm">
                  {new Date(workspace.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </dd>
              </div>
            </dl>
          </SettingsDisclosure>
        </div>
      </section>

      {permissions.canDeleteWorkspace && (
        <section aria-labelledby="danger-heading" className="space-y-4 border-t pt-8">
          <h3 id="danger-heading" className="font-semibold text-destructive dark:text-red-400">
            Danger zone
          </h3>
          <div className="flex flex-col gap-4 rounded-xl border border-destructive/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <h4 className="text-sm font-medium">Delete workspace</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Permanently delete this workspace and all associated data.
              </p>
            </div>
            <Button
              variant="destructive"
              className="shrink-0"
              onClick={handleDeleteWorkspace}
              disabled={isLoading}
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {isLoading ? 'Deleting…' : 'Delete workspace'}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

// Loading skeleton for settings
export function WorkspaceSettingsSkeleton() {
  return (
    <div className="w-full min-w-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>

      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Card className="shadow-none">
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
