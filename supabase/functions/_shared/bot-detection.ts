/**
 * Bot Detection Utility for Supabase Edge Functions
 *
 * Detects GitHub bots using:
 * 1. GitHub API user.type === 'Bot'
 * 2. Username pattern matching
 */

const BOT_PATTERNS = [
  /\[bot\]$/i,
  /^dependabot\[?bot\]?$/i,
  /^renovate\[?bot\]?$/i,
  /^github-actions\[?bot\]?$/i,
  /^continue\[?bot\]?$/i,
  /^snyk\[?bot\]?$/i,
  /-bot$/i,
];

export function detectBot(user: { type?: string; login: string }): { isBot: boolean } {
  // Check GitHub API type
  if (user.type === 'Bot') {
    return { isBot: true };
  }

  // Check username patterns
  const username = user.login || '';
  for (const pattern of BOT_PATTERNS) {
    if (pattern.test(username)) {
      return { isBot: true };
    }
  }

  return { isBot: false };
}
