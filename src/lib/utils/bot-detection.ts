/**
 * Centralized Bot Detection Utility
 *
 * This module provides a single source of truth for detecting GitHub bots
 * across all data ingestion and processing points in the application.
 *
 * Combines detection strategies:
 * 1. GitHub API user.type === 'Bot'
 * 2. Username pattern matching [bot] suffix
 */

// Known bot patterns combined into a single regex for O(1) matching complexity
// Matches:
// - [bot] suffix (standard)
// - dependabot, renovate, github-actions, continue, snyk (exact or with [bot])
// - any username ending with -bot
const COMBINED_BOT_PATTERN = new RegExp(
  '(?:' +
    '\\[bot\\]$|' +
    '^dependabot(?:\\[bot\\])?$|' +
    '^renovate(?:\\[bot\\])?$|' +
    '^github-actions(?:\\[bot\\])?$|' +
    '^continue(?:\\[bot\\])?$|' +
    '^snyk(?:\\[bot\\])?$|' +
    '-bot$' +
    ')',
  'i'
);

/**
 * Input types for bot detection
 */
export interface GitHubUser {
  type?: 'Bot' | 'User' | string;
  login: string;
}

export interface BotDetectionInput {
  githubUser?: GitHubUser;
  username?: string;
  type?: string;
}

/**
 * Detect if a username matches known bot patterns
 */
function detectBotFromUsername(username: string): boolean {
  if (!username) return false;
  return COMBINED_BOT_PATTERN.test(username);
}

/**
 * Main bot detection function
 *
 * Priority order:
 * 1. GitHub API type (highest confidence)
 * 2. Username pattern matching
 */
export function detectBot(input: BotDetectionInput): { isBot: boolean } {
  // Check GitHub API type first (highest priority)
  if (input.githubUser?.type === 'Bot' || input.type === 'Bot') {
    return { isBot: true };
  }

  // Extract username from various input sources
  const username = input.githubUser?.login || input.username || '';

  // Check username patterns
  if (detectBotFromUsername(username)) {
    return { isBot: true };
  }

  return { isBot: false };
}

/**
 * Simple boolean check - for cases where you just need true/false
 * Supports both new and legacy interfaces for backward compatibility
 */
export function isBot(
  input: BotDetectionInput | { isBot?: boolean; username: string; type?: string }
): boolean {
  // Handle legacy interface for backward compatibility
  if ('username' in input && !('githubUser' in input)) {
    const legacyInput = input as { isBot?: boolean; username: string; type?: string };
    // Check all possible bot indicators for legacy compatibility
    return (
      legacyInput.isBot === true ||
      legacyInput.type === 'Bot' ||
      detectBotFromUsername(legacyInput.username)
    );
  }

  // Use the new detection logic
  return detectBot(input as BotDetectionInput).isBot;
}

/**
 * Filters items based on bot inclusion preferences
 */
export function filterByBotPreference<T extends { author: { isBot?: boolean; username: string } }>(
  items: T[],
  includeBots: boolean
): T[] {
  if (includeBots) {
    return items;
  }
  return items.filter((item) => !isBot(item.author));
}

/**
 * Checks if any items in an array are from bot users
 */
export function hasBotAuthors<T extends { author: { isBot?: boolean; username: string } }>(
  items: T[]
): boolean {
  return items.some((item) => isBot(item.author));
}
