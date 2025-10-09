/**
 * XSS Protection Utilities
 * Sanitizes user-generated content to prevent XSS attacks
 */

import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks
 * Allows basic formatting but strips dangerous tags and attributes
 */
export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize plain text by escaping HTML entities
 * Use for displaying user text that should not contain any HTML
 */
export function sanitizeText(text: string): string {
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize URLs to prevent javascript: and data: URIs
 */
export function sanitizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http, https, and mailto protocols
    if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return url;
    }
    return '#';
  } catch {
    return '#';
  }
}

/**
 * Sanitize username/title for display
 * Removes any potentially dangerous characters
 */
export function sanitizeUsername(username: string): string {
  // Remove any HTML tags and scripts
  const cleaned = DOMPurify.sanitize(username, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Additional validation: only allow alphanumeric, dash, underscore
  return cleaned.replace(/[^a-zA-Z0-9-_]/g, '');
}
