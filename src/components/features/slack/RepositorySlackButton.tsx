/**
 * RepositorySlackButton Component
 * Button to connect Slack notifications for monthly leaderboard updates
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import {
  initiateUserSlackOAuth,
  getUserSlackIntegrationForRepo,
  getPendingIntegrationForRepo,
  getChannelsForUserIntegration,
  setUserIntegrationChannel,
  deleteUserSlackIntegration,
} from '@/services/user-slack-integration.service';
import type { UserSlackIntegration, SlackChannel } from '@/types/user-slack';
import { logError } from '@/lib/error-logging';

// Slack icon SVG component
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.166 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.124a2.528 2.528 0 0 1 2.521 2.52A2.528 2.528 0 0 1 15.166 24a2.528 2.528 0 0 1-2.521-2.522v-2.52h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.312A2.528 2.528 0 0 1 24 15.166a2.528 2.528 0 0 1-2.522 2.521h-6.312z" />
    </svg>
  );
}

interface RepositorySlackButtonProps {
  owner: string;
  repo: string;
}

export function RepositorySlackButton({ owner, repo }: RepositorySlackButtonProps) {
  const { isLoggedIn } = useGitHubAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [integration, setIntegration] = useState<UserSlackIntegration | null>(null);
  const [pendingIntegration, setPendingIntegration] = useState<UserSlackIntegration | null>(null);
  const [channels, setChannels] = useState<SlackChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Define callbacks before useEffects that depend on them
  const loadExistingIntegration = useCallback(async () => {
    try {
      const existing = await getUserSlackIntegrationForRepo(owner, repo);
      if (existing && existing.channel_id !== 'pending') {
        setIntegration(existing);
      }
    } catch {
      // Ignore errors - user may not have integration
    }
  }, [owner, repo]);

  const loadPendingIntegration = useCallback(async () => {
    try {
      const pending = await getPendingIntegrationForRepo(owner, repo);
      if (pending) {
        setPendingIntegration(pending);
        setLoadingChannels(true);
        try {
          const channelList = await getChannelsForUserIntegration(pending.id);
          setChannels(channelList);
        } finally {
          setLoadingChannels(false);
        }
      }
    } catch (error) {
      logError('Failed to load pending integration', error as Error, {
        tags: { feature: 'user-slack', component: 'RepositorySlackButton' },
      });
    }
  }, [owner, repo]);

  // Check for OAuth callback params
  useEffect(() => {
    const slackInstall = searchParams.get('slack_install');
    const team = searchParams.get('team');
    const error = searchParams.get('error');

    if (slackInstall === 'success') {
      toast({
        title: 'Slack Connected!',
        description: `Connected to ${team || 'Slack workspace'}. Now select a channel.`,
      });
      // Clear params and open modal
      setSearchParams((prev) => {
        prev.delete('slack_install');
        prev.delete('team');
        return prev;
      });
      setIsOpen(true);
      loadPendingIntegration();
    } else if (slackInstall === 'cancelled') {
      toast({
        title: 'Cancelled',
        description: 'Slack connection was cancelled',
        variant: 'destructive',
      });
      setSearchParams((prev) => {
        prev.delete('slack_install');
        return prev;
      });
    } else if (slackInstall === 'error') {
      toast({
        title: 'Connection Failed',
        description: `Failed to connect Slack: ${error || 'Unknown error'}`,
        variant: 'destructive',
      });
      setSearchParams((prev) => {
        prev.delete('slack_install');
        prev.delete('error');
        return prev;
      });
    }
  }, [searchParams, setSearchParams, toast, loadPendingIntegration]);

  // Load existing integration on mount
  useEffect(() => {
    if (isLoggedIn) {
      loadExistingIntegration();
    }
  }, [isLoggedIn, loadExistingIntegration]);

  async function handleConnectSlack() {
    if (!isLoggedIn) {
      toast({
        title: 'Login Required',
        description: 'Please log in to connect Slack notifications',
        variant: 'destructive',
      });
      return;
    }

    setIsConnecting(true);
    try {
      const { oauth_url } = await initiateUserSlackOAuth(owner, repo);
      // Redirect to Slack OAuth
      window.location.href = oauth_url;
    } catch (error) {
      logError('Failed to initiate Slack OAuth', error as Error, {
        tags: { feature: 'user-slack', component: 'RepositorySlackButton' },
      });
      toast({
        title: 'Connection Failed',
        description: 'Failed to start Slack connection. Please try again.',
        variant: 'destructive',
      });
      setIsConnecting(false);
    }
  }

  async function handleSaveChannel() {
    if (!selectedChannel || !pendingIntegration) return;

    setIsSaving(true);
    try {
      const channel = channels.find((c) => c.id === selectedChannel);
      if (!channel) return;

      await setUserIntegrationChannel(pendingIntegration.id, channel.id, channel.name);

      toast({
        title: 'Slack Connected!',
        description: `Monthly leaderboard will be sent to #${channel.name}`,
      });

      // Refresh integration state
      setIntegration({
        ...pendingIntegration,
        channel_id: channel.id,
        channel_name: channel.name,
        enabled: true,
      });
      setPendingIntegration(null);
      setIsOpen(false);
    } catch (error) {
      logError('Failed to save channel', error as Error, {
        tags: { feature: 'user-slack', component: 'RepositorySlackButton' },
      });
      toast({
        title: 'Error',
        description: 'Failed to save channel selection',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!integration) return;

    try {
      await deleteUserSlackIntegration(integration.id);
      setIntegration(null);
      toast({
        title: 'Disconnected',
        description: 'Slack notifications have been disabled',
      });
      setIsOpen(false);
    } catch (error) {
      logError('Failed to disconnect Slack', error as Error, {
        tags: { feature: 'user-slack', component: 'RepositorySlackButton' },
      });
      toast({
        title: 'Error',
        description: 'Failed to disconnect Slack',
        variant: 'destructive',
      });
    }
  }

  // Don't show button if not logged in
  if (!isLoggedIn) {
    return null;
  }

  const isConnected = integration && integration.channel_id !== 'pending';
  const needsChannelSelection = pendingIntegration !== null;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="stable-button"
            onClick={() => setIsOpen(true)}
            aria-label={isConnected ? 'Manage Slack notifications' : 'Connect Slack'}
          >
            <SlackIcon className={`h-4 w-4 ${isConnected ? 'text-green-600' : ''}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            {isConnected ? 'Manage Slack notifications' : 'Get monthly leaderboard in Slack'}
          </p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isConnected ? 'Slack Notifications' : 'Connect Slack'}</DialogTitle>
            <DialogDescription>
              {isConnected
                ? `Monthly leaderboard is sent to #${integration.channel_name}`
                : 'Receive monthly contributor leaderboard updates in Slack'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isConnected && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span className="font-medium">Active</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    On the 1st of each month, the top 10 contributors will be posted to{' '}
                    <strong>#{integration.channel_name}</strong>
                  </p>
                  {integration.slack_team_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Workspace: {integration.slack_team_name}
                    </p>
                  )}
                </div>

                <Button variant="destructive" onClick={handleDisconnect} className="w-full">
                  Disconnect Slack
                </Button>
              </div>
            )}

            {!isConnected && needsChannelSelection && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Channel</label>
                  <Select
                    value={selectedChannel}
                    onValueChange={setSelectedChannel}
                    disabled={loadingChannels}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={loadingChannels ? 'Loading channels...' : 'Select a channel'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.is_private ? '🔒 ' : '#'}
                          {channel.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The monthly leaderboard will be posted to this channel on the 1st of each month.
                  </p>
                </div>

                <Button
                  onClick={handleSaveChannel}
                  disabled={!selectedChannel || isSaving}
                  className="w-full"
                >
                  {isSaving ? 'Saving...' : 'Enable Notifications'}
                </Button>
              </div>
            )}

            {!isConnected && !needsChannelSelection && (
              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">Monthly Leaderboard</h4>
                  <p className="text-sm text-muted-foreground">
                    Get a summary of the top 10 contributors for{' '}
                    <strong>
                      {owner}/{repo}
                    </strong>{' '}
                    posted to your Slack channel on the 1st of each month.
                  </p>
                </div>

                <Button onClick={handleConnectSlack} disabled={isConnecting} className="w-full">
                  {isConnecting ? (
                    'Connecting...'
                  ) : (
                    <>
                      <SlackIcon className="h-4 w-4 mr-2" />
                      Connect to Slack
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
