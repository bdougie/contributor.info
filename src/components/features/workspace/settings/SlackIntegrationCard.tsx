/**
 * SlackIntegrationCard Component
 * Manages Slack integration settings for workspace assignee reports
 * Supports both OAuth (recommended) and webhook-based integrations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useSlackIntegrations } from '@/hooks/useSlackIntegrations';
import { isEncryptionConfigured } from '@/lib/encryption';
import { getChannelsForIntegration, setIntegrationChannel, isOAuthIntegration } from '@/services/slack-integration.service';
import type { CreateSlackIntegrationInput, SlackChannel } from '@/types/workspace';

interface SlackIntegrationCardProps {
  workspaceId: string;
  canEditSettings: boolean;
}

export function SlackIntegrationCard({ workspaceId, canEditSettings }: SlackIntegrationCardProps) {
  const { toast } = useToast();
  const {
    integrations,
    loading,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testIntegration,
    refetch,
  } = useSlackIntegrations({ workspaceId });

  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState<string | null>(null);
  const [channels, setChannels] = useState<Record<string, SlackChannel[]>>({});
  const [formData, setFormData] = useState<Partial<CreateSlackIntegrationInput>>({
    workspace_id: workspaceId,
    channel_name: '',
    webhook_url: '',
    schedule: 'daily',
    enabled: true,
    config: {
      excludeBots: true,
      maxAssignees: 10,
      repositoryIds: [],
    },
  });

  const encryptionConfigured = isEncryptionConfigured();

  // Check for OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slackInstall = urlParams.get('slack_install');
    const teamName = urlParams.get('team');
    const error = urlParams.get('error');

    if (slackInstall === 'success' && teamName) {
      toast({
        title: 'Slack App Installed',
        description: `Successfully installed for ${decodeURIComponent(teamName)}. Select a channel below.`,
      });
      refetch();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (slackInstall === 'cancelled') {
      toast({
        title: 'Installation Cancelled',
        description: 'Slack app installation was cancelled',
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    } else if (slackInstall === 'error' && error) {
      toast({
        title: 'Installation Error',
        description: `Failed to install Slack app: ${error}`,
        variant: 'destructive',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInstallSlackApp = () => {
    const clientId = import.meta.env.VITE_SLACK_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_SLACK_REDIRECT_URI;
    const scopes = 'chat:write,channels:read';

    if (!clientId || !redirectUri) {
      toast({
        title: 'Configuration Error',
        description: 'Slack OAuth is not configured. Please contact support.',
        variant: 'destructive',
      });
      return;
    }

    const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${workspaceId}`;
    window.location.href = slackAuthUrl;
  };

  const fetchChannelsForIntegration = async (integrationId: string) => {
    setLoadingChannels(integrationId);
    try {
      const fetchedChannels = await getChannelsForIntegration(integrationId);
      setChannels((prev) => ({ ...prev, [integrationId]: fetchedChannels }));
    } catch (error) {
      console.error('Failed to fetch channels: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Slack channels',
        variant: 'destructive',
      });
    } finally {
      setLoadingChannels(null);
    }
  };

  const handleChannelSelect = async (integrationId: string, channelId: string) => {
    const integrationChannels = channels[integrationId];
    const selectedChannel = integrationChannels?.find((ch) => ch.id === channelId);

    if (!selectedChannel) {
      return;
    }

    try {
      await setIntegrationChannel(integrationId, channelId, selectedChannel.name);
      toast({
        title: 'Channel Selected',
        description: `Integration will send reports to #${selectedChannel.name}`,
      });
      refetch();
    } catch (error) {
      console.error('Failed to set channel: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to set channel',
        variant: 'destructive',
      });
    }
  };

  const handleCreateIntegration = async () => {
    if (!formData.channel_name || !formData.webhook_url) {
      toast({
        title: 'Missing Information',
        description: 'Please provide both channel name and webhook URL',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      await createIntegration(formData as CreateSlackIntegrationInput);
      toast({
        title: 'Integration Created',
        description: `Slack integration for ${formData.channel_name} has been created`,
      });
      setShowForm(false);
      setFormData({
        workspace_id: workspaceId,
        channel_name: '',
        webhook_url: '',
        schedule: 'daily',
        enabled: true,
        config: {
          excludeBots: true,
          maxAssignees: 10,
          repositoryIds: [],
        },
      });
    } catch (error) {
      console.error('Failed to create integration: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to create Slack integration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEnabled = async (integrationId: string, enabled: boolean) => {
    try {
      await updateIntegration(integrationId, { enabled });
      toast({
        title: enabled ? 'Integration Enabled' : 'Integration Disabled',
        description: `The Slack integration has been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Failed to toggle integration: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to update integration',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this Slack integration?')) {
      return;
    }

    try {
      await deleteIntegration(integrationId);
      toast({
        title: 'Integration Deleted',
        description: 'The Slack integration has been removed',
      });
    } catch (error) {
      console.error('Failed to delete integration: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to delete integration',
        variant: 'destructive',
      });
    }
  };

  const handleTestIntegration = async (integrationId: string) => {
    try {
      setIsTesting(integrationId);
      const success = await testIntegration(integrationId);
      if (success) {
        toast({
          title: 'Test Successful',
          description: 'A test message has been sent to your Slack channel',
        });
      } else {
        toast({
          title: 'Test Failed',
          description: 'Failed to send test message. Check your configuration.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to test integration: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to test integration',
        variant: 'destructive',
      });
    } finally {
      setIsTesting(null);
    }
  };

  if (!encryptionConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Slack Integration</CardTitle>
          <CardDescription>Send automated issue assignee reports to Slack channels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-100">
              ⚠️ Slack integration requires encryption configuration. Please set
              VITE_SLACK_WEBHOOK_ENCRYPTION_KEY in your environment variables.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              Generate a key:{' '}
              <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">
                openssl rand -base64 32
              </code>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find OAuth integrations that need channel selection
  const oauthIntegrationsNeedingChannel = integrations.filter(
    (i) => isOAuthIntegration(i) && !i.channel_id
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Slack Integration</CardTitle>
        <CardDescription>Send automated issue assignee reports to Slack channels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading integrations...</p>}

        {!loading && integrations.length === 0 && !showForm && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No Slack integrations configured yet
            </p>
            {canEditSettings && (
              <div className="flex flex-col gap-2 items-center">
                <Button onClick={handleInstallSlackApp} size="lg">
                  Install Slack App (Recommended)
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                  Use Webhook Instead
                </Button>
              </div>
            )}
          </div>
        )}

        {!loading && (integrations.length > 0 || showForm) && (
          <>
            {/* OAuth Integrations Needing Channel Selection */}
            {oauthIntegrationsNeedingChannel.map((integration) => (
              <div key={integration.id} className="rounded-lg border-2 border-blue-200 dark:border-blue-800 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default">OAuth App</Badge>
                  <Badge variant="secondary">Setup Required</Badge>
                </div>
                <p className="text-sm">
                  Slack app installed for <strong>{integration.slack_team_name}</strong>. Select a channel to complete setup:
                </p>
                <div>
                  <Label htmlFor={`channel-${integration.id}`}>Select Channel</Label>
                  {!channels[integration.id] && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchChannelsForIntegration(integration.id)}
                      disabled={loadingChannels === integration.id}
                      className="mt-1 w-full"
                    >
                      {loadingChannels === integration.id ? 'Loading channels...' : 'Load Channels'}
                    </Button>
                  )}
                  {channels[integration.id] && (
                    <Select onValueChange={(channelId) => handleChannelSelect(integration.id, channelId)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channels[integration.id].map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name} {channel.is_private ? '(private)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}

            {/* Existing Integrations */}
            {integrations.filter((i) => !isOAuthIntegration(i) || i.channel_id).map((integration) => (
              <div key={integration.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">#{integration.channel_name}</h4>
                      {isOAuthIntegration(integration) ? (
                        <Badge variant="default">OAuth App</Badge>
                      ) : (
                        <Badge variant="outline">Webhook</Badge>
                      )}
                      {integration.enabled ? (
                        <Badge variant="default">Enabled</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                      {integration.recent_failures && integration.recent_failures > 0 && (
                        <Badge variant="destructive">{integration.recent_failures} failures</Badge>
                      )}
                    </div>
                    {integration.slack_team_name && (
                      <p className="text-sm text-muted-foreground">
                        Workspace: {integration.slack_team_name}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Schedule: {integration.schedule} at 9:00 AM UTC
                    </p>
                    {integration.last_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Last sent: {new Date(integration.last_sent_at).toLocaleString()}
                      </p>
                    )}
                    {integration.next_scheduled_at && integration.enabled ? (
                      <p className="text-xs text-muted-foreground">
                        Next: {new Date(integration.next_scheduled_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  {canEditSettings && (
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={integration.enabled}
                        onCheckedChange={(enabled) => handleToggleEnabled(integration.id, enabled)}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Max assignees:</span>{' '}
                    {integration.config.maxAssignees}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Exclude bots:</span>{' '}
                    {integration.config.excludeBots ? 'Yes' : 'No'}
                  </div>
                </div>

                {canEditSettings && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestIntegration(integration.id)}
                      disabled={isTesting === integration.id}
                    >
                      {isTesting === integration.id ? 'Testing...' : 'Test Connection'}
                    </Button>
                    {isOAuthIntegration(integration) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchChannelsForIntegration(integration.id)}
                        disabled={loadingChannels === integration.id}
                      >
                        {loadingChannels === integration.id ? 'Loading...' : 'Change Channel'}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteIntegration(integration.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {/* Add New Integration Form (Webhook) */}
            {showForm && canEditSettings && (
              <div className="rounded-lg border p-4 space-y-4 bg-muted/50">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">New Webhook Integration</h4>
                  <Badge variant="outline">Legacy Method</Badge>
                </div>

                <div>
                  <Label htmlFor="channel_name">Channel Name</Label>
                  <Input
                    id="channel_name"
                    value={formData.channel_name}
                    onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                    placeholder="engineering-updates"
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Display name for this integration (not used for sending)
                  </p>
                </div>

                <div>
                  <Label htmlFor="webhook_url">Slack Webhook URL</Label>
                  <Input
                    id="webhook_url"
                    type="url"
                    value={formData.webhook_url}
                    onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    disabled={isSaving}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get this from Slack: Incoming Webhooks app
                  </p>
                </div>

                <div>
                  <Label htmlFor="schedule">Schedule</Label>
                  <Select
                    value={formData.schedule}
                    onValueChange={(value: 'daily' | 'weekly') =>
                      setFormData({ ...formData, schedule: value })
                    }
                    disabled={isSaving}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily (9:00 AM UTC)</SelectItem>
                      <SelectItem value="weekly">Weekly (Monday 9:00 AM UTC)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="exclude_bots"
                    checked={formData.config?.excludeBots ?? true}
                    onCheckedChange={(checked) =>
                      setFormData({
                        ...formData,
                        config: { ...formData.config!, excludeBots: checked },
                      })
                    }
                    disabled={isSaving}
                  />
                  <Label htmlFor="exclude_bots">Exclude bot assignees</Label>
                </div>

                <div>
                  <Label htmlFor="max_assignees">Maximum Assignees to Show</Label>
                  <Input
                    id="max_assignees"
                    type="number"
                    min="1"
                    max="50"
                    value={formData.config?.maxAssignees ?? 10}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        config: {
                          ...formData.config!,
                          maxAssignees: parseInt(e.target.value) || 10,
                        },
                      })
                    }
                    disabled={isSaving}
                    className="mt-1"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleCreateIntegration} disabled={isSaving}>
                    {isSaving ? 'Creating...' : 'Create Integration'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Add New Button */}
            {!showForm && canEditSettings && integrations.length > 0 && (
              <div className="flex gap-2">
                <Button onClick={handleInstallSlackApp}>
                  Install Slack App
                </Button>
                <Button variant="outline" onClick={() => setShowForm(true)}>
                  Add Webhook Integration
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
