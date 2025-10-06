/**
 * GitHub emoji code to Unicode emoji mapping
 * Based on GitHub's emoji list
 */
const GITHUB_EMOJI_MAP: Record<string, string> = {
  // Common discussion/communication emojis
  ':pray:': '🙏',
  ':question:': '❓',
  ':hash:': '#️⃣',
  ':speech_balloon:': '💬',
  ':bulb:': '💡',
  ':rocket:': '🚀',
  ':sparkles:': '✨',
  ':tada:': '🎉',
  ':mega:': '📣',
  ':loudspeaker:': '📢',
  ':bell:': '🔔',

  // Reaction emojis
  ':heart:': '❤️',
  ':+1:': '👍',
  ':thumbsup:': '👍',
  ':-1:': '👎',
  ':thumbsdown:': '👎',
  ':eyes:': '👀',
  ':fire:': '🔥',
  ':clap:': '👏',

  // Status/workflow emojis
  ':heavy_check_mark:': '✅',
  ':white_check_mark:': '✅',
  ':x:': '❌',
  ':warning:': '⚠️',
  ':construction:': '🚧',
  ':lock:': '🔒',
  ':unlock:': '🔓',

  // Tech/code emojis
  ':bug:': '🐛',
  ':wrench:': '🔧',
  ':hammer:': '🔨',
  ':gear:': '⚙️',
  ':package:': '📦',
  ':memo:': '📝',
  ':pencil2:': '✏️',
  ':books:': '📚',
  ':book:': '📖',

  // People emojis
  ':wave:': '👋',
  ':raised_hand:': '✋',
  ':point_right:': '👉',
  ':point_left:': '👈',
  ':point_up:': '☝️',
  ':point_down:': '👇',
};

/**
 * Convert GitHub emoji code to Unicode emoji
 * @param code - GitHub emoji code (e.g., ":pray:")
 * @returns Unicode emoji or the original code if not found
 */
export function convertGithubEmoji(code: string | null | undefined): string {
  if (!code) return '';

  // Remove quotes if present
  const cleanCode = code.replace(/['"]/g, '');

  return GITHUB_EMOJI_MAP[cleanCode] || cleanCode;
}

/**
 * Convert all GitHub emoji codes in a string to Unicode emojis
 * @param text - Text containing emoji codes
 * @returns Text with emojis converted
 */
export function convertAllGithubEmojis(text: string): string {
  return text.replace(/:[\w+-]+:/g, (match) => convertGithubEmoji(match));
}
