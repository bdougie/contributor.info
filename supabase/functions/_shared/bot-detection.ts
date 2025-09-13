/**
 * Shared Bot Detection Utility for Supabase Functions
 * 
 * This is a Deno-compatible version of the bot detection utility
 * for use in Supabase Edge Functions.
 */

// Known bot patterns beyond [bot] suffix
const KNOWN_BOT_PATTERNS = [
  /\[bot\]$/i, // Standard [bot] suffix
  /^dependabot/i, // Dependabot variations
  /^renovate/i, // Renovate variations
  /^github-actions/i, // GitHub Actions variations
  /^copilot/i, // GitHub Copilot variations
  /-bot$/i, // ends with -bot
  /^.*-bot$/i, // any prefix followed by -bot
  /^.*bot$/i, // ends with bot (but not [bot])
  /^codecov/i, // Codecov variations
  /^allcontributors/i, // All Contributors bot
  /^imgbot/i, // ImgBot
  /^semantic-release-bot/i, // Semantic Release bot
  /^snyk-bot/i, // Snyk bot (exact match)
  /^snyk/i, // Snyk bots
  /^whitesource/i, // WhiteSource
  /^pyup-bot/i, // PyUp bot
  /^pyup/i, // PyUp bots
  /^stale/i, // Stale bot
  /^weblate/i, // Weblate
  /^crowdin/i, // Crowdin
  /^linguist/i, // Linguist
  /^sourcery-ai/i, // Sourcery AI
  /^sourcery/i, // Sourcery bots
  /^deepsource/i, // DeepSource
  /^gitpod-io/i, // Gitpod IO
  /^gitpod/i, // Gitpod bots
  /^codesandbox/i, // CodeSandbox
  /^netlify/i, // Netlify
  /^vercel/i, // Vercel
  /^houndci/i, // Hound CI
  /^codeclimate/i, // Code Climate
  /^sonarcloud/i, // SonarCloud
  /^depfu/i, // Depfu
  /^security/i, // Security bots
  /^lgtm-com/i, // LGTM
  /^lgtm/i, // LGTM bots
  /^pullrequest/i, // Pull Request bots
  /^auto-merge/i, // Auto merge bots
  /^merge-me/i, // Merge me bots
  /^auto-fix/i, // Auto fix bots
  /^auto/i, // Auto bots
  /-ci$/i, // CI suffix
  /^ci-/i, // CI prefix
] as const;

/**
 * Input types for bot detection
 */
export interface GitHubUser {
  id?: number;
  login: string;
  type?: 'Bot' | 'User' | string;
  avatar_url?: string;
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
 */
export function isBot(input: BotDetectionInput): boolean {
  return detectBot(input).isBot;
}