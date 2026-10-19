/**
 * `cron/slack-assignee-report`: post the issue-assignee report to every
 * enabled workspace Slack integration that is due. Ported from
 * src/lib/inngest/functions/send-slack-assignee-report-cron.ts.
 */

import type { JobContext, JobPayload, JobResult } from './types.ts';

interface AssigneeData {
  login: string;
  avatar_url: string;
  issue_count: number;
  repository_count: number;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  elements?: { type: string; text: string }[];
}

interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}

interface IntegrationRow {
  id: string;
  workspace_id: string;
  channel_name: string | null;
  channel_id: string | null;
  bot_token_encrypted: string | null;
  schedule: string | null;
  config: { repositoryIds?: string[]; excludeBots?: boolean; maxAssignees?: number } | null;
  workspaces: { name?: string } | { name?: string }[] | null;
}

const SLACK_API_BASE = 'https://slack.com/api';

export function formatAssigneeReport(
  workspaceName: string,
  assignees: AssigneeData[],
  totalIssues: number,
  workspaceId: string,
): SlackMessage {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `📊 Issue Assignee Report - ${workspaceName}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Total Open Issues:* ${totalIssues}\n*Active Assignees:* ${assignees.length}`,
      },
    },
    { type: 'divider' },
  ];
  assignees.forEach((assignee, index) => {
    const issues = `${assignee.issue_count} issue${assignee.issue_count !== 1 ? 's' : ''}`;
    const repos = `${assignee.repository_count} repo${assignee.repository_count !== 1 ? 's' : ''}`;
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${index + 1}. ${assignee.login}*\n📝 ${issues} · 📦 ${repos}`,
      },
    });
  });
  blocks.push({ type: 'divider' }, {
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `Generated on ${
        new Date().toISOString()
      } | <https://contributor.info/workspace/${workspaceId}|View Workspace>`,
    }],
  });
  return { text: `Issue Assignee Report for ${workspaceName}`, blocks };
}

/** Next 09:00 UTC send: tomorrow for daily, next Monday for weekly. */
export function calculateNextScheduledAt(schedule: string | null, now = new Date()): string {
  const next = new Date(now);
  if (schedule === 'weekly') {
    const day = next.getUTCDay();
    const daysUntilMonday = day === 1 ? 7 : day === 0 ? 1 : 8 - day;
    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  } else {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  next.setUTCHours(9, 0, 0, 0);
  return next.toISOString();
}

async function postSlackMessage(
  botToken: string,
  channelId: string,
  text: string,
  blocks: SlackBlock[],
): Promise<boolean> {
  const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channelId, text, blocks }),
  });
  const data = await response.json() as { ok?: boolean; error?: string };
  if (!data.ok) {
    console.error('[slack-report] Slack API error: %s', data.error);
    return false;
  }
  return true;
}

export async function sendSlackAssigneeReports(
  ctx: JobContext,
  _payload: JobPayload,
): Promise<JobResult> {
  const { supabase } = ctx;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('slack_integrations')
    .select(
      'id, workspace_id, channel_name, channel_id, bot_token_encrypted, slack_team_id, schedule, config, workspaces!inner(id, name, slug)',
    )
    .eq('enabled', true)
    .lte('next_scheduled_at', now)
    .not('bot_token_encrypted', 'is', null);
  if (error) throw new Error(`Failed to list Slack integrations: ${error.message}`);

  const integrations = (data ?? []) as IntegrationRow[];
  if (integrations.length === 0) {
    return { message: 'No integrations due for sending', total: 0 };
  }

  // The encryption module reads SLACK_WEBHOOK_ENCRYPTION_KEY at import time
  // and throws without it; only load it once there is something to send.
  const { decryptString } = await import('../encryption.ts');

  const results: Record<string, unknown>[] = [];
  for (const integration of integrations) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recentLog } = await supabase
        .from('integration_logs')
        .select('id, created_at')
        .eq('integration_id', integration.id)
        .eq('status', 'success')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentLog) {
        results.push({
          integration_id: integration.id,
          status: 'skipped',
          reason: 'Report sent recently',
        });
        continue;
      }

      const { data: workspaceRepos } = await supabase
        .from('workspace_repositories')
        .select('repository_id')
        .eq('workspace_id', integration.workspace_id);
      const configured = integration.config?.repositoryIds;
      const repositoryIds = configured && configured.length > 0
        ? configured
        : ((workspaceRepos ?? []) as { repository_id: string }[]).map((r) => r.repository_id);
      if (repositoryIds.length === 0) {
        results.push({
          integration_id: integration.id,
          status: 'skipped',
          reason: 'No repositories',
        });
        continue;
      }

      const { data: assigneeRows, error: assigneeError } = await supabase.rpc(
        'calculate_assignee_distribution',
        {
          p_repository_ids: repositoryIds,
          p_exclude_bots: integration.config?.excludeBots ?? true,
          p_limit: integration.config?.maxAssignees ?? 10,
        },
      );
      if (assigneeError) throw new Error(assigneeError.message);
      const assignees = (assigneeRows ?? []) as AssigneeData[];
      if (assignees.length === 0) {
        results.push({ integration_id: integration.id, status: 'skipped', reason: 'No assignees' });
        continue;
      }

      const totalIssues = assignees.reduce((sum, a) => sum + a.issue_count, 0);
      const workspace = Array.isArray(integration.workspaces)
        ? integration.workspaces[0]
        : integration.workspaces;
      const message = formatAssigneeReport(
        workspace?.name || 'Workspace',
        assignees,
        totalIssues,
        integration.workspace_id,
      );

      if (!integration.bot_token_encrypted) throw new Error('Integration missing bot token');
      if (!integration.channel_id) throw new Error('OAuth integration missing channel_id');
      const botToken = await decryptString(integration.bot_token_encrypted);
      const sent = await postSlackMessage(
        botToken,
        integration.channel_id,
        message.text,
        message.blocks,
      );
      if (!sent) throw new Error('Failed to send message to Slack');

      await supabase.from('integration_logs').insert({
        integration_id: integration.id,
        workspace_id: integration.workspace_id,
        status: 'success',
        message_sent: JSON.stringify(message),
        error_message: null,
        metadata: {
          assignee_count: assignees.length,
          total_issues: totalIssues,
          type: 'scheduled',
          method: 'oauth',
        },
      });
      await supabase
        .from('slack_integrations')
        .update({
          last_sent_at: new Date().toISOString(),
          next_scheduled_at: calculateNextScheduledAt(integration.schedule),
        })
        .eq('id', integration.id);

      results.push({
        integration_id: integration.id,
        status: 'success',
        assignee_count: assignees.length,
        total_issues: totalIssues,
      });
    } catch (err) {
      const errorText = err instanceof Error ? err.message : String(err);
      console.error('[slack-report] integration %s failed: %s', integration.id, errorText);
      await supabase.from('integration_logs').insert({
        integration_id: integration.id,
        workspace_id: integration.workspace_id,
        status: 'failure',
        message_sent: null,
        error_message: errorText,
        metadata: { type: 'scheduled' },
      });
      await supabase
        .from('slack_integrations')
        .update({ next_scheduled_at: calculateNextScheduledAt(integration.schedule) })
        .eq('id', integration.id);
      results.push({ integration_id: integration.id, status: 'failure', error: errorText });
    }
  }

  const count = (status: string) => results.filter((r) => r.status === status).length;
  return {
    total: integrations.length,
    success: count('success'),
    failure: count('failure'),
    skipped: count('skipped'),
    results,
  };
}
