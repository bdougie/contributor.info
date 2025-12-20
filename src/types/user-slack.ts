/**
 * User Slack Integration Types
 * Type definitions for individual user repository Slack integrations
 */

/**
 * User Slack integration entity - one repo to one channel mapping
 */
export interface UserSlackIntegration {
  id: string;
  user_id: string;
  repository_id: string;
  channel_name: string;
  channel_id: string;
  slack_team_id: string;
  slack_team_name: string | null;
  bot_token_encrypted: string;
  bot_user_id: string | null;
  enabled: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User Slack integration with repository info for display
 */
export interface UserSlackIntegrationWithRepo extends UserSlackIntegration {
  repository: {
    id: string;
    owner: string;
    name: string;
  };
}

/**
 * Slack channel from API
 */
export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

/**
 * Input for creating a user Slack integration
 */
export interface CreateUserSlackIntegrationInput {
  owner: string;
  repo: string;
}

/**
 * Input for updating a user Slack integration
 */
export interface UpdateUserSlackIntegrationInput {
  channel_id?: string;
  channel_name?: string;
  enabled?: boolean;
}

/**
 * User Slack integration log entry
 */
export interface UserSlackIntegrationLog {
  id: string;
  integration_id: string;
  status: 'success' | 'failure' | 'pending';
  message_sent: Record<string, unknown> | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  sent_at: string;
}

/**
 * Monthly leaderboard data for Slack message
 */
export interface LeaderboardEntry {
  rank: number;
  username: string;
  display_name: string;
  avatar_url: string;
  pull_requests_count: number;
  reviews_count: number;
  comments_count: number;
  weighted_score: number;
}

/**
 * Slack message block structure
 */
export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  accessory?: {
    type: string;
    image_url?: string;
    alt_text?: string;
  };
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * Slack message payload
 */
export interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}
