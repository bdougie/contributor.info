/**
 * UserSlackIntegrationsCard Component
 * Manages user-level Slack integrations for monthly leaderboard notifications
 * Mirrors the workspace SlackIntegrationCard pattern
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import {
  getUserSlackIntegrations,
  updateUserSlackIntegration,
  deleteUserSlackIntegration,
} from '@/services/user-slack-integration.service';
import type { UserSlackIntegrationWithRepo } from '@/types/user-slack';
import { logError } from '@/lib/error-logging';
import { ExternalLink } from '@/components/ui/icon';
import { useNavigate } from 'react-router';

export function UserSlackIntegrationsCard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [integrations, setIntegrations] = useState<UserSlackIntegrationWithRepo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    try {
      const data = await getUserSlackIntegrations();
      setIntegrations(data);
    } catch (error) {
      logError('Failed to fetch user Slack integrations', error as Error, {
        tags: { feature: 'user-slack', component: 'UserSlackIntegrationsCard' },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleToggleEnabled = async (integrationId: string, enabled: boolean) => {
    try {
      await updateUserSlackIntegration(integrationId, { enabled });
      setIntegrations((prev) => prev.map((i) => (i.id === integrationId ? { ...i, enabled } : i)));
      toast({
        title: enabled ? 'Notifications Enabled' : 'Notifications Disabled',
        description: `Monthly leaderboard notifications have been ${enabled ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      logError('Failed to toggle user Slack integration', error as Error, {
        tags: { feature: 'user-slack', component: 'UserSlackIntegrationsCard' },
      });
      toast({
        title: 'Error',
        description: 'Failed to update integration',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    try {
      await deleteUserSlackIntegration(integrationId);
      setIntegrations((prev) => prev.filter((i) => i.id !== integrationId));
      toast({
        title: 'Integration Deleted',
        description: 'The Slack integration has been removed',
      });
    } catch (error) {
      logError('Failed to delete user Slack integration', error as Error, {
        tags: { feature: 'user-slack', component: 'UserSlackIntegrationsCard' },
      });
      toast({
        title: 'Error',
        description: 'Failed to delete integration',
        variant: 'destructive',
      });
    }
  };

  // Filter out pending integrations (ones without a channel set)
  const activeIntegrations = integrations.filter((i) => i.channel_id !== 'pending');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Slack Notifications</CardTitle>
            <CardDescription>
              Receive monthly contributor leaderboard updates in Slack
            </CardDescription>
          </div>
          {!loading && (
            <Button variant="outline" size="sm" onClick={fetchIntegrations} title="Refresh">
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading integrations...</p>}

        {!loading && activeIntegrations.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-2">
              No Slack integrations configured yet
            </p>
            <p className="text-xs text-muted-foreground">
              Visit any repository page and click the Slack icon to set up monthly leaderboard
              notifications.
            </p>
          </div>
        )}

        {!loading && activeIntegrations.length > 0 && (
          <div className="space-y-4">
            {activeIntegrations.map((integration) => (
              <div
                key={integration.id}
                className={`rounded-lg border p-4 space-y-3 ${
                  integration.enabled
                    ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium">
                        {integration.repository.owner}/{integration.repository.name}
                      </h4>
                      {integration.enabled ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Channel: #{integration.channel_name}
                    </p>
                    {integration.slack_team_name && (
                      <p className="text-xs text-muted-foreground">
                        Workspace: {integration.slack_team_name}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">Sends on the 1st of each month</p>
                    {integration.last_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Last sent: {new Date(integration.last_sent_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={integration.enabled}
                    onCheckedChange={(enabled) => handleToggleEnabled(integration.id, enabled)}
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(`/${integration.repository.owner}/${integration.repository.name}`)
                    }
                    className="gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Repo
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Slack Integration?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will stop monthly leaderboard notifications for{' '}
                          <strong>
                            {integration.repository.owner}/{integration.repository.name}
                          </strong>{' '}
                          to <strong>#{integration.channel_name}</strong>.
                          <br />
                          <br />
                          You can set up a new integration from the repository page.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteIntegration(integration.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}

            <p className="text-xs text-muted-foreground pt-2">
              You can have up to 5 Slack integrations. To add more, visit any repository page and
              click the Slack icon.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
