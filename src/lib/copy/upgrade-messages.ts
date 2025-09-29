/**
 * Centralized upgrade and permission messages
 * Provides consistent copy across all upgrade CTAs and permission-related UI
 */

import type { WorkspaceRole, WorkspaceTier } from '@/types/workspace';

export interface UpgradeMessage {
  title: string;
  description: string;
  actionText: string;
  actionHref?: string;
  actionType?: 'upgrade' | 'contact' | 'login';
}

/**
 * Upgrade messages for different features and contexts
 */
export const UPGRADE_MESSAGES = {
  // Contributor Group Management
  GROUP_MANAGEMENT: {
    title: 'Team Management Required',
    description: 'Organize contributors into groups with advanced team management features.',
    actionText: 'Upgrade to Team',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  GROUP_ASSIGNMENT: {
    title: 'Admin Access Required',
    description:
      'Only workspace owners, admins, maintainers, and editors can assign contributors to groups.',
    actionText: 'Contact Admin',
    actionType: 'contact' as const,
  },

  // Member Management
  MEMBER_INVITATION: {
    title: 'Team Plan Required',
    description: 'Invite team members and collaborate on repositories with Team plan.',
    actionText: 'Upgrade to Team',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  MEMBER_ROLE_CHANGE: {
    title: 'Admin Access Required',
    description: 'Only workspace owners and maintainers can change member roles.',
    actionText: 'Contact Admin',
    actionType: 'contact' as const,
  },

  // Data & Analytics
  DATA_EXPORT: {
    title: 'Pro Features Required',
    description: 'Export workspace data and generate reports with Pro plan.',
    actionText: 'Upgrade to Pro',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  ADVANCED_ANALYTICS: {
    title: 'Pro Analytics Required',
    description: 'Access advanced analytics and insights with Pro plan.',
    actionText: 'Upgrade to Pro',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  // Repository Management
  PRIVATE_REPOSITORIES: {
    title: 'Pro Plan Required',
    description: 'Track private repositories and manage sensitive projects with Pro plan.',
    actionText: 'Upgrade to Pro',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  REPOSITORY_LIMIT: {
    title: 'Repository Limit Reached',
    description: 'Upgrade your plan to track more repositories in this workspace.',
    actionText: 'Upgrade Plan',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  // Workspace Features
  WORKSPACE_CREATION: {
    title: 'Pro Account Required',
    description: 'Create unlimited workspaces with advanced features using Pro plan.',
    actionText: 'Upgrade to Pro',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  CUSTOM_BRANDING: {
    title: 'Team Features Required',
    description: 'Customize workspace branding and appearance with Team plan.',
    actionText: 'Upgrade to Team',
    actionHref: '/billing',
    actionType: 'upgrade' as const,
  },

  // Authentication
  LOGIN_REQUIRED: {
    title: 'Login Required',
    description: 'Please log in to access workspace management features.',
    actionText: 'Login to view',
    actionType: 'login' as const,
  },
} as const;

/**
 * Get appropriate upgrade message based on user context
 */
export function getUpgradeMessage(
  feature: keyof typeof UPGRADE_MESSAGES,
  context?: {
    userRole?: WorkspaceRole;
    workspaceTier?: WorkspaceTier;
    isLoggedIn?: boolean;
  }
): UpgradeMessage {
  // If not logged in, always show login message
  if (!context?.isLoggedIn) {
    return UPGRADE_MESSAGES.LOGIN_REQUIRED;
  }

  const baseMessage = UPGRADE_MESSAGES[feature];

  // For role-based restrictions, show contact admin message for contributors
  if (context?.userRole === 'contributor') {
    const roleRestrictedFeatures = [
      'GROUP_MANAGEMENT',
      'GROUP_ASSIGNMENT',
      'MEMBER_INVITATION',
      'MEMBER_ROLE_CHANGE',
    ];

    if (roleRestrictedFeatures.includes(feature)) {
      return {
        ...baseMessage,
        title: 'Admin Access Required',
        description: 'Contact your workspace owner or maintainer for access to this feature.',
        actionText: 'Contact Admin',
        actionType: 'contact',
        actionHref: undefined,
      };
    }
  }

  return baseMessage;
}

/**
 * Get tier-specific upgrade target
 */
export function getUpgradeTarget(currentTier: WorkspaceTier): {
  tier: WorkspaceTier;
  actionText: string;
  actionHref: string;
} {
  switch (currentTier) {
    case 'free':
      return {
        tier: 'pro',
        actionText: 'Upgrade to Pro',
        actionHref: '/billing',
      };
    case 'pro':
      return {
        tier: 'team',
        actionText: 'Upgrade to Team',
        actionHref: '/billing',
      };
    case 'team':
      return {
        tier: 'enterprise',
        actionText: 'Contact Sales',
        actionHref: '/contact',
      };
    default:
      return {
        tier: 'pro',
        actionText: 'Upgrade Plan',
        actionHref: '/billing',
      };
  }
}

/**
 * Permission-specific messages for different scenarios
 */
export const PERMISSION_MESSAGES = {
  NO_PERMISSION: 'You do not have permission to perform this action.',
  OWNER_ONLY: 'Only workspace owners can perform this action.',
  ADMIN_ONLY: 'Only workspace owners and maintainers can perform this action.',
  UPGRADE_REQUIRED: 'This feature requires a plan upgrade.',
  LOGIN_REQUIRED: 'Please log in to access this feature.',
} as const;

/**
 * Get permission denial message with context
 */
export function getPermissionDenialMessage(
  userRole?: WorkspaceRole,
  requiredRole?: WorkspaceRole | WorkspaceRole[],
  feature?: string
): string {
  if (!userRole) {
    return PERMISSION_MESSAGES.LOGIN_REQUIRED;
  }

  if (Array.isArray(requiredRole)) {
    if (requiredRole.includes('owner')) {
      return PERMISSION_MESSAGES.ADMIN_ONLY;
    }
  } else if (requiredRole === 'owner') {
    return PERMISSION_MESSAGES.OWNER_ONLY;
  }

  if (feature) {
    return `${feature} requires admin access. Contact your workspace owner or maintainer.`;
  }

  return PERMISSION_MESSAGES.NO_PERMISSION;
}
