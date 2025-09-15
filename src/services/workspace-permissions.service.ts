/**
 * Workspace Permissions Service
 * Centralized permission management for workspace operations
 */

import type { WorkspaceRole, WorkspaceTier, Workspace } from '@/types/workspace';

/**
 * Permission types for workspace operations
 */
export type WorkspacePermission =
  | 'view_workspace'
  | 'edit_workspace'
  | 'delete_workspace'
  | 'add_repository'
  | 'remove_repository'
  | 'invite_member'
  | 'remove_member'
  | 'change_member_role'
  | 'view_analytics'
  | 'export_data'
  | 'manage_billing';

/**
 * Role permission matrix
 */
const ROLE_PERMISSIONS: Record<WorkspaceRole, WorkspacePermission[]> = {
  owner: [
    'view_workspace',
    'edit_workspace',
    'delete_workspace',
    'add_repository',
    'remove_repository',
    'invite_member',
    'remove_member',
    'change_member_role',
    'view_analytics',
    'export_data',
    'manage_billing',
  ],
  maintainer: [
    'view_workspace',
    'edit_workspace',
    'add_repository',
    'remove_repository',
    'invite_member', // Can only invite contributors
    'remove_member', // Can only remove contributors
    'change_member_role', // Can only change contributor roles
    'view_analytics',
    'export_data',
  ],
  contributor: ['view_workspace', 'view_analytics'],
};

/**
 * Workspace Permissions Service
 */
export class WorkspacePermissionService {
  /**
   * Check if a role has a specific permission
   */
  static hasPermission(
    role: WorkspaceRole | null | undefined,
    permission: WorkspacePermission | null | undefined,
    context?: { targetRole?: WorkspaceRole }
  ): boolean {
    // Null checks
    if (!role || !permission) {
      return false;
    }

    // Base permission check
    const hasBase = ROLE_PERMISSIONS[role]?.includes(permission) ?? false;

    // Additional context-based checks
    if (context?.targetRole && permission === 'change_member_role') {
      // Maintainers can only change contributor roles
      if (role === 'maintainer' && context.targetRole !== 'contributor') {
        return false;
      }
      // Cannot change owner role
      if (context.targetRole === 'owner') {
        return false;
      }
    }

    return hasBase;
  }

  /**
   * Get tier limits
   */
  static getTierLimits(tier: WorkspaceTier): {
    maxMembers: number;
    maxRepositories: number;
    features: string[];
  } {
    switch (tier) {
      case 'free':
        return {
          maxMembers: 1,
          maxRepositories: 3,
          features: ['basic_analytics', 'public_workspaces'],
        };
      case 'pro':
        return {
          maxMembers: 5, // Aligned with documentation: Pro tier supports up to 5 members
          maxRepositories: 50,
          features: [
            'basic_analytics',
            'advanced_analytics',
            'private_workspaces',
            'team_collaboration',
            'export_data',
          ],
        };
      case 'enterprise':
        return {
          maxMembers: 100,
          maxRepositories: 500,
          features: [
            'basic_analytics',
            'advanced_analytics',
            'private_workspaces',
            'team_collaboration',
            'export_data',
            'custom_branding',
            'priority_support',
            'audit_logs',
            'sso',
          ],
        };
      default:
        // Default to free tier limits for safety
        return {
          maxMembers: 1,
          maxRepositories: 3,
          features: ['basic_analytics', 'public_workspaces'],
        };
    }
  }

  /**
   * Check if user can perform an action on the workspace
   */
  static canPerformAction(
    userRole: WorkspaceRole,
    action: WorkspacePermission,
    context?: {
      targetRole?: WorkspaceRole;
      workspaceTier?: WorkspaceTier;
    }
  ): boolean {
    // Basic permission check
    if (!this.hasPermission(userRole, action)) {
      return false;
    }

    // Additional context-based checks
    switch (action) {
      case 'invite_member':
        // Check tier limits for invitations
        if (context?.workspaceTier === 'free') {
          return false; // Free tier cannot invite members
        }
        // Maintainers can only invite contributors
        if (userRole === 'maintainer' && context?.targetRole === 'maintainer') {
          return false;
        }
        break;

      case 'remove_member':
        // Maintainers can only remove contributors
        if (userRole === 'maintainer' && context?.targetRole !== 'contributor') {
          return false;
        }
        // Cannot remove owner
        if (context?.targetRole === 'owner') {
          return false;
        }
        break;

      case 'change_member_role':
        // Maintainers can only change contributor roles
        if (userRole === 'maintainer' && context?.targetRole !== 'contributor') {
          return false;
        }
        // Cannot change owner role
        if (context?.targetRole === 'owner') {
          return false;
        }
        break;
    }

    return true;
  }

  /**
   * Check if user can invite members
   * Note: This should be called within a database transaction to prevent race conditions
   */
  static canInviteMembers(
    userRole: WorkspaceRole,
    tier: WorkspaceTier | undefined,
    currentMemberCount: number,
    targetRole?: WorkspaceRole
  ): { allowed: boolean; reason?: string } {
    // Handle missing subscription data gracefully
    if (!tier) {
      console.warn('Subscription tier data unavailable, defaulting to free tier limits');
      tier = 'free';
    }

    // Free tier cannot invite members
    if (tier === 'free') {
      return {
        allowed: false,
        reason: 'Upgrade to Pro to invite team members',
      };
    }

    // Check role permissions
    if (!this.hasPermission(userRole, 'invite_member')) {
      return {
        allowed: false,
        reason: 'You do not have permission to invite members',
      };
    }

    // Maintainers can only invite contributors
    if (userRole === 'maintainer' && targetRole === 'maintainer') {
      return {
        allowed: false,
        reason: 'Only owners can invite maintainers',
      };
    }

    // Check member limits
    const memberLimits: Record<WorkspaceTier, number> = {
      free: 1, // Owner only
      pro: 5,
      enterprise: -1, // Unlimited
    };

    const limit = memberLimits[tier];
    if (limit !== -1 && currentMemberCount >= limit) {
      return {
        allowed: false,
        reason: `You have reached the member limit (${limit}) for your ${tier} plan`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can remove a member
   */
  static canRemoveMember(
    userRole: WorkspaceRole,
    targetMember: { role: WorkspaceRole; user_id: string },
    currentUserId: string
  ): { allowed: boolean; reason?: string } {
    // Users can always leave (remove themselves)
    if (targetMember.user_id === currentUserId) {
      return { allowed: true };
    }

    // Check base permission
    if (!this.hasPermission(userRole, 'remove_member')) {
      return {
        allowed: false,
        reason: 'You do not have permission to remove members',
      };
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return {
        allowed: false,
        reason: 'Cannot remove the workspace owner',
      };
    }

    // Maintainers can only remove contributors
    if (userRole === 'maintainer' && targetMember.role !== 'contributor') {
      return {
        allowed: false,
        reason: 'Maintainers can only remove contributors',
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can change a member's role
   */
  static canChangeMemberRole(
    userRole: WorkspaceRole,
    targetMember: { role: WorkspaceRole; user_id: string },
    newRole: WorkspaceRole,
    currentUserId: string
  ): { allowed: boolean; reason?: string } {
    // Cannot change own role
    if (targetMember.user_id === currentUserId) {
      return {
        allowed: false,
        reason: 'You cannot change your own role',
      };
    }

    // Check base permission
    if (!this.hasPermission(userRole, 'change_member_role')) {
      return {
        allowed: false,
        reason: 'You do not have permission to change member roles',
      };
    }

    // Cannot change owner role
    if (targetMember.role === 'owner' || newRole === 'owner') {
      return {
        allowed: false,
        reason: 'Ownership transfer requires special process',
      };
    }

    // Maintainers can only change contributor roles
    if (userRole === 'maintainer') {
      if (targetMember.role !== 'contributor') {
        return {
          allowed: false,
          reason: 'Maintainers can only modify contributor roles',
        };
      }
      if (newRole === 'maintainer') {
        return {
          allowed: false,
          reason: 'Only owners can promote members to maintainer',
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Check if user can add repositories
   */
  static canAddRepositories(
    userRole: WorkspaceRole,
    workspace: Pick<Workspace, 'current_repository_count' | 'max_repositories'>
  ): { allowed: boolean; reason?: string } {
    // Check role permission
    if (!this.hasPermission(userRole, 'add_repository')) {
      return {
        allowed: false,
        reason: 'You do not have permission to add repositories',
      };
    }

    // Check repository limit
    if (workspace.current_repository_count >= workspace.max_repositories) {
      return {
        allowed: false,
        reason: `Repository limit reached (${workspace.max_repositories})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Check if user can remove repositories
   */
  static canRemoveRepositories(userRole: WorkspaceRole): boolean {
    return this.hasPermission(userRole, 'remove_repository');
  }

  /**
   * Check if user can edit workspace settings
   */
  static canEditWorkspace(userRole: WorkspaceRole): boolean {
    return this.hasPermission(userRole, 'edit_workspace');
  }

  /**
   * Check if user can delete workspace
   */
  static canDeleteWorkspace(userRole: WorkspaceRole): boolean {
    return this.hasPermission(userRole, 'delete_workspace');
  }

  /**
   * Check if user can view analytics
   */
  static canViewAnalytics(userRole: WorkspaceRole): boolean {
    return this.hasPermission(userRole, 'view_analytics');
  }

  /**
   * Check if user can export data
   */
  static canExportData(userRole: WorkspaceRole, tier: WorkspaceTier): boolean {
    // Export is a premium feature
    if (tier === 'free') {
      return false;
    }
    return this.hasPermission(userRole, 'export_data');
  }

  /**
   * Check if user can manage billing
   */
  static canManageBilling(userRole: WorkspaceRole): boolean {
    return this.hasPermission(userRole, 'manage_billing');
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: WorkspaceRole): WorkspacePermission[] {
    return ROLE_PERMISSIONS[role] ?? [];
  }

  /**
   * Get UI visibility flags based on role and tier
   */
  static getUIPermissions(
    userRole: WorkspaceRole,
    workspace: Pick<Workspace, 'tier' | 'current_repository_count' | 'max_repositories'>,
    memberCount: number
  ) {
    return {
      // Repository management
      canAddRepository: this.canAddRepositories(userRole, workspace).allowed,
      canRemoveRepository: this.canRemoveRepositories(userRole),

      // Member management
      canInviteMember: this.canInviteMembers(userRole, workspace.tier, memberCount, 'contributor')
        .allowed,
      canRemoveMember: this.hasPermission(userRole, 'remove_member'),
      canChangeMemberRole: this.hasPermission(userRole, 'change_member_role'),

      // Workspace management
      canEditSettings: this.canEditWorkspace(userRole),
      canDeleteWorkspace: this.canDeleteWorkspace(userRole),
      canManageBilling: this.canManageBilling(userRole),

      // Data access
      canViewAnalytics: this.canViewAnalytics(userRole),
      canExportData: this.canExportData(userRole, workspace.tier),

      // Display states
      showUpgradePrompt: workspace.tier === 'free' && userRole === 'owner',
      showMemberLimitWarning: workspace.tier === 'pro' && memberCount >= 4,
      showRepositoryLimitWarning:
        workspace.current_repository_count >= workspace.max_repositories - 1,
      isViewOnly: userRole === 'contributor',
    };
  }

  /**
   * Format permission denial message
   */
  static getPermissionDenialMessage(
    action: WorkspacePermission,
    userRole: WorkspaceRole,
    context?: { tier?: WorkspaceTier }
  ): string {
    const messages: Record<WorkspacePermission, string> = {
      view_workspace: 'You do not have permission to view this workspace',
      edit_workspace: 'Only owners and maintainers can edit workspace settings',
      delete_workspace: 'Only workspace owners can delete workspaces',
      add_repository:
        userRole === 'contributor'
          ? 'Contributors cannot add repositories. Contact a maintainer.'
          : 'You have reached your repository limit',
      remove_repository: 'Only owners and maintainers can remove repositories',
      invite_member:
        context?.tier === 'free'
          ? 'Upgrade to Pro to invite team members'
          : 'You do not have permission to invite members',
      remove_member: 'You do not have permission to remove members',
      change_member_role: 'You do not have permission to change member roles',
      view_analytics: 'You do not have permission to view analytics',
      export_data:
        context?.tier === 'free'
          ? 'Data export is available in Pro and Enterprise plans'
          : 'You do not have permission to export data',
      manage_billing: 'Only workspace owners can manage billing',
    };

    return messages[action] ?? 'You do not have permission to perform this action';
  }
}

// Export convenience functions
export const {
  hasPermission,
  canPerformAction,
  canInviteMembers,
  canRemoveMember,
  canChangeMemberRole,
  canAddRepositories,
  canRemoveRepositories,
  canEditWorkspace,
  canDeleteWorkspace,
  canViewAnalytics,
  canExportData,
  canManageBilling,
  getRolePermissions,
  getUIPermissions,
  getPermissionDenialMessage,
} = WorkspacePermissionService;
