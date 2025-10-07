/**
 * Centralized avatar utility for consistent avatar handling across the app
 */

import { DEFAULT_AVATAR_DATA_URL } from './default-avatar-data';

/**
 * Get a properly formatted avatar URL with fallback support
 * @param _username - GitHub username or identifier (not used, kept for compatibility)
 * @param originalUrl - Optional cached avatar URL from Supabase
 * @returns Formatted avatar URL with fallback
 */
export function getAvatarUrl(_username?: string, originalUrl?: string): string {
  // If we have a cached URL, use it
  if (originalUrl) {
    try {
      const url = new URL(originalUrl);
      // Return any valid HTTPS URL (including Supabase storage URLs)
      if (url.protocol === 'https:') {
        return originalUrl;
      }
    } catch {
      // Invalid URL, treat as relative path
      if (originalUrl && !originalUrl.startsWith('http')) {
        return originalUrl;
      }
    }
  }

  // Return local fallback avatar (do not construct GitHub URLs)
  // All avatars should come from Supabase cache
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
 * @param _orgName - Organization name (not used, kept for compatibility)
 * @param cachedUrl - Optional cached URL from Supabase
 * @returns Organization avatar URL with fallback
 */
export function getOrgAvatarUrl(_orgName?: string, cachedUrl?: string): string {
  if (!_orgName) {
    return getFallbackAvatar();
  }

  // Prefer cached URL from Supabase if available
  if (cachedUrl) {
    return cachedUrl;
  }

  // Return fallback avatar (do not construct GitHub URLs)
  // Organization avatars should be fetched from Supabase or use default
  return getFallbackAvatar();
}

/**
 * Get repository owner avatar URL with fallback
 * @param _owner - Repository owner name (not used, kept for compatibility)
 * @param cachedUrl - Optional cached URL from Supabase
 * @returns Owner avatar URL with fallback
 */
export function getRepoOwnerAvatarUrl(_owner?: string, cachedUrl?: string): string {
  if (!_owner) {
    return getFallbackAvatar();
  }

  // Prefer cached URL from Supabase if available
  if (cachedUrl) {
    return cachedUrl;
  }

  // Fallback to default avatar (not GitHub API)
  // Repository avatars should be fetched from Supabase or use default
  return getFallbackAvatar();
}
