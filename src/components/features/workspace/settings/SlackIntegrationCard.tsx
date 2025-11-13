/**
 * SlackIntegrationCard Component
 * Manages Slack integration settings for workspace assignee reports
 * Uses OAuth-based Slack app installation for secure integration
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useSlackIntegrations } from '@/hooks/useSlackIntegrations';
import { isEncryptionConfigured } from '@/lib/encryption';
import {
  getChannelsForIntegration,
  setIntegrationChannel,
  isOAuthIntegration,
} from '@/services/slack-integration.service';
import type { SlackChannel } from '@/types/workspace';

interface SlackIntegrationCardProps {
  workspaceId: string;
  canEditSettings: boolean;
}

export function SlackIntegrationCard({ workspaceId, canEditSettings }: SlackIntegrationCardProps) {
  const { toast } = useToast();
  const { integrations, loading, updateIntegration, deleteIntegration, testIntegration, refetch } =
    useSlackIntegrations({ workspaceId });

  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [loadingChannels, setLoadingChannels] = useState<string | null>(null);
  const [channels, setChannels] = useState<Record<string, SlackChannel[]>>({});
  const [testRateLimits, setTestRateLimits] = useState<Record<string, number>>({});
  const [channelSearchQuery, setChannelSearchQuery] = useState<Record<string, string>>({});
  const [disconnectingAll, setDisconnectingAll] = useState(false);

  const encryptionConfigured = isEncryptionConfigured();

  // Filter channels based on search query for each integration
  const getFilteredChannels = (integrationId: string): SlackChannel[] => {
    const integrationChannels = channels[integrationId] || [];
    const searchQuery = channelSearchQuery[integrationId]?.toLowerCase() || '';

    if (!searchQuery) {
      return integrationChannels;
    }

    return integrationChannels.filter((channel) =>
      channel.name.toLowerCase().includes(searchQuery)
    );
  };

  // Update UI when rate limits expire
  useEffect(() => {
    const timer = setInterval(() => {
      // Force re-render to update rate limit countdown
      setTestRateLimits((prev) => ({ ...prev }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Check for OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const slackInstall = urlParams.get('slack_install');
    const teamName = urlParams.get('team');
    const error = urlParams.get('error');

    if (slackInstall === 'success' && teamName) {
      toast({
        title: '✅ Slack App Installed Successfully',
        description: `Connected to ${decodeURIComponent(teamName)}. Refreshing integrations...`,
      });
      // Add a small delay before refetch to ensure database has the new record
      setTimeout(() => {
        refetch().then(() => {
          toast({
            title: 'Integration Ready',
            description: 'Please select a channel below to complete setup.',
          });
        });
      }, 1000);
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

  const handleInstallSlackApp = async () => {
    try {
      // Call the edge function to generate a secure OAuth state
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/slack-oauth-initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate OAuth');
      }

      const { oauth_url } = await response.json();

      // Redirect to Slack OAuth URL with secure state
      window.location.href = oauth_url;
    } catch (error) {
      console.error('Failed to initiate Slack OAuth: %s', error);
      toast({
        title: 'Configuration Error',
        description: 'Failed to start Slack app installation. Please try again.',
        variant: 'destructive',
      });
    }
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

  const handleDisconnectAll = async () => {
    setDisconnectingAll(true);
    try {
      // Delete all integrations
      await Promise.all(integrations.map((integration) => deleteIntegration(integration.id)));
      toast({
        title: 'All Integrations Disconnected',
        description: 'All Slack integrations have been removed',
      });
    } catch (error) {
      console.error('Failed to disconnect all integrations: %s', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect all integrations',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingAll(false);
    }
  };

  // Helper functions for rate limiting UI
  const isRateLimited = (integrationId: string): boolean => {
    const lastTestTime = testRateLimits[integrationId] || 0;
    const timeSinceLastTest = Date.now() - lastTestTime;
    return timeSinceLastTest < 60000; // 1 minute rate limit
  };

  const getRemainingSeconds = (integrationId: string): number => {
    const lastTestTime = testRateLimits[integrationId] || 0;
    const timeSinceLastTest = Date.now() - lastTestTime;
    return Math.ceil((60000 - timeSinceLastTest) / 1000);
  };

  const handleTestIntegration = async (integrationId: string) => {
    // Check rate limit (allow 1 test per minute per integration)
    const lastTestTime = testRateLimits[integrationId] || 0;
    const now = Date.now();
    const timeSinceLastTest = now - lastTestTime;
    const RATE_LIMIT_MS = 60000; // 1 minute

    if (timeSinceLastTest < RATE_LIMIT_MS) {
      const secondsRemaining = Math.ceil((RATE_LIMIT_MS - timeSinceLastTest) / 1000);
      toast({
        title: 'Rate Limited',
        description: `Please wait ${secondsRemaining} seconds before testing again`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsTesting(integrationId);
      setTestRateLimits((prev) => ({ ...prev, [integrationId]: now }));

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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Slack Integration</CardTitle>
            <CardDescription>
              Send automated issue assignee reports to Slack channels
            </CardDescription>
          </div>
          {!loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Refresh integrations"
            >
              🔄 Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading integrations...</p>}

        {!loading && integrations.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No Slack integrations configured yet
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={handleInstallSlackApp}
                className="transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded bg-white p-0"
                aria-label="Add to Slack"
              >
                <img alt="Add to Slack" height="40" width="139" src="/images/add_to_slack.svg" />
              </button>
            </div>
          </div>
        )}

        {!loading && integrations.length > 0 && (
          <>
            {/* OAuth Integrations Needing Channel Selection */}
            {oauthIntegrationsNeedingChannel.map((integration) => (
              <div
                key={integration.id}
                className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-800 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="bg-green-600">
                      ✅ Installed
                    </Badge>
                    <Badge variant="secondary">Setup Required</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(integration.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="font-medium">
                    Slack workspace: <strong>{integration.slack_team_name}</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ✨ Installation successful! Now select a channel to receive issue reports:
                  </p>
                </div>
                {canEditSettings ? (
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
                        {loadingChannels === integration.id
                          ? 'Loading channels...'
                          : 'Load Channels'}
                      </Button>
                    )}
                    {channels[integration.id] && (
                      <div className="space-y-2">
                        <Input
                          type="search"
                          name={`channel-search-${integration.id}`}
                          id={`channel-search-${integration.id}`}
                          placeholder="Search channels..."
                          autoComplete="off"
                          value={channelSearchQuery[integration.id] || ''}
                          onChange={(e) =>
                            setChannelSearchQuery((prev) => ({
                              ...prev,
                              [integration.id]: e.target.value,
                            }))
                          }
                          className="mt-1"
                        />
                        <Select
                          onValueChange={(channelId) =>
                            handleChannelSelect(integration.id, channelId)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a channel" />
                          </SelectTrigger>
                          <SelectContent>
                            {getFilteredChannels(integration.id).length === 0 ? (
                              <div className="p-2 text-sm text-muted-foreground text-center">
                                No channels found
                              </div>
                            ) : (
                              getFilteredChannels(integration.id).map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                  #{channel.name} {channel.is_private ? '(private)' : ''}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    You need edit permissions to configure this integration.
                  </p>
                )}
              </div>
            ))}

            {/* Existing Integrations */}
            {integrations
              .filter((i) => !isOAuthIntegration(i) || i.channel_id)
              .map((integration) => {
                const isOAuth = isOAuthIntegration(integration);
                const borderClass =
                  isOAuth && integration.enabled
                    ? 'border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                    : '';

                return (
                  <div
                    key={integration.id}
                    className={`rounded-lg border p-4 space-y-3 ${borderClass}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">#{integration.channel_name}</h4>
                          {isOAuth ? (
                            <Badge variant="default" className="bg-green-600">
                              ✅ OAuth App
                            </Badge>
                          ) : (
                            <Badge variant="outline">Webhook</Badge>
                          )}
                          {integration.enabled ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Disabled</Badge>
                          )}
                          {integration.recent_failures && integration.recent_failures > 0 && (
                            <Badge variant="destructive">
                              {integration.recent_failures} failures
                            </Badge>
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
                            onCheckedChange={(enabled) =>
                              handleToggleEnabled(integration.id, enabled)
                            }
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
                      <div className="space-y-2 pt-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestIntegration(integration.id)}
                            disabled={isTesting === integration.id || isRateLimited(integration.id)}
                            title={
                              isRateLimited(integration.id)
                                ? `Wait ${getRemainingSeconds(integration.id)} seconds`
                                : undefined
                            }
                          >
                            {isTesting === integration.id && 'Testing...'}
                            {!isTesting &&
                              isRateLimited(integration.id) &&
                              `Wait ${getRemainingSeconds(integration.id)}s`}
                            {!isTesting && !isRateLimited(integration.id) && 'Test Connection'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchChannelsForIntegration(integration.id)}
                            disabled={loadingChannels === integration.id}
                          >
                            {loadingChannels === integration.id ? 'Loading...' : 'Change Channel'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteIntegration(integration.id)}
                          >
                            Delete
                          </Button>
                        </div>
                        {channels[integration.id] && (
                          <div className="space-y-2">
                            <Input
                              type="search"
                              name={`channel-search-existing-${integration.id}`}
                              id={`channel-search-existing-${integration.id}`}
                              placeholder="Search channels..."
                              autoComplete="off"
                              value={channelSearchQuery[integration.id] || ''}
                              onChange={(e) =>
                                setChannelSearchQuery((prev) => ({
                                  ...prev,
                                  [integration.id]: e.target.value,
                                }))
                              }
                            />
                            <Select
                              onValueChange={(channelId) =>
                                handleChannelSelect(integration.id, channelId)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a new channel" />
                              </SelectTrigger>
                              <SelectContent>
                                {getFilteredChannels(integration.id).length === 0 ? (
                                  <div className="p-2 text-sm text-muted-foreground text-center">
                                    No channels found
                                  </div>
                                ) : (
                                  getFilteredChannels(integration.id).map((channel) => (
                                    <SelectItem key={channel.id} value={channel.id}>
                                      #{channel.name} {channel.is_private ? '(private)' : ''}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Disconnect Slack Button */}
            {integrations.length > 0 && canEditSettings && (
              <div className="flex gap-3 items-center pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" disabled={disconnectingAll}>
                      {disconnectingAll ? 'Disconnecting...' : 'Disconnect Slack Integration'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Slack Integration?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove{' '}
                        {integrations.length > 1 ? `all ${integrations.length}` : 'the'} Slack
                        integration
                        {integrations.length > 1 ? 's' : ''} from this workspace. You will stop
                        receiving automated reports in Slack.
                        <br />
                        <br />
                        <strong>This action cannot be undone.</strong> You will need to reinstall
                        the Slack app to set up new integrations.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnectAll}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
