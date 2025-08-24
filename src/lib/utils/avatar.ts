/**
 * Centralized avatar utility for consistent avatar handling across the app
 */

/**
 * Get a properly formatted avatar URL with fallback support
 * @param username - GitHub username or identifier
 * @param originalUrl - Optional original avatar URL
 * @returns Formatted avatar URL with fallback
 */
export function getAvatarUrl(username?: string, originalUrl?: string): string {
  // If we have an original URL and it's not a GitHub URL, use it
  if (originalUrl && !originalUrl.includes('github.com')) {
    return originalUrl;
  }

  // If no username, return fallback directly
  if (!username) {
    return getFallbackAvatar('unknown');
  }

  // Use unavatar.io service with GitHub provider and boring avatars fallback
  const fallbackUrl = getFallbackAvatar(username);
  return `https://unavatar.io/github/${username}?fallback=${encodeURIComponent(fallbackUrl)}`;
}

/**
 * Get a fallback avatar URL using boring avatars
 * @param identifier - Unique identifier for consistent avatar generation
 * @returns Boring avatars URL
 */
export function getFallbackAvatar(identifier: string): string {
  // Use boring avatars with marble style and a nice color palette
  const colors = '264653,2a9d8f,e9c46a,f4a261,e76f51';
  return `https://source.boringavatars.com/marble/120/${encodeURIComponent(identifier)}?colors=${colors}`;
}

/**
 * Get organization avatar URL with fallback
 * @param orgName - Organization name
 * @returns Organization avatar URL with fallback
 */
export function getOrgAvatarUrl(orgName?: string): string {
  if (!orgName) {
    return getFallbackAvatar('organization');
  }
  
  const fallbackUrl = getFallbackAvatar(orgName);
  return `https://unavatar.io/github/${orgName}?fallback=${encodeURIComponent(fallbackUrl)}`;
}

/**
 * Get repository owner avatar URL with fallback
 * @param owner - Repository owner name
 * @returns Owner avatar URL with fallback
 */
export function getRepoOwnerAvatarUrl(owner?: string): string {
  return getAvatarUrl(owner);
}