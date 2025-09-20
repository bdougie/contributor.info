/**
 * Utility functions for bot detection across the application
 */

/**
 * Determines if a user is a bot based on their properties
 * @param user - User object with isBot flag and username
 * @returns true if the user is identified as a bot
 */
export function isBot(user: { isBot?: boolean; username: string }): boolean {
  return user.isBot === true || user.username.toLowerCase().includes('bot');
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
