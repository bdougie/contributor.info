/**
 * Workspace Permissions Hook
 * Provides centralized permission checking and upgrade CTA components
 */

import { useMemo } from 'react';
import type { WorkspaceRole, WorkspaceTier, Workspace } from '@/types/workspace';
import { WorkspacePermissionService } from '@/services/workspace-permissions.service';
import {
  UPGRADE_MESSAGES,
  getUpgradeMessage,
  type UpgradeMessage,
} from '@/lib/copy/upgrade-messages';

export interface WorkspacePermissionsContext {
  userRole?: WorkspaceRole;
  workspaceTier?: WorkspaceTier;
  workspace?: Pick<Workspace, 'current_repository_count' | 'max_repositories' | 'tier'>;
  memberCount?: number;
  isLoggedIn?: boolean;
}

export interface WorkspacePermissions {
  // Repository permissions
  canAddRepository: boolean;
  canRemoveRepository: boolean;

  // Member permissions
  canInviteMember: boolean;
  canRemoveMember: boolean;
  canChangeMemberRole: boolean;

  // Group management permissions
  canManageGroups: boolean;
  canAssignContributorsToGroups: boolean;

  // Notes permissions
  canViewNotes: boolean;
  canAddNotes: boolean;

  // Workspace permissions
  canEditSettings: boolean;
  canDeleteWorkspace: boolean;
  canManageBilling: boolean;

  // Data permissions
  canViewAnalytics: boolean;
  canExportData: boolean;

  // UI state
  isViewOnly: boolean;
  showUpgradePrompt: boolean;
  showMemberLimitWarning: boolean;
  showRepositoryLimitWarning: boolean;

  // Upgrade messages for different features
  getUpgradeMessage: (feature: keyof typeof UPGRADE_MESSAGES) => UpgradeMessage;
  getGroupManagementMessage: () => UpgradeMessage;
  getGroupAssignmentMessage: () => UpgradeMessage;
  getMemberInvitationMessage: () => UpgradeMessage;
  getDataExportMessage: () => UpgradeMessage;
}

/**
 * Hook to get workspace permissions and upgrade messages
 */
export function useWorkspacePermissions(
  context: WorkspacePermissionsContext
): WorkspacePermissions {
  const {
    userRole,
    workspaceTier = 'free',
    workspace,
    memberCount = 0,
    isLoggedIn = false,
  } = context;

  return useMemo(() => {
    // Ensure workspace has required properties with defaults
    const workspaceWithDefaults = {
      current_repository_count: workspace?.current_repository_count ?? 0,
      max_repositories: workspace?.max_repositories ?? 3,
      tier: workspace?.tier ?? workspaceTier,
    };

    // Get base UI permissions from the service
    const basePermissions = userRole
      ? WorkspacePermissionService.getUIPermissions(
          userRole,
          workspaceWithDefaults,
          memberCount
        )
      : {
          canAddRepository: false,
          canRemoveRepository: false,
          canInviteMember: false,
          canRemoveMember: false,
          canChangeMemberRole: false,
          canEditSettings: false,
          canDeleteWorkspace: false,
          canManageBilling: false,
          canViewAnalytics: false,
          canExportData: false,
          showUpgradePrompt: false,
          showMemberLimitWarning: false,
          showRepositoryLimitWarning: false,
          isViewOnly: true,
        };

    // Group management permissions (new)
    const canManageGroups = userRole
      ? WorkspacePermissionService.hasPermission(userRole, 'manage_contributor_groups')
      : false;

    const canAssignContributorsToGroups = userRole
      ? WorkspacePermissionService.hasPermission(userRole, 'assign_contributors_to_groups')
      : false;

    // Notes permissions - only visible to workspace members
    const canViewNotes = isLoggedIn && !!userRole;
    const canAddNotes = canAssignContributorsToGroups;

    // Message generators
    const getUpgradeMessageForFeature = (feature: keyof typeof UPGRADE_MESSAGES) => {
      return getUpgradeMessage(feature, {
        userRole,
        workspaceTier,
        isLoggedIn,
      });
    };

    const getGroupManagementMessage = () => {
      if (!isLoggedIn) {
        return UPGRADE_MESSAGES.LOGIN_REQUIRED;
      }

      if (userRole === 'contributor') {
        return getUpgradeMessage('GROUP_MANAGEMENT', {
          userRole,
          workspaceTier,
          isLoggedIn,
        });
      }

      // For owners/maintainers, check if workspace tier supports groups
      if (workspaceTier === 'free') {
        return UPGRADE_MESSAGES.GROUP_MANAGEMENT;
      }

      // Should not reach here if permissions are working correctly
      return UPGRADE_MESSAGES.GROUP_MANAGEMENT;
    };

    const getGroupAssignmentMessage = () => {
      if (!isLoggedIn) {
        return UPGRADE_MESSAGES.LOGIN_REQUIRED;
      }

      return getUpgradeMessage('GROUP_ASSIGNMENT', {
        userRole,
        workspaceTier,
        isLoggedIn,
      });
    };

    const getMemberInvitationMessage = () => {
      if (!isLoggedIn) {
        return UPGRADE_MESSAGES.LOGIN_REQUIRED;
      }

      return getUpgradeMessage('MEMBER_INVITATION', {
        userRole,
        workspaceTier,
        isLoggedIn,
      });
    };

    const getDataExportMessage = () => {
      if (!isLoggedIn) {
        return UPGRADE_MESSAGES.LOGIN_REQUIRED;
      }

      return getUpgradeMessage('DATA_EXPORT', {
        userRole,
        workspaceTier,
        isLoggedIn,
      });
    };

    return {
      ...basePermissions,
      canManageGroups,
      canAssignContributorsToGroups,
      canViewNotes,
      canAddNotes,
      getUpgradeMessage: getUpgradeMessageForFeature,
      getGroupManagementMessage,
      getGroupAssignmentMessage,
      getMemberInvitationMessage,
      getDataExportMessage,
    };
  }, [userRole, workspaceTier, workspace, memberCount, isLoggedIn]);
}

/**
 * Hook specifically for group management permissions
 */
export function useGroupManagementPermissions(context: WorkspacePermissionsContext) {
  const permissions = useWorkspacePermissions(context);

  return {
    canManageGroups: permissions.canManageGroups,
    canAssignContributorsToGroups: permissions.canAssignContributorsToGroups,
    isViewOnly: permissions.isViewOnly,
    getGroupManagementMessage: permissions.getGroupManagementMessage,
    getGroupAssignmentMessage: permissions.getGroupAssignmentMessage,
  };
}

/**
 * Hook specifically for member management permissions
 */
export function useMemberManagementPermissions(context: WorkspacePermissionsContext) {
  const permissions = useWorkspacePermissions(context);

  return {
    canInviteMember: permissions.canInviteMember,
    canRemoveMember: permissions.canRemoveMember,
    canChangeMemberRole: permissions.canChangeMemberRole,
    isViewOnly: permissions.isViewOnly,
    getMemberInvitationMessage: permissions.getMemberInvitationMessage,
  };
}

/**
 * Hook for checking specific permissions with upgrade messages
 */
export function usePermissionWithUpgrade(
  permission: keyof WorkspacePermissions,
  upgradeFeature: keyof typeof UPGRADE_MESSAGES,
  context: WorkspacePermissionsContext
) {
  const permissions = useWorkspacePermissions(context);

  return {
    hasPermission: permissions[permission] as boolean,
    upgradeMessage: permissions.getUpgradeMessage(upgradeFeature),
    isViewOnly: permissions.isViewOnly,
  };
}