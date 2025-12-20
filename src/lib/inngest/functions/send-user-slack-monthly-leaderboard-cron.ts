import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { decryptString } from '../../encryption';
import { postSlackMessage } from '../../../services/slack-api.service';
import type { LeaderboardEntry, SlackBlock, SlackMessage } from '../../../types/user-slack';

/**
 * User Slack integration with repository data
 */
interface UserSlackIntegrationWithRepo {
  id: string;
  user_id: string;
  repository_id: string;
  channel_id: string;
  channel_name: string;
  slack_team_id: string;
  slack_team_name: string | null;
  bot_token_encrypted: string;
  enabled: boolean;
  last_sent_at: string | null;
  repositories: {
    id: string;
    owner: string;
    name: string;
  };
}

/**
 * Format leaderboard data into a Slack message with blocks
 */
function formatLeaderboardMessage(
  owner: string,
  repo: string,
  month: number,
  year: number,
  rankings: LeaderboardEntry[]
): SlackMessage {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const monthName = monthNames[month - 1];

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Monthly Leaderboard: ${owner}/${repo} - ${monthName} ${year}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Top ${rankings.length} contributors for ${monthName} ${year}*`,
      },
    },
    {
      type: 'divider',
    },
  ];

  // Add each contributor
  rankings.forEach((entry, index) => {
    const getMedal = (position: number): string => {
      switch (position) {
        case 0:
          return ':first_place_medal:';
        case 1:
          return ':second_place_medal:';
        case 2:
          return ':third_place_medal:';
        default:
          return `${position + 1}.`;
      }
    };
    const medal = getMedal(index);

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${medal} *${entry.display_name || entry.username}* - ${entry.weighted_score} pts\n    :git-pull-request: ${entry.pull_requests_count} PRs  :mag: ${entry.reviews_count} reviews  :speech_balloon: ${entry.comments_count} comments`,
      },
      accessory: {
        type: 'image',
        image_url: entry.avatar_url,
        alt_text: entry.username,
      },
    });
  });

  // Add footer with link
  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `<https://contributor.info/${owner}/${repo}|View full leaderboard on contributor.info>`,
        },
      ],
    }
  );

  return {
    text: `Monthly Leaderboard for ${owner}/${repo} - ${monthName} ${year}`,
    blocks,
  };
}

/**
 * Get the previous month and year
 */
function getPreviousMonth(): { month: number; year: number } {
  const now = new Date();
  const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return {
    month: previousMonth.getUTCMonth() + 1, // 1-indexed
    year: previousMonth.getUTCFullYear(),
  };
}

/**
 * Cron job to send monthly leaderboard messages for user Slack integrations
 * Runs on the 1st of each month at 9 AM UTC
 *
 * Strategy:
 * - Finds all enabled user Slack integrations
 * - Fetches monthly rankings for each repository
 * - Formats and sends leaderboard via Slack Web API
 * - Logs all send attempts for audit trail
 * - Updates last_sent_at timestamp
 */
export const sendUserSlackMonthlyLeaderboardCron = inngest.createFunction(
  {
    id: 'send-user-slack-monthly-leaderboard-cron',
    name: 'Send User Slack Monthly Leaderboard (Cron)',
    retries: 2,
    concurrency: {
      limit: 1, // Only one instance can run at a time
      key: 'user-slack-leaderboard-cron',
    },
  },
  { cron: '0 9 1 * *' }, // Run at 9 AM UTC on the 1st of each month
  async ({ step }) => {
    // Get previous month (we send the finalized leaderboard for the month that just ended)
    const { month, year } = getPreviousMonth();

    // Step 1: Find all enabled user Slack integrations
    const integrations = await step.run('get-enabled-integrations', async () => {
      const { data, error } = await supabase
        .from('user_slack_integrations')
        .select(
          `
          id,
          user_id,
          repository_id,
          channel_id,
          channel_name,
          slack_team_id,
          slack_team_name,
          bot_token_encrypted,
          enabled,
          last_sent_at,
          repositories!inner (
            id,
            owner,
            name
          )
        `
        )
        .eq('enabled', true)
        .not('channel_id', 'is', null)
        .neq('channel_id', 'pending'); // Skip integrations awaiting channel selection

      if (error) {
        console.error('Error fetching user Slack integrations: %s', error.message);
        throw new Error(`Failed to fetch user Slack integrations: ${error.message}`);
      }

      return (data as unknown as UserSlackIntegrationWithRepo[]) || [];
    });

    if (integrations.length === 0) {
      return { message: 'No enabled user Slack integrations found', count: 0 };
    }

    console.log('Found %d user Slack integrations to process', integrations.length);

    // Step 2: Process each integration
    const results = await Promise.all(
      integrations.map(async (integration) => {
        return step.run(`send-leaderboard-${integration.id}`, async () => {
          try {
            const { owner, name: repo } = integration.repositories;

            // Fetch monthly rankings for the repository
            // Call the calculate-monthly-rankings edge function
            const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            const supabaseAnonKey =
              process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !supabaseAnonKey) {
              throw new Error('Supabase URL or Anon Key not configured');
            }

            const rankingsResponse = await fetch(
              `${supabaseUrl}/functions/v1/calculate-monthly-rankings`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${supabaseAnonKey}`,
                },
                body: JSON.stringify({
                  owner,
                  repo,
                  month,
                  year,
                  limit: 10,
                }),
              }
            );

            if (!rankingsResponse.ok) {
              const errorText = await rankingsResponse.text();
              console.error('Failed to fetch rankings for %s/%s: %s', owner, repo, errorText);
              throw new Error(`Failed to fetch rankings: ${rankingsResponse.status}`);
            }

            const rankingsData = await rankingsResponse.json();
            const rankings: LeaderboardEntry[] = rankingsData.rankings || [];

            if (rankings.length === 0) {
              console.log('No rankings found for %s/%s for %d/%d', owner, repo, month, year);
              return {
                integration_id: integration.id,
                status: 'skipped',
                reason: 'No rankings data',
              };
            }

            // Format the Slack message
            const message = formatLeaderboardMessage(owner, repo, month, year, rankings);

            // Decrypt bot token and send message
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
            await supabase.from('user_slack_integration_logs').insert({
              integration_id: integration.id,
              status: 'success',
              message_sent: message,
              error_message: null,
              metadata: {
                month,
                year,
                rankings_count: rankings.length,
                repository: `${owner}/${repo}`,
              },
            });

            // Update last_sent_at
            await supabase
              .from('user_slack_integrations')
              .update({
                last_sent_at: new Date().toISOString(),
              })
              .eq('id', integration.id);

            console.log(
              'Successfully sent monthly leaderboard to %s for %s/%s',
              integration.channel_name,
              owner,
              repo
            );

            return {
              integration_id: integration.id,
              status: 'success',
              repository: `${owner}/${repo}`,
              rankings_count: rankings.length,
            };
          } catch (error) {
            console.error(
              'Failed to send leaderboard for integration %s: %s',
              integration.id,
              error
            );

            // Log failure
            await supabase.from('user_slack_integration_logs').insert({
              integration_id: integration.id,
              status: 'failure',
              message_sent: null,
              error_message: error instanceof Error ? error.message : 'Unknown error',
              metadata: {
                month,
                year,
                repository: `${integration.repositories.owner}/${integration.repositories.name}`,
              },
            });

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
      message: 'User Slack monthly leaderboards processed',
      month,
      year,
      total: integrations.length,
      success: successCount,
      failure: failureCount,
      skipped: skippedCount,
      results,
    };
  }
);
