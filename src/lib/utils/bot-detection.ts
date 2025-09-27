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

// Known bot patterns
const KNOWN_BOT_PATTERNS = [
  /\[bot\]$/i, // Standard [bot] suffix
  /^dependabot\[?bot\]?$/i, // Dependabot (exact)
  /^renovate\[?bot\]?$/i, // Renovate (exact)
  /^github-actions\[?bot\]?$/i, // GitHub Actions (exact)
  /-bot$/i, // Ends with -bot
] as const;

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

  for (const pattern of KNOWN_BOT_PATTERNS) {
    if (pattern.test(username)) {
      return true;
    }
  }

  return false;
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
export function isBot(input: BotDetectionInput | { isBot?: boolean; username: string }): boolean {
  // Handle legacy interface for backward compatibility
  if ('username' in input && !('githubUser' in input)) {
    const legacyInput = input as { isBot?: boolean; username: string };
    return legacyInput.isBot === true || legacyInput.username.toLowerCase().includes('bot');
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