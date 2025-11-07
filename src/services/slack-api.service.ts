/**
 * Slack Web API Service
 * Handles communication with Slack API using bot tokens (OAuth-based)
 */

import type { SlackChannel } from '../types/workspace';

const SLACK_API_BASE = 'https://slack.com/api';

/**
 * Fetch list of channels the bot has access to
 */
export async function getSlackChannels(botToken: string): Promise<SlackChannel[]> {
  try {
    const response = await fetch(`${SLACK_API_BASE}/conversations.list?types=public_channel,private_channel&limit=200`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error: %s', data.error);
      throw new Error(data.error || 'Failed to fetch channels');
    }

    return data.channels.map((ch: {
      id: string;
      name: string;
      is_private: boolean;
      is_member: boolean;
    }) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_member: ch.is_member,
    }));
  } catch (error) {
    console.error('Failed to fetch Slack channels: %s', error);
    throw error;
  }
}

/**
 * Post a message to a Slack channel using blocks
 */
export async function postSlackMessage(
  botToken: string,
  channelId: string,
  text: string,
  blocks: Record<string, unknown>[]
): Promise<boolean> {
  try {
    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        text, // Fallback text for notifications
        blocks,
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error: %s', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to post Slack message: %s', error);
    return false;
  }
}

/**
 * Get info about a specific channel
 */
export async function getChannelInfo(
  botToken: string,
  channelId: string
): Promise<SlackChannel | null> {
  try {
    const response = await fetch(`${SLACK_API_BASE}/conversations.info?channel=${channelId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!data.ok) {
      console.error('Slack API error: %s', data.error);
      return null;
    }

    const ch = data.channel;
    return {
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_member: ch.is_member,
    };
  } catch (error) {
    console.error('Failed to fetch channel info: %s', error);
    return null;
  }
}
