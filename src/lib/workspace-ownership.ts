/**
 * Workspace Ownership Resolution
 * Pure functions for determining workspace ownership with fallback logic.
 *
 * After migration 20251021000000, workspace.owner_id references app_users.id.
 * But some workspaces may still have auth.users.id as owner_id if they were
 * created before the migration or the migration missed them.
 */

export interface OwnershipResult {
  isOwner: boolean;
  /** 'app_user' = matched app_users.id, 'auth_fallback' = matched auth.users.id, 'none' = no match */
  matchType: 'app_user' | 'auth_fallback' | 'none';
}

/**
 * Determine if the current user owns a workspace.
 * Primary check: compare owner_id against app_users.id
 * Fallback: also check auth.users.id for pre-migration workspaces
 */
export function resolveWorkspaceOwnership(
  ownerId: string,
  appUserId: string | null,
  authUserId: string | null
): OwnershipResult {
  if (appUserId && ownerId === appUserId) {
    return { isOwner: true, matchType: 'app_user' };
  }

  if (authUserId && ownerId === authUserId) {
    return { isOwner: true, matchType: 'auth_fallback' };
  }

  return { isOwner: false, matchType: 'none' };
}
