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

  const encryptionConfigured = isEncryptionConfigured();

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
        <CardTitle>Slack Integration</CardTitle>
        <CardDescription>Send automated issue assignee reports to Slack channels</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading integrations...</p>}

        {!loading && integrations.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-4">
              No Slack integrations configured yet
            </p>
            {canEditSettings && (
              <div className="flex flex-col gap-3 items-center">
                <button
                  onClick={handleInstallSlackApp}
                  className="transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                  aria-label="Add to Slack"
                >
                  <img
                    alt="Add to Slack"
                    height="40"
                    width="139"
                    src="https://platform.slack-edge.com/img/add_to_slack.png"
                  />
                </button>
              </div>
            )}
          </div>
        )}

        {!loading && integrations.length > 0 && (
          <>
            {/* OAuth Integrations Needing Channel Selection */}
            {oauthIntegrationsNeedingChannel.map((integration) => (
              <div
                key={integration.id}
                className="rounded-lg border-2 border-blue-200 dark:border-blue-800 p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="default">OAuth App</Badge>
                  <Badge variant="secondary">Setup Required</Badge>
                </div>
                <p className="text-sm">
                  Slack app installed for <strong>{integration.slack_team_name}</strong>. Select a
                  channel to complete setup:
                </p>
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
                      <Select
                        onValueChange={(channelId) =>
                          handleChannelSelect(integration.id, channelId)
                        }
                      >
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
              .map((integration) => (
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
                    <div className="flex gap-2 pt-2">
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
                  )}
                </div>
              ))}

            {/* Add New Button */}
            {canEditSettings && integrations.length > 0 && (
              <div className="flex gap-3 items-center">
                <button
                  onClick={handleInstallSlackApp}
                  className="transition-opacity hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded"
                  aria-label="Add to Slack"
                >
                  <img
                    alt="Add to Slack"
                    height="40"
                    width="139"
                    src="https://platform.slack-edge.com/img/add_to_slack.png"
                  />
                </button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
