/**
 * User Slack Integration Service
 * Handles CRUD operations for individual user repository Slack integrations
 */

import { supabase } from '../lib/supabase';
import { logError } from '../lib/error-logging';
import type {
  UserSlackIntegration,
  UserSlackIntegrationWithRepo,
  SlackChannel,
  UpdateUserSlackIntegrationInput,
} from '../types/user-slack';

/**
 * Initiate OAuth flow for user Slack integration
 * Returns the Slack OAuth URL to redirect to
 */
export async function initiateUserSlackOAuth(
  owner: string,
  repo: string
): Promise<{ oauth_url: string }> {
  const { data, error } = await supabase.functions.invoke('slack-oauth-initiate-user', {
    body: { owner, repo },
  });

  if (error) {
    logError('Failed to initiate user Slack OAuth', error, {
      tags: { feature: 'user-slack', operation: 'initiate_oauth' },
      extra: { owner, repo },
    });
    throw new Error(error.message || 'Failed to initiate Slack connection');
  }

  return data;
}

/**
 * Fetch all Slack integrations for the current user
 */
export async function getUserSlackIntegrations(): Promise<UserSlackIntegrationWithRepo[]> {
  const { data, error } = await supabase
    .from('user_slack_integrations')
    .select(
      `
      *,
      repository:repositories!inner(id, owner, name)
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    logError('Failed to fetch user Slack integrations', error, {
      tags: { feature: 'user-slack', operation: 'fetch_integrations' },
    });
    throw new Error('Failed to fetch Slack integrations');
  }

  return (data || []).map((item) => ({
    ...item,
    repository: item.repository as { id: string; owner: string; name: string },
  }));
}

/**
 * Get a single user Slack integration by ID
 */
export async function getUserSlackIntegration(
  integrationId: string
): Promise<UserSlackIntegrationWithRepo | null> {
  const { data, error } = await supabase
    .from('user_slack_integrations')
    .select(
      `
      *,
      repository:repositories!inner(id, owner, name)
    `
    )
    .eq('id', integrationId)
    .maybeSingle();

  if (error) {
    logError('Failed to fetch user Slack integration', error, {
      tags: { feature: 'user-slack', operation: 'fetch_integration' },
      extra: { integrationId },
    });
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    repository: data.repository as { id: string; owner: string; name: string },
  };
}

/**
 * Get user Slack integration for a specific repository
 */
export async function getUserSlackIntegrationForRepo(
  owner: string,
  repo: string
): Promise<UserSlackIntegration | null> {
  // First get repository ID
  const { data: repoData, error: repoError } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle();

  if (repoError || !repoData) {
    return null;
  }

  const { data, error } = await supabase
    .from('user_slack_integrations')
    .select('*')
    .eq('repository_id', repoData.id)
    .maybeSingle();

  if (error) {
    logError('Failed to fetch user Slack integration for repo', error, {
      tags: { feature: 'user-slack', operation: 'fetch_integration_for_repo' },
      extra: { owner, repo },
    });
    return null;
  }

  return data;
}

/**
 * Update a user Slack integration
 */
export async function updateUserSlackIntegration(
  integrationId: string,
  input: UpdateUserSlackIntegrationInput
): Promise<UserSlackIntegration> {
  const updateData: Record<string, unknown> = {};

  if (input.channel_id !== undefined) {
    updateData.channel_id = input.channel_id;
  }

  if (input.channel_name !== undefined) {
    updateData.channel_name = input.channel_name;
  }

  if (input.enabled !== undefined) {
    updateData.enabled = input.enabled;
  }

  const { data, error } = await supabase
    .from('user_slack_integrations')
    .update(updateData)
    .eq('id', integrationId)
    .select()
    .maybeSingle();

  if (error || !data) {
    logError('Failed to update user Slack integration', error || new Error('No data returned'), {
      tags: { feature: 'user-slack', operation: 'update_integration' },
      extra: { integrationId, updateData },
    });
    throw new Error('Failed to update Slack integration');
  }

  return data;
}

/**
 * Delete a user Slack integration
 */
export async function deleteUserSlackIntegration(integrationId: string): Promise<void> {
  const { error } = await supabase.from('user_slack_integrations').delete().eq('id', integrationId);

  if (error) {
    logError('Failed to delete user Slack integration', error, {
      tags: { feature: 'user-slack', operation: 'delete_integration' },
      extra: { integrationId },
    });
    throw new Error('Failed to delete Slack integration');
  }
}

/**
 * Get channels available for a user Slack integration
 */
export async function getChannelsForUserIntegration(
  integrationId: string
): Promise<SlackChannel[]> {
  const { data, error } = await supabase.functions.invoke('slack-list-channels-user', {
    body: { integration_id: integrationId },
  });

  if (error) {
    logError('Failed to fetch channels for user integration', error, {
      tags: { feature: 'user-slack', operation: 'fetch_channels' },
      extra: { integrationId },
    });
    throw new Error(error.message || 'Failed to fetch channels');
  }

  return data.channels;
}

/**
 * Set the channel for a user Slack integration
 */
export async function setUserIntegrationChannel(
  integrationId: string,
  channelId: string,
  channelName: string
): Promise<void> {
  const { error } = await supabase
    .from('user_slack_integrations')
    .update({
      channel_id: channelId,
      channel_name: channelName,
      enabled: true, // Enable once channel is selected
    })
    .eq('id', integrationId);

  if (error) {
    logError('Failed to set channel for user integration', error, {
      tags: { feature: 'user-slack', operation: 'set_channel' },
      extra: { integrationId, channelId, channelName },
    });
    throw new Error('Failed to update channel');
  }
}

/**
 * Check if a pending (unconfigured) integration exists for a repository
 */
export async function getPendingIntegrationForRepo(
  owner: string,
  repo: string
): Promise<UserSlackIntegration | null> {
  const { data: repoData } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle();

  if (!repoData) return null;

  const { data } = await supabase
    .from('user_slack_integrations')
    .select('*')
    .eq('repository_id', repoData.id)
    .eq('channel_id', 'pending')
    .maybeSingle();

  return data;
}
