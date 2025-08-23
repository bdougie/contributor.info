/**
 * Workspace Types
 * Type definitions for the workspace feature
 */

import type { Database } from '@/types/supabase';

// =====================================================
// CORE WORKSPACE TYPES
// =====================================================

export type WorkspaceVisibility = 'public' | 'private';
export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

/**
 * Workspace settings stored in JSONB
 */
export interface WorkspaceSettings {
  theme?: 'default' | 'dark' | 'light';
  dashboard_layout?: 'grid' | 'list' | 'compact';
  default_time_range?: '7d' | '30d' | '90d' | '1y';
  notifications?: {
    email?: boolean;
    in_app?: boolean;
  };
  custom_branding?: {
    logo_url?: string;
    primary_color?: string;
  };
}

/**
 * Main workspace entity
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  visibility: WorkspaceVisibility;
  settings: WorkspaceSettings;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  is_active: boolean;
}

/**
 * Workspace with additional computed fields
 */
export interface WorkspaceWithStats extends Workspace {
  repository_count: number;
  member_count: number;
  total_stars: number;
  total_contributors: number;
  owner: {
    id: string;
    email: string;
    avatar_url?: string;
    display_name?: string;
  };
}

// =====================================================
// WORKSPACE REPOSITORY TYPES
// =====================================================

/**
 * Junction table for workspace-repository relationship
 */
export interface WorkspaceRepository {
  id: string;
  workspace_id: string;
  repository_id: string;
  added_by: string;
  added_at: string;
  notes: string | null;
  tags: string[];
  is_pinned: boolean;
}

/**
 * Repository within a workspace context
 */
export interface WorkspaceRepositoryWithDetails extends WorkspaceRepository {
  repository: {
    id: string;
    full_name: string;
    owner: string;
    name: string;
    description: string | null;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    topics: string[];
    is_private: boolean;
    is_archived: boolean;
  };
  added_by_user: {
    id: string;
    email: string;
    display_name?: string;
  };
}

// =====================================================
// WORKSPACE MEMBER TYPES
// =====================================================

/**
 * Workspace member entity
 */
export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
  last_active_at: string | null;
}

/**
 * Member with user details
 */
export interface WorkspaceMemberWithDetails extends WorkspaceMember {
  user: {
    id: string;
    email: string;
    avatar_url?: string;
    display_name?: string;
    created_at: string;
  };
  invited_by_user?: {
    id: string;
    email: string;
    display_name?: string;
  };
}

// =====================================================
// WORKSPACE METRICS TYPES
// =====================================================

/**
 * Time range options for metrics
 */
export type MetricsTimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

/**
 * Contributor activity in metrics
 */
export interface MetricsContributor {
  username: string;
  avatar_url: string;
  prs: number;
  issues: number;
  commits: number;
  reviews: number;
}

/**
 * Language distribution in metrics
 */
export interface LanguageDistribution {
  [language: string]: number; // percentage
}

/**
 * Activity timeline data point
 */
export interface ActivityDataPoint {
  date: string;
  prs: number;
  issues: number;
  commits: number;
  contributors: number;
}

/**
 * Cached workspace metrics
 */
export interface WorkspaceMetrics {
  id: string;
  workspace_id: string;
  period_start: string;
  period_end: string;
  time_range: MetricsTimeRange;
  metrics: {
    // PR metrics
    total_prs: number;
    merged_prs: number;
    open_prs: number;
    draft_prs: number;
    
    // Issue metrics
    total_issues: number;
    closed_issues: number;
    open_issues: number;
    
    // Contributor metrics
    total_contributors: number;
    active_contributors: number;
    new_contributors: number;
    
    // Repository metrics
    total_commits: number;
    total_stars: number;
    total_forks: number;
    total_watchers: number;
    
    // Velocity metrics
    avg_pr_merge_time_hours: number;
    pr_velocity: number; // PRs per day
    issue_closure_rate: number; // percentage
    
    // Distributions
    languages: LanguageDistribution;
    top_contributors: MetricsContributor[];
    activity_timeline: ActivityDataPoint[];
    
    // Repository breakdown
    repository_stats?: Array<{
      repository_id: string;
      full_name: string;
      prs: number;
      issues: number;
      stars: number;
      contributors: number;
    }>;
  };
  calculated_at: string;
  expires_at: string;
  is_stale: boolean;
}

// =====================================================
// WORKSPACE INVITATION TYPES
// =====================================================

/**
 * Workspace invitation entity
 */
export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>; // Can't invite as owner
  invitation_token: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  status: InvitationStatus;
}

/**
 * Invitation with workspace details
 */
export interface WorkspaceInvitationWithDetails extends WorkspaceInvitation {
  workspace: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
  };
  invited_by_user: {
    id: string;
    email: string;
    display_name?: string;
  };
}

// =====================================================
// API REQUEST/RESPONSE TYPES
// =====================================================

/**
 * Create workspace request
 */
export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  visibility?: WorkspaceVisibility;
  settings?: Partial<WorkspaceSettings>;
}

/**
 * Update workspace request
 */
export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  visibility?: WorkspaceVisibility;
  settings?: Partial<WorkspaceSettings>;
}

/**
 * Add repository to workspace request
 */
export interface AddRepositoryRequest {
  repository_id: string;
  notes?: string;
  tags?: string[];
  is_pinned?: boolean;
}

/**
 * Invite member request
 */
export interface InviteMemberRequest {
  email: string;
  role: Exclude<WorkspaceRole, 'owner'>;
}

/**
 * Update member role request
 */
export interface UpdateMemberRoleRequest {
  user_id: string;
  role: Exclude<WorkspaceRole, 'owner'>;
}

// =====================================================
// UTILITY TYPES
// =====================================================

/**
 * Workspace list filters
 */
export interface WorkspaceFilters {
  visibility?: WorkspaceVisibility;
  owned_by_me?: boolean;
  member_of?: boolean;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'last_activity_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Repository search within workspace
 */
export interface WorkspaceRepositoryFilters {
  search?: string;
  language?: string;
  tags?: string[];
  is_pinned?: boolean;
  sort_by?: 'name' | 'stars' | 'activity' | 'added_at';
  sort_order?: 'asc' | 'desc';
}

/**
 * Workspace activity event
 */
export interface WorkspaceActivity {
  id: string;
  workspace_id: string;
  user_id: string;
  action: 'created' | 'updated' | 'added_repo' | 'removed_repo' | 'added_member' | 'removed_member' | 'role_changed';
  target_type?: 'workspace' | 'repository' | 'member';
  target_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// =====================================================
// PERMISSION HELPERS
// =====================================================

/**
 * Check if a role has permission for an action
 */
export const canEditWorkspace = (role: WorkspaceRole): boolean => {
  return ['owner', 'admin'].includes(role);
};

export const canManageRepositories = (role: WorkspaceRole): boolean => {
  return ['owner', 'admin', 'editor'].includes(role);
};

export const canManageMembers = (role: WorkspaceRole): boolean => {
  return ['owner', 'admin'].includes(role);
};

export const canViewWorkspace = (role: WorkspaceRole): boolean => {
  return true; // All roles can view
};

/**
 * Get display name for role
 */
export const getRoleDisplayName = (role: WorkspaceRole): string => {
  const roleNames: Record<WorkspaceRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    editor: 'Editor',
    viewer: 'Viewer'
  };
  return roleNames[role];
};

/**
 * Get role description
 */
export const getRoleDescription = (role: WorkspaceRole): string => {
  const descriptions: Record<WorkspaceRole, string> = {
    owner: 'Full control over the workspace',
    admin: 'Can manage members and repositories',
    editor: 'Can add and remove repositories',
    viewer: 'Can view workspace content'
  };
  return descriptions[role];
};