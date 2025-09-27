/**
 * Centralized Bot Detection Utility
 *
 * This module provides a single source of truth for detecting GitHub bots
 * across all data ingestion and processing points in the application.
 *
 * Combines three detection strategies:
 * 1. GitHub API user.type === 'Bot'
 * 2. Username pattern matching [bot] suffix
 * 3. Database is_bot flag (for cached data)
 */

// Known bot patterns beyond [bot] suffix
const KNOWN_BOT_PATTERNS = [
  /\[bot\]$/i, // Standard [bot] suffix - high confidence
  /^dependabot/i, // Dependabot variations (dependabot, dependabot-test, etc.)
  /^renovate/i, // Renovate variations (renovate, renovate-bot, etc.)
  /^github-actions/i, // GitHub Actions variations
  /^codecov\[?bot\]?$/i, // Codecov bot with optional [bot] suffix
  /^greenkeeper\[?bot\]?$/i, // Greenkeeper (legacy) with optional [bot] suffix
  /^snyk-bot$/i, // Snyk security bot (exact match)
  /^allcontributors\[?bot\]?$/i, // All Contributors bot with optional [bot] suffix
  // Specific known bot patterns that end with -bot
  /^dependabot-/i, // dependabot-preview, etc.
  /^renovate-bot$/i, // exact match for renovate-bot
  /^(cypress|semantic-release|commitizen)-bot$/i, // specific tool bots
] as const;

/**
 * Input types for bot detection
 */
export interface GitHubUser {
  type?: 'Bot' | 'User' | string;
  login: string;
}

export interface DatabaseContributor {
  is_bot?: boolean;
  username?: string;
}

export interface BotDetectionInput {
  githubUser?: GitHubUser;
  contributor?: DatabaseContributor;
  username?: string;
  type?: string;
}

/**
 * Bot detection result
 */
export interface BotDetectionResult {
  isBot: boolean;
  confidence: 'high' | 'medium' | 'low';
  detectedBy: ('github_type' | 'username_pattern' | 'database_flag')[];
  reasoning: string;
}

/**
 * Detect if a username matches known bot patterns
 */
function detectBotFromUsername(username: string): { isBot: boolean; pattern?: RegExp } {
  if (!username) return { isBot: false };

  for (const pattern of KNOWN_BOT_PATTERNS) {
    if (pattern.test(username)) {
      return { isBot: true, pattern };
    }
  }

  return { isBot: false };
}

/**
 * Main bot detection function - single source of truth
 *
 * Priority order:
 * 1. GitHub API type (highest confidence)
 * 2. Username pattern matching (medium confidence)
 * 3. Database flag (low confidence - might be stale)
 */
export function detectBot(input: BotDetectionInput): BotDetectionResult {
  const detectedBy: BotDetectionResult['detectedBy'] = [];
  let isBot = false;
  let confidence: BotDetectionResult['confidence'] = 'low';
  const reasons: string[] = [];

  // Extract username from various input sources
  const username = input.githubUser?.login || input.contributor?.username || input.username || '';

  // 1. Check GitHub API type (highest priority)
  if (input.githubUser?.type === 'Bot' || input.type === 'Bot') {
    isBot = true;
    confidence = 'high';
    detectedBy.push('github_type');
    reasons.push('GitHub API reports user type as Bot');
  }

  // 2. Check username patterns (medium priority)
  const usernameCheck = detectBotFromUsername(username);
  if (usernameCheck.isBot) {
    isBot = true;
    if (confidence === 'low') confidence = 'medium';
    detectedBy.push('username_pattern');
    reasons.push(`Username matches bot pattern: ${usernameCheck.pattern?.source || 'unknown'}`);
  }

  // 3. Check database flag (lowest priority - might be stale)
  if (input.contributor?.is_bot === true) {
    isBot = true;
    detectedBy.push('database_flag');
    reasons.push('Database contributor record flagged as bot');
  }

  // If database says not a bot but we detected it as a bot, prefer our detection
  if (input.contributor?.is_bot === false && isBot) {
    reasons.push('Database flag overridden by more reliable detection method');
  }

  return {
    isBot,
    confidence,
    detectedBy,
    reasoning: reasons.join('; ') || 'No bot indicators detected',
  };
}

/**
 * Simple boolean check - for cases where you just need true/false
 * Supports both the old interface (simple object) and new detection input
 */
export function isBot(input: BotDetectionInput | { isBot?: boolean; username: string }): boolean {
  // Handle legacy interface for backward compatibility
  if ('username' in input && !('githubUser' in input) && !('contributor' in input)) {
    const legacyInput = input as { isBot?: boolean; username: string };
    return legacyInput.isBot === true || legacyInput.username.toLowerCase().includes('bot');
  }

  // Use the new detection logic
  return detectBot(input as BotDetectionInput).isBot;
}

/**
 * Utility for creating GitHub user type from bot detection
 */
export function getGitHubUserType(input: BotDetectionInput): 'Bot' | 'User' {
  return isBot(input) ? 'Bot' : 'User';
}

/**
 * Get list of all known bot usernames for testing/validation
 */
export function getKnownBotUsernames(): string[] {
  return [
    'dependabot[bot]',
    'github-actions[bot]',
    'renovate[bot]',
    'codecov[bot]',
    'stale[bot]',
    'greenkeeper[bot]',
    'snyk-bot',
    'allcontributors[bot]',
    'dependabot-preview[bot]',
    'renovate-bot',
  ];
}

/**
 * Validate that a contributor record has consistent bot classification
 */
export function validateBotClassification(
  githubUser: GitHubUser,
  contributor: DatabaseContributor
): { isConsistent: boolean; recommendation: boolean; reason: string } {
  const githubDetection = detectBot({ githubUser });
  const dbDetection = detectBot({ contributor });

  const isConsistent = githubDetection.isBot === dbDetection.isBot;

  return {
    isConsistent,
    recommendation: githubDetection.isBot, // Trust GitHub data more
    reason: isConsistent
      ? 'Classifications match'
      : `GitHub detection: ${githubDetection.isBot}, DB: ${dbDetection.isBot} - recommend GitHub value`,
  };
}

/**
 * Filters items based on bot inclusion preferences
 * @param items - Array of items with author property
 * @param includeBots - Whether to include bots in the results
 * @returns Filtered array based on bot inclusion preference
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
 * @param items - Array of items with author property
 * @returns true if any item is from a bot
 */
export function hasBotAuthors<T extends { author: { isBot?: boolean; username: string } }>(
  items: T[]
): boolean {
  return items.some((item) => isBot(item.author));
}
