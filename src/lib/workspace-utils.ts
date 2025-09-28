/**
 * Utilities for workspace management
 */

/**
 * Generate a URL-safe slug from a workspace name
 * @param name - The workspace name
 * @returns A URL-safe slug
 */
export function generateWorkspaceSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Check if a string is a valid workspace ID (UUID format)
 * @param str - The string to check
 * @returns True if it's a valid UUID
 */
export function isWorkspaceId(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Parse a workspace identifier (could be slug or ID)
 * @param identifier - The workspace identifier from URL
 * @returns Object indicating if it's an ID or slug
 */
export function parseWorkspaceIdentifier(identifier: string): {
  isId: boolean;
  isSlug: boolean;
  value: string;
} {
  const isId = isWorkspaceId(identifier);
  return {
    isId,
    isSlug: !isId,
    value: identifier,
  };
}

/**
 * Format workspace URL based on slug or ID
 * @param workspace - The workspace object
 * @returns The formatted URL path
 */
export function getWorkspaceUrl(workspace: { id: string; slug?: string; name?: string }): string {
  // Prefer slug if available, otherwise use ID
  const identifier = workspace.slug || generateWorkspaceSlug(workspace.name || '') || workspace.id;
  return `/i/${identifier}`;
}

/**
 * Get a reliable identifier for workspace navigation
 * Prioritizes slug but falls back to ID if slug is missing
 * @param workspace - Workspace object or undefined
 * @param fallbackId - Optional fallback ID if workspace is undefined
 * @returns Slug or ID for navigation
 */
export function getWorkspaceIdentifier(
  workspace: { slug?: string; id: string } | undefined | null,
  fallbackId?: string
): string {
  // If we have a workspace object
  if (workspace) {
    return workspace.slug || workspace.id;
  }

  // If we have a fallback ID
  if (fallbackId) {
    return fallbackId;
  }

  // This should not happen, but provides a safe fallback
  console.error('No workspace identifier available');
  return '';
}

/**
 * Build a workspace route with proper slug/ID handling
 * @param workspace - Workspace object or undefined
 * @param path - Optional sub-path (e.g., 'settings', 'members')
 * @param fallbackId - Optional fallback ID if workspace is undefined
 * @returns Full route path
 */
export function buildWorkspaceRoute(
  workspace: { slug?: string; id: string } | undefined | null,
  path?: string,
  fallbackId?: string
): string {
  const identifier = getWorkspaceIdentifier(workspace, fallbackId);

  if (!identifier) {
    // Return home route if no identifier available
    return '/';
  }

  const basePath = `/i/${identifier}`;
  return path ? `${basePath}/${path}` : basePath;
}

/**
 * Ensure workspace has a slug
 * @param workspace - The workspace object
 * @returns Workspace with slug guaranteed
 */
export function ensureWorkspaceSlug<T extends { id: string; name?: string; slug?: string }>(
  workspace: T
): T & { slug: string } {
  return {
    ...workspace,
    slug: workspace.slug || generateWorkspaceSlug(workspace.name || workspace.id),
  };
}
