/**
 * Utility functions for workspace route generation with fallback support
 */

export interface WorkspaceIdentifier {
  slug?: string | null;
  id?: string | null;
}

/**
 * Generate workspace route with fallback to ID if slug is not available
 * @param workspace - Workspace object with slug and/or id
 * @param subpath - Optional subpath to append (e.g., 'settings', 'contributors')
 * @returns Safe workspace route string
 */
export function getWorkspaceRoute(
  workspace: WorkspaceIdentifier | null | undefined,
  subpath?: string
): string {
  if (!workspace) {
    console.warn('getWorkspaceRoute called with null/undefined workspace');
    return '/workspaces';
  }

  const identifier = workspace.slug || workspace.id;

  if (!identifier) {
    console.warn('Workspace has neither slug nor id', workspace);
    return '/workspaces';
  }

  const basePath = `/i/${identifier}`;
  return subpath ? `${basePath}/${subpath}` : basePath;
}

/**
 * Check if a workspace identifier is valid
 */
export function isValidWorkspaceIdentifier(
  workspace: WorkspaceIdentifier | null | undefined
): boolean {
  return !!(workspace && (workspace.slug || workspace.id));
}

/**
 * Get workspace identifier (slug or id) with proper fallback
 */
export function getWorkspaceIdentifier(
  workspace: WorkspaceIdentifier | null | undefined
): string | null {
  if (!workspace) return null;
  return workspace.slug || workspace.id || null;
}

/**
 * Generate workspace settings route
 */
export function getWorkspaceSettingsRoute(
  workspace: WorkspaceIdentifier | null | undefined
): string {
  return getWorkspaceRoute(workspace, 'settings');
}

/**
 * Generate workspace contributors route
 */
export function getWorkspaceContributorsRoute(
  workspace: WorkspaceIdentifier | null | undefined
): string {
  return getWorkspaceRoute(workspace, 'contributors');
}

/**
 * Generate workspace PRs route
 */
export function getWorkspacePRsRoute(workspace: WorkspaceIdentifier | null | undefined): string {
  return getWorkspaceRoute(workspace, 'prs');
}
