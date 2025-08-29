/**
 * Security utilities for workspace analytics
 * Handles URL validation, sanitization, and permission checks
 */

/**
 * Validates if a URL is safe to open
 * @param url - URL to validate
 * @returns true if URL is safe, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    // Check for common XSS patterns
    if (url.includes('javascript:') || url.includes('data:') || url.includes('vbscript:')) {
      return false;
    }

    // Validate GitHub URLs for repository links
    if (url.includes('github.com')) {
      return isValidGitHubUrl(url);
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Validates GitHub URLs
 * @param url - GitHub URL to validate
 * @returns true if valid GitHub URL
 */
export function isValidGitHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Must be from github.com or api.github.com
    if (!['github.com', 'api.github.com', 'www.github.com'].includes(parsed.hostname)) {
      return false;
    }

    // Must use HTTPS
    if (parsed.protocol !== 'https:') {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a URL for safe usage
 * @param url - URL to sanitize
 * @returns sanitized URL or empty string if invalid
 */
export function sanitizeUrl(url: string): string {
  if (!isValidUrl(url)) {
    console.warn('Invalid URL attempted:', url);
    return '';
  }

  try {
    const parsed = new URL(url);
    // Remove any fragments or unnecessary parts
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return '';
  }
}

/**
 * Opens a URL safely in a new tab
 * @param url - URL to open
 * @returns true if opened, false if blocked
 */
export function openUrlSafely(url: string): boolean {
  const sanitized = sanitizeUrl(url);

  if (!sanitized) {
    console.error('Blocked attempt to open invalid URL:', url);
    return false;
  }

  // Use noopener and noreferrer for security
  window.open(sanitized, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Permission levels for workspace operations
 */
export enum WorkspacePermission {
  VIEW = 'view',
  EDIT = 'edit',
  ADMIN = 'admin',
  OWNER = 'owner',
}

/**
 * Checks if user has required permission level
 * @param userRole - User's current role
 * @param requiredPermission - Required permission level
 * @returns true if user has permission
 */
export function hasPermission(
  userRole: string | undefined,
  requiredPermission: WorkspacePermission
): boolean {
  if (!userRole) return false;

  const permissionHierarchy: Record<string, number> = {
    [WorkspacePermission.VIEW]: 1,
    [WorkspacePermission.EDIT]: 2,
    [WorkspacePermission.ADMIN]: 3,
    [WorkspacePermission.OWNER]: 4,
  };

  const userLevel = permissionHierarchy[userRole.toLowerCase()] || 0;
  const requiredLevel = permissionHierarchy[requiredPermission] || 999;

  return userLevel >= requiredLevel;
}

/**
 * Rate limiting configuration for export operations
 */
const EXPORT_RATE_LIMITS = {
  free: { requests: 5, windowMs: 60 * 60 * 1000 }, // 5 per hour
  pro: { requests: 20, windowMs: 60 * 60 * 1000 }, // 20 per hour
  enterprise: { requests: 100, windowMs: 60 * 60 * 1000 }, // 100 per hour
};

/**
 * Simple in-memory rate limiter for exports
 */
class ExportRateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Checks if export is allowed based on rate limits
   * @param userId - User ID
   * @param tier - User's subscription tier
   * @returns true if allowed, false if rate limited
   */
  checkLimit(userId: string, tier: 'free' | 'pro' | 'enterprise' = 'free'): boolean {
    const now = Date.now();
    const limit = EXPORT_RATE_LIMITS[tier];

    // Get user's request history
    const userRequests = this.requests.get(userId) || [];

    // Filter out old requests outside the window
    const recentRequests = userRequests.filter((timestamp) => now - timestamp < limit.windowMs);

    // Check if under limit
    if (recentRequests.length >= limit.requests) {
      return false;
    }

    // Add new request
    recentRequests.push(now);
    this.requests.set(userId, recentRequests);

    return true;
  }

  /**
   * Gets remaining requests for a user
   * @param userId - User ID
   * @param tier - User's subscription tier
   * @returns number of remaining requests
   */
  getRemainingRequests(userId: string, tier: 'free' | 'pro' | 'enterprise' = 'free'): number {
    const now = Date.now();
    const limit = EXPORT_RATE_LIMITS[tier];

    const userRequests = this.requests.get(userId) || [];
    const recentRequests = userRequests.filter((timestamp) => now - timestamp < limit.windowMs);

    return Math.max(0, limit.requests - recentRequests.length);
  }
}

export const exportRateLimiter = new ExportRateLimiter();

/**
 * Validates export request
 * @param userId - User ID
 * @param tier - User's subscription tier
 * @param format - Export format requested
 * @returns validation result
 */
export function validateExportRequest(
  userId: string,
  tier: 'free' | 'pro' | 'enterprise',
  format: 'csv' | 'json' | 'pdf'
): { allowed: boolean; reason?: string; remaining?: number } {
  // Check tier permissions for format
  const allowedFormats: Record<string, string[]> = {
    free: [],
    pro: ['csv', 'json'],
    enterprise: ['csv', 'json', 'pdf'],
  };

  if (!allowedFormats[tier].includes(format)) {
    return {
      allowed: false,
      reason: `${format.toUpperCase()} export is not available in ${tier} tier`,
    };
  }

  // Check rate limits
  if (!exportRateLimiter.checkLimit(userId, tier)) {
    return {
      allowed: false,
      reason: 'Export rate limit exceeded. Please try again later.',
      remaining: 0,
    };
  }

  return {
    allowed: true,
    remaining: exportRateLimiter.getRemainingRequests(userId, tier),
  };
}
