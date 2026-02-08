import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { decryptString } from '../../encryption';
import { postSlackMessage } from '../../../services/slack-api.service';

/**
 * Assignee distribution data structure from RPC function
 */
interface AssigneeData {
  login: string;
  avatar_url: string;
  issue_count: number;
  repository_count: number;
}

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
 * Format assignee data into a Slack message
 */
function formatAssigneeReport(
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
 * Cron job to send Slack assignee reports for enabled integrations
 * Runs daily at 9 AM UTC to send reports to configured Slack channels
 *
 * Strategy:
 * - Finds all enabled Slack integrations (OAuth and Webhook) that are due for sending
 * - Fetches assignee distribution data using the optimized RPC function
 * - Formats and sends reports via Slack Web API (OAuth) or Webhook URL
 * - Logs all send attempts for audit trail
 * - Updates next_scheduled_at for next run
 */
export const sendSlackAssigneeReportCron = inngest.createFunction(
  {
    id: 'send-slack-assignee-report-cron',
    name: 'Send Slack Assignee Report (Cron)',
    retries: 2,
    concurrency: {
      limit: 1, // Only one instance can run at a time
      key: 'slack-report-cron', // Global concurrency key
    },
  },
  { cron: '0 9 * * *' }, // Run daily at 9 AM UTC
  async ({ step }) => {
    // Step 1: Find all enabled integrations that are due for sending
    const integrations = await step.run('get-enabled-integrations', async () => {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('slack_integrations')
        .select(
          `
          id,
          workspace_id,
          channel_name,
          channel_id,
          bot_token_encrypted,
          slack_team_id,
          schedule,
          config,
          workspaces!inner(
            id,
            name,
            slug
          )
        `
        )
        .eq('enabled', true)
        .lte('next_scheduled_at', now)
        .not('bot_token_encrypted', 'is', null);

      if (error) {
        console.error('Error fetching Slack integrations: %s', error.message);
        return [];
      }

      return data || [];
    });

    if (integrations.length === 0) {
      return { message: 'No integrations due for sending', count: 0 };
    }

    console.log('Found %d integrations to process', integrations.length);

    // Step 2: Process each integration
    const results = await Promise.all(
      integrations.map(async (integration) => {
        return step.run(`send-report-${integration.id}`, async () => {
          try {
            // Check if we've already sent a report recently (within last hour)
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
              console.log(
                'Skipping integration %s - report sent recently at %s',
                integration.id,
                recentLog.created_at
              );
              return {
                integration_id: integration.id,
                status: 'skipped',
                reason: 'Report sent recently',
                last_sent: recentLog.created_at,
              };
            }

            // Get workspace repositories for filtering
            const { data: workspaceRepos } = await supabase
              .from('workspace_repositories')
              .select('repository_id')
              .eq('workspace_id', integration.workspace_id);

            const repositoryIds =
              integration.config.repositoryIds && integration.config.repositoryIds.length > 0
                ? integration.config.repositoryIds
                : workspaceRepos?.map((r: { repository_id: string }) => r.repository_id) || [];

            if (repositoryIds.length === 0) {
              console.log('No repositories found for workspace %s', integration.workspace_id);
              return {
                integration_id: integration.id,
                status: 'skipped',
                reason: 'No repositories',
              };
            }

            // Fetch assignee distribution using the optimized RPC function
            const { data: assignees, error: assigneeError } = await supabase.rpc(
              'calculate_assignee_distribution',
              {
                p_repository_ids: repositoryIds,
                p_exclude_bots: integration.config.excludeBots ?? true,
                p_limit: integration.config.maxAssignees ?? 10,
              }
            );

            if (assigneeError) {
              console.error('Error fetching assignee distribution: %s', assigneeError.message);
              throw new Error(assigneeError.message);
            }

            if (!assignees || assignees.length === 0) {
              console.log('No assignees found for workspace %s', integration.workspace_id);
              return {
                integration_id: integration.id,
                status: 'skipped',
                reason: 'No assignees',
              };
            }

            // Calculate total issues
            const totalIssues = (assignees as AssigneeData[]).reduce(
              (sum, a) => sum + a.issue_count,
              0
            );

            // Format the Slack message
            // @ts-expect-error - Supabase returns workspaces as array from join but we know it's a single object
            const workspaceName = integration.workspaces?.name || 'Workspace';
            const message = formatAssigneeReport(
              workspaceName,
              assignees as AssigneeData[],
              totalIssues,
              integration.workspace_id
            );

            // Send to Slack via OAuth integration
            if (!integration.bot_token_encrypted) {
              throw new Error('Integration missing bot token');
            }

            if (!integration.channel_id) {
              throw new Error('OAuth integration missing channel_id');
            }

            const botToken = await decryptString(integration.bot_token_encrypted);
            const success = await postSlackMessage(
              botToken,
              integration.channel_id,
              message.text,
              message.blocks as unknown as Record<string, unknown>[]
            );

            if (!success) {
              throw new Error('Failed to send message to Slack');
            }

            // Log successful send
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

            // Update last_sent_at and next_scheduled_at
            const nextScheduledAt = calculateNextScheduledAt(integration.schedule);
            await supabase
              .from('slack_integrations')
              .update({
                last_sent_at: new Date().toISOString(),
                next_scheduled_at: nextScheduledAt,
              })
              .eq('id', integration.id);

            console.log('Successfully sent report to %s', integration.channel_name);

            return {
              integration_id: integration.id,
              status: 'success',
              assignee_count: assignees.length,
              total_issues: totalIssues,
            };
          } catch (error) {
            console.error('Failed to send report for integration %s: %s', integration.id, error);

            // Log failure
            await supabase.from('integration_logs').insert({
              integration_id: integration.id,
              workspace_id: integration.workspace_id,
              status: 'failure',
              message_sent: null,
              error_message: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                type: 'scheduled',
              },
            });

            // Still update next_scheduled_at so we retry next time
            const nextScheduledAt = calculateNextScheduledAt(integration.schedule);
            await supabase
              .from('slack_integrations')
              .update({
                next_scheduled_at: nextScheduledAt,
              })
              .eq('id', integration.id);

            return {
              integration_id: integration.id,
              status: 'failure',
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        });
      })
    );

    const successCount = results.filter((r) => r.status === 'success').length;
    const failureCount = results.filter((r) => r.status === 'failure').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;

    return {
      message: 'Slack reports processed',
      total: integrations.length,
      success: successCount,
      failure: failureCount,
      skipped: skippedCount,
      results,
    };
  }
);

/**
 * Calculate the next scheduled time based on schedule type
 */
function calculateNextScheduledAt(schedule: string): string {
  const now = new Date();

  if (schedule === 'daily') {
    // Next day at 9 AM UTC
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(9, 0, 0, 0);
    return next.toISOString();
  }

  if (schedule === 'weekly') {
    // Next Monday at 9 AM UTC
    const next = new Date(now);
    const dayOfWeek = next.getUTCDay();

    // Calculate days until next Monday
    let daysUntilMonday;
    if (dayOfWeek === 1) {
      // It's Monday - schedule for next Monday
      daysUntilMonday = 7;
    } else if (dayOfWeek === 0) {
      // It's Sunday - Monday is tomorrow
      daysUntilMonday = 1;
    } else {
      // Tuesday through Saturday - calculate days until Monday
      daysUntilMonday = 8 - dayOfWeek;
    }

    next.setUTCDate(next.getUTCDate() + daysUntilMonday);
    next.setUTCHours(9, 0, 0, 0);
    return next.toISOString();
  }

  // Default to daily
  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(9, 0, 0, 0);
  return next.toISOString();
}
