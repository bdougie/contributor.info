/**
 * Slack Integration Service
 * Handles CRUD operations and message formatting for Slack integrations
 */

import { supabase } from '../lib/supabase';
import { decryptString } from '../lib/encryption';
import { postSlackMessage } from './slack-api.service';
import type {
  SlackIntegration,
  SlackIntegrationWithStatus,
  UpdateSlackIntegrationInput,
  IntegrationLog,
  SlackChannel,
} from '../types/workspace';

/**
 * Slack message block structure
 */
interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}

/**
 * Assignee data structure
 */
interface AssigneeData {
  login: string;
  avatar_url: string;
  issue_count: number;
  repository_count: number;
}

/**
 * Fetch all Slack integrations for a workspace
 */
export async function getSlackIntegrations(workspaceId: string): Promise<SlackIntegration[]> {
  const { data, error } = await supabase
    .from('slack_integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch Slack integrations: %s', error.message);
    throw new Error('Failed to fetch Slack integrations');
  }

  return data || [];
}

/**
 * Fetch Slack integrations with status information
 */
export async function getSlackIntegrationsWithStatus(
  workspaceId: string
): Promise<SlackIntegrationWithStatus[]> {
  const integrations = await getSlackIntegrations(workspaceId);

  // Fetch recent logs for each integration
  const integrationsWithStatus = await Promise.all(
    integrations.map(async (integration) => {
      const { data: logs } = await supabase
        .from('integration_logs')
        .select('*')
        .eq('integration_id', integration.id)
        .order('sent_at', { ascending: false })
        .limit(5);

      const recentFailures = logs?.filter((log) => log.status === 'failure').length || 0;

      return {
        ...integration,
        last_log: logs?.[0] || undefined,
        recent_failures: recentFailures,
      };
    })
  );

  return integrationsWithStatus;
}

/**
 * Get a single Slack integration by ID
 */
export async function getSlackIntegration(integrationId: string): Promise<SlackIntegration | null> {
  const { data, error } = await supabase
    .from('slack_integrations')
    .select('*')
    .eq('id', integrationId)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch Slack integration: %s', error.message);
    return null;
  }

  return data;
}

/**
 * Update an existing Slack integration
 */
export async function updateSlackIntegration(
  integrationId: string,
  input: UpdateSlackIntegrationInput
): Promise<SlackIntegration> {
  const updateData: Record<string, unknown> = {};

  if (input.channel_name !== undefined) {
    updateData.channel_name = input.channel_name;
  }

  if (input.schedule !== undefined) {
    updateData.schedule = input.schedule;
  }

  if (input.enabled !== undefined) {
    updateData.enabled = input.enabled;
  }

  if (input.config !== undefined) {
    // Merge with existing config
    const existing = await getSlackIntegration(integrationId);
    if (existing) {
      updateData.config = {
        ...existing.config,
        ...input.config,
      };
    }
  }

  const { data, error } = await supabase
    .from('slack_integrations')
    .update(updateData)
    .eq('id', integrationId)
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to update Slack integration: %s', error?.message);
    throw new Error('Failed to update Slack integration');
  }

  return data;
}

/**
 * Delete a Slack integration
 */
export async function deleteSlackIntegration(integrationId: string): Promise<void> {
  const { error } = await supabase.from('slack_integrations').delete().eq('id', integrationId);

  if (error) {
    console.error('Failed to delete Slack integration: %s', error.message);
    throw new Error('Failed to delete Slack integration');
  }
}

/**
 * Test a Slack integration by sending a test message
 */
export async function testSlackIntegration(integrationId: string): Promise<boolean> {
  const integration = await getSlackIntegration(integrationId);
  if (!integration) {
    throw new Error('Integration not found');
  }

  // Create a test message
  const message: SlackMessage = {
    text: 'Test message from Contributor.info',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🧪 Test Message',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a test message to verify your Slack integration is working correctly.',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Channel:*\n${integration.channel_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Schedule:*\n${integration.schedule}`,
          },
        ],
      },
    ],
  };

  try {
    // OAuth flow only
    if (!integration.bot_token_encrypted || !integration.channel_id) {
      throw new Error('OAuth integration missing required fields');
    }

    const botToken = await decryptString(integration.bot_token_encrypted);
    const success = await postSlackMessage(
      botToken,
      integration.channel_id,
      message.text,
      message.blocks as unknown as Record<string, unknown>[]
    );

    if (!success) {
      throw new Error('Failed to post message via Slack API');
    }

    // Log the test
    await logIntegrationSend(
      integrationId,
      integration.workspace_id,
      'success',
      JSON.stringify(message),
      null,
      { type: 'test', method: 'oauth' }
    );

    return true;
  } catch (error) {
    console.error('Failed to send test message: %s', error);
    await logIntegrationSend(
      integrationId,
      integration.workspace_id,
      'failure',
      JSON.stringify(message),
      error instanceof Error ? error.message : 'Unknown error',
      { type: 'test' }
    );
    return false;
  }
}

/**
 * Format assignee data into a Slack message
 */
export function formatAssigneeReport(
  workspaceName: string,
  assignees: AssigneeData[],
  totalIssues: number,
  workspaceId: string
): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 Issue Assignee Report - ${workspaceName}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Total Open Issues:* ${totalIssues}\n*Active Assignees:* ${assignees.length}`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // Add each assignee as a section
  assignees.forEach((assignee, index) => {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${index + 1}. ${assignee.login}*\n📝 ${assignee.issue_count} issue${assignee.issue_count !== 1 ? 's' : ''} · 📦 ${assignee.repository_count} repo${assignee.repository_count !== 1 ? 's' : ''}`,
      },
    });
  });

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Generated on ${new Date().toLocaleString()} | <https://contributor.info/workspace/${workspaceId}|View Workspace>`,
        },
      ],
    }
  );

  return {
    text: `Issue Assignee Report for ${workspaceName}`,
    blocks,
  };
}

/**
 * Send an assignee report to Slack
 */
export async function sendAssigneeReport(
  integrationId: string,
  assignees: AssigneeData[],
  totalIssues: number,
  workspaceName: string,
  workspaceId: string
): Promise<boolean> {
  const integration = await getSlackIntegration(integrationId);
  if (!integration || !integration.enabled) {
    return false;
  }

  // Format the message
  const message = formatAssigneeReport(workspaceName, assignees, totalIssues, workspaceId);

  try {
    // Check if OAuth or webhook
    const isOAuth = isOAuthIntegration(integration);

    if (isOAuth) {
      // Use OAuth method (delegate to sendOAuthReport for consistency)
      return sendOAuthReport(integrationId, assignees, totalIssues, workspaceName, workspaceId);
    }

    // Webhook flow
    if (!integration.webhook_url_encrypted) {
      throw new Error('Webhook integration missing webhook URL');
    }

    const webhookUrl = await decryptString(integration.webhook_url_encrypted);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Slack API returned ${response.status}`);
    }

    // Log the successful send
    await logIntegrationSend(integrationId, workspaceId, 'success', JSON.stringify(message), null, {
      assignee_count: assignees.length,
      total_issues: totalIssues,
      method: 'webhook',
    });

    // Update last_sent_at
    await supabase
      .from('slack_integrations')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', integrationId);

    return true;
  } catch (error) {
    console.error('Failed to send assignee report: %s', error);
    await logIntegrationSend(
      integrationId,
      workspaceId,
      'failure',
      JSON.stringify(message),
      error instanceof Error ? error.message : 'Unknown error',
      {
        assignee_count: assignees.length,
        total_issues: totalIssues,
      }
    );
    return false;
  }
}

/**
 * Log an integration send attempt
 */
async function logIntegrationSend(
  integrationId: string,
  workspaceId: string,
  status: 'success' | 'failure' | 'pending',
  messageSent: string | null,
  errorMessage: string | null,
  metadata: Record<string, unknown>
): Promise<IntegrationLog | null> {
  const { data, error } = await supabase
    .from('integration_logs')
    .insert({
      integration_id: integrationId,
      workspace_id: workspaceId,
      status,
      message_sent: messageSent,
      error_message: errorMessage,
      metadata,
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Failed to log integration send: %s', error.message);
    return null;
  }

  return data;
}

/**
 * Get integration logs for a workspace
 */
export async function getIntegrationLogs(
  workspaceId: string,
  limit = 50
): Promise<IntegrationLog[]> {
  const { data, error } = await supabase
    .from('integration_logs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('sent_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch integration logs: %s', error.message);
    return [];
  }

  return data || [];
}

/**
 * OAuth-specific helper functions
 */

/**
 * Get channels available for a Slack integration (OAuth only)
 */
export async function getChannelsForIntegration(integrationId: string): Promise<SlackChannel[]> {
  // Use Supabase client with user session token for secure authentication
  const { data, error } = await supabase.functions.invoke('slack-list-channels', {
    body: { integration_id: integrationId },
  });

  if (error) {
    console.error('Failed to fetch channels from backend: %s', error.message);
    throw new Error(error.message || 'Failed to fetch channels');
  }

  return data.channels;
}

/**
 * Update integration with selected channel
 */
export async function setIntegrationChannel(
  integrationId: string,
  channelId: string,
  channelName: string
): Promise<void> {
  const { error } = await supabase
    .from('slack_integrations')
    .update({
      channel_id: channelId,
      channel_name: channelName,
      enabled: true, // Enable once channel is selected
    })
    .eq('id', integrationId);

  if (error) {
    console.error('Failed to update channel: %s', error.message);
    throw new Error('Failed to update channel');
  }
}

/**
 * Check if integration is properly configured
 * All integrations now use OAuth, so we check for required OAuth fields
 */
export function isOAuthIntegration(integration: SlackIntegration): boolean {
  // All integrations are OAuth-based now
  return !!(integration.bot_token_encrypted && integration.slack_team_id);
}

/**
 * Send an assignee report using OAuth Web API (for OAuth integrations)
 */
export async function sendOAuthReport(
  integrationId: string,
  assignees: AssigneeData[],
  totalIssues: number,
  workspaceName: string,
  workspaceId: string
): Promise<boolean> {
  const integration = await getSlackIntegration(integrationId);
  if (
    !integration ||
    !integration.enabled ||
    !integration.bot_token_encrypted ||
    !integration.channel_id
  ) {
    return false;
  }

  // Decrypt the bot token
  const botToken = await decryptString(integration.bot_token_encrypted);

  // Format the message (reuse existing formatter)
  const message = formatAssigneeReport(workspaceName, assignees, totalIssues, workspaceId);

  try {
    const success = await postSlackMessage(
      botToken,
      integration.channel_id,
      message.text,
      message.blocks as unknown as Record<string, unknown>[]
    );

    if (!success) {
      throw new Error('Failed to post message to Slack');
    }

    // Log the successful send
    await logIntegrationSend(integrationId, workspaceId, 'success', JSON.stringify(message), null, {
      assignee_count: assignees.length,
      total_issues: totalIssues,
      type: 'oauth',
    });

    // Update last_sent_at
    await supabase
      .from('slack_integrations')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', integrationId);

    return true;
  } catch (error) {
    console.error('Failed to send OAuth report: %s', error);
    await logIntegrationSend(
      integrationId,
      workspaceId,
      'failure',
      JSON.stringify(message),
      error instanceof Error ? error.message : 'Unknown error',
      {
        assignee_count: assignees.length,
        total_issues: totalIssues,
        type: 'oauth',
      }
    );
    return false;
  }
}
