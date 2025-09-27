/**
 * URL validation utilities to prevent XSS attacks through malicious URLs
 */

/**
 * Validates that a URL is safe to use (only http/https protocols)
 * Prevents XSS attacks via javascript:, data:, and other dangerous protocols
 */
export function isValidUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return false;

  try {
    const parsed = new URL(trimmedUrl);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    // If URL parsing fails, it might be a relative URL or invalid
    return false;
  }
}

/**
 * Validates a LinkedIn URL
 */
export function isValidLinkedInUrl(url: string | null | undefined): boolean {
  if (!isValidUrl(url)) return false;

  try {
    const parsed = new URL(url!);
    // LinkedIn URLs should be from linkedin.com or its subdomains
    return (
      parsed.hostname === 'linkedin.com' ||
      parsed.hostname === 'www.linkedin.com' ||
      parsed.hostname.endsWith('.linkedin.com')
    );
  } catch {
    return false;
  }
}

/**
 * Validates a Discord URL or username
 * Discord can be either a URL or a username prefixed with 'discord:'
 */
export function isValidDiscordUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return false;

  // Check if it's a Discord username (discord:username format)
  if (trimmedUrl.startsWith('discord:')) {
    const username = trimmedUrl.slice(8); // Remove 'discord:' prefix
    // Basic validation for Discord username
    return username.length > 0 && username.length <= 32 && !username.includes(' ');
  }

  // Otherwise validate as a regular URL
  if (!isValidUrl(trimmedUrl)) return false;

  try {
    const parsed = new URL(trimmedUrl);
    // Discord URLs should be from discord.com, discord.gg, or discordapp.com
    return (
      parsed.hostname === 'discord.com' ||
      parsed.hostname === 'www.discord.com' ||
      parsed.hostname === 'discord.gg' ||
      parsed.hostname === 'discordapp.com' ||
      parsed.hostname.endsWith('.discord.com') ||
      parsed.hostname.endsWith('.discordapp.com')
    );
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL by ensuring it's valid and safe
 * Returns null if the URL is invalid or potentially dangerous
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || !isValidUrl(url)) return null;

  try {
    // Normalize the URL
    const parsed = new URL(url.trim());
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Sanitizes a LinkedIn URL
 */
export function sanitizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url || !isValidLinkedInUrl(url)) return null;
  return sanitizeUrl(url);
}

/**
 * Sanitizes a Discord URL or username
 */
export function sanitizeDiscordUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  const trimmedUrl = url.trim();

  // Handle Discord username format
  if (trimmedUrl.startsWith('discord:')) {
    if (isValidDiscordUrl(trimmedUrl)) {
      return trimmedUrl;
    }
    return null;
  }

  // Handle regular URL
  if (!isValidDiscordUrl(trimmedUrl)) return null;
  return sanitizeUrl(trimmedUrl);
}

/**
 * Gets a safe href value for anchor tags
 * Returns # if the URL is invalid to prevent XSS
 */
export function getSafeHref(url: string | null | undefined): string {
  const sanitized = sanitizeUrl(url);
  return sanitized || '#';
}

/**
 * Checks if a URL can be safely opened in a new window
 */
export function canSafelyOpenUrl(url: string | null | undefined): boolean {
  return isValidUrl(url);
}
