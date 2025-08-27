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
