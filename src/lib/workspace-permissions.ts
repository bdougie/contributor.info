import { supabase } from '@/lib/supabase';

export interface WorkspacePermission {
  canRemoveContributors: boolean;
  canAddContributors: boolean;
  canManageMembers: boolean;
  role: 'owner' | 'admin' | 'editor' | 'viewer' | null;
  isAuthenticated: boolean;
}

/**
 * Check user's permissions for a workspace
 */
export async function getWorkspacePermissions(workspaceId: string): Promise<WorkspacePermission> {
  try {
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        canRemoveContributors: false,
        canAddContributors: false,
        canManageMembers: false,
        role: null,
        isAuthenticated: false,
      };
    }

    // Check if user is the workspace owner
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();

    if (workspace?.owner_id === user.id) {
      return {
        canRemoveContributors: true,
        canAddContributors: true,
        canManageMembers: true,
        role: 'owner',
        isAuthenticated: true,
      };
    }

    // Check user's role in workspace_members
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return {
        canRemoveContributors: false,
        canAddContributors: false,
        canManageMembers: false,
        role: null,
        isAuthenticated: true,
      };
    }

    const role = member.role as 'admin' | 'editor' | 'viewer';

    return {
      canRemoveContributors: role === 'admin' || role === 'editor',
      canAddContributors: role === 'admin' || role === 'editor',
      canManageMembers: role === 'admin',
      role,
      isAuthenticated: true,
    };
  } catch (error) {
    console.error('Error checking workspace permissions: %s', error);
    return {
      canRemoveContributors: false,
      canAddContributors: false,
      canManageMembers: false,
      role: null,
      isAuthenticated: false,
    };
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
