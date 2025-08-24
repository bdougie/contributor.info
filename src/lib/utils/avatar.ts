/**
 * Centralized avatar utility for consistent avatar handling across the app
 */

import { DEFAULT_AVATAR_DATA_URL } from './default-avatar-data';

/**
 * Get a properly formatted avatar URL with fallback support
 * @param username - GitHub username or identifier
 * @param originalUrl - Optional original avatar URL
 * @returns Formatted avatar URL with fallback
 */
export function getAvatarUrl(username?: string, originalUrl?: string): string {
  // If we have a valid original URL, use it
  if (originalUrl) {
    try {
      const url = new URL(originalUrl);
      // Return GitHub avatar URLs as-is since they're already optimized
      const allowedGitHubAvatarHosts = ['avatars.githubusercontent.com'];
      if (allowedGitHubAvatarHosts.includes(url.hostname)) {
        return originalUrl;
      }
      // For non-GitHub URLs, return as-is
      return originalUrl;
    } catch {
      // Invalid URL, treat as relative path
      if (originalUrl && !originalUrl.startsWith('http')) {
        return originalUrl;
      }
    }
  }

  // If we have a username but no URL, try to construct GitHub avatar URL
  if (username) {
    return `https://avatars.githubusercontent.com/u/${username}`;
  }

  // Return local fallback avatar
  return getFallbackAvatar();
}

/**
 * Get a fallback avatar URL
 * @returns Base64 encoded fallback avatar data URL
 */
export function getFallbackAvatar(): string {
  return DEFAULT_AVATAR_DATA_URL;
}

/**
 * Get organization avatar URL with fallback
 * @param orgName - Organization name
 * @returns Organization avatar URL with fallback
 */
export function getOrgAvatarUrl(orgName?: string): string {
  if (!orgName) {
    return getFallbackAvatar();
  }
  
  // Try GitHub org avatar first
  return `https://github.com/${orgName}.png`;
}

/**
 * Get repository owner avatar URL with fallback
 * @param owner - Repository owner name
 * @returns Owner avatar URL with fallback
 */
export function getRepoOwnerAvatarUrl(owner?: string): string {
  if (!owner) {
    return getFallbackAvatar();
  }
  
  // Use GitHub avatar URL for repo owners
  return `https://github.com/${owner}.png`;
}