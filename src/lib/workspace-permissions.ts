import { getSupabase } from '@/lib/supabase-lazy';
import { getAppUserId } from '@/lib/auth-helpers';
import { resolveWorkspaceOwnership } from '@/lib/workspace-ownership';

import type { WorkspaceRole } from '@/types/workspace';

export interface WorkspacePermission {
  canRemoveContributors: boolean;
  canAddContributors: boolean;
  canManageMembers: boolean;
  role: WorkspaceRole | null;
  isAuthenticated: boolean;
}

const CAN_EDIT_CONTRIBUTORS: ReadonlySet<WorkspaceRole> = new Set([
  'owner',
  'admin',
  'maintainer',
  'editor',
]);
const CAN_MANAGE_MEMBERS: ReadonlySet<WorkspaceRole> = new Set(['owner', 'admin', 'maintainer']);

/** Pure mapping from a membership role to what it may do. */
export function permissionsForRole(role: WorkspaceRole): WorkspacePermission {
  return {
    canRemoveContributors: CAN_EDIT_CONTRIBUTORS.has(role),
    canAddContributors: CAN_EDIT_CONTRIBUTORS.has(role),
    canManageMembers: CAN_MANAGE_MEMBERS.has(role),
    role,
    isAuthenticated: true,
  };
}

const NO_ACCESS: Omit<WorkspacePermission, 'isAuthenticated'> = {
  canRemoveContributors: false,
  canAddContributors: false,
  canManageMembers: false,
  role: null,
};

export interface PermissionInputs {
  /** auth.users.id of the signed-in user, or null when signed out. */
  authUserId: string | null;
  /** app_users.id for that user, or null when no app user row exists. */
  appUserId: string | null;
  /** workspaces.owner_id, or null when the workspace was not found. */
  ownerId: string | null;
  /** Role from the user's workspace_members row, or null when not a member. */
  memberRole: WorkspaceRole | null;
}

/**
 * Pure decision: who may do what, given the ids and role already looked up.
 *
 * workspaces.owner_id and workspace_members.user_id hold app_users.id, not
 * auth.users.id. Ownership still accepts an auth id match for workspaces
 * created before that migration.
 */
export function resolveWorkspacePermissions(inputs: PermissionInputs): WorkspacePermission {
  if (!inputs.authUserId) {
    return { ...NO_ACCESS, isAuthenticated: false };
  }

  const ownership = inputs.ownerId
    ? resolveWorkspaceOwnership(inputs.ownerId, inputs.appUserId, inputs.authUserId)
    : null;
  if (ownership?.isOwner) {
    return permissionsForRole('owner');
  }

  if (inputs.memberRole) {
    return permissionsForRole(inputs.memberRole);
  }

  return { ...NO_ACCESS, isAuthenticated: true };
}

/**
 * Check user's permissions for a workspace
 */
export async function getWorkspacePermissions(workspaceId: string): Promise<WorkspacePermission> {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return resolveWorkspacePermissions({
        authUserId: null,
        appUserId: null,
        ownerId: null,
        memberRole: null,
      });
    }

    const appUserId = await getAppUserId();

    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();

    const { data: member } = appUserId
      ? await supabase
          .from('workspace_members')
          .select('role')
          .eq('workspace_id', workspaceId)
          .eq('user_id', appUserId)
          .maybeSingle()
      : { data: null };

    return resolveWorkspacePermissions({
      authUserId: user.id,
      appUserId,
      ownerId: workspace?.owner_id ?? null,
      memberRole: (member?.role as WorkspaceRole | undefined) ?? null,
    });
  } catch (error) {
    console.error('Error checking workspace permissions: %s', error);
    return { ...NO_ACCESS, isAuthenticated: false };
  }
}

/**
 * Verify user has specific permission for a workspace operation
 */
export async function verifyWorkspacePermission(
  workspaceId: string,
  permission: keyof Omit<WorkspacePermission, 'role' | 'isAuthenticated'>
): Promise<{ allowed: boolean; message?: string }> {
  const permissions = await getWorkspacePermissions(workspaceId);

  if (!permissions.isAuthenticated) {
    return {
      allowed: false,
      message: 'You must be logged in to perform this action',
    };
  }

  if (!permissions[permission]) {
    const roleRequired =
      permission === 'canManageMembers' ? 'owner or admin' : 'owner, admin, or editor';

    return {
      allowed: false,
      message: `You must be a ${roleRequired} to perform this action`,
    };
  }

  return { allowed: true };
}
