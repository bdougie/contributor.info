/**
 * Workspace Types
 * Type definitions for the workspace feature
 */

// =====================================================
// CORE WORKSPACE TYPES
// =====================================================

export type WorkspaceVisibility = 'public' | 'private';
export type WorkspaceRole = 'owner' | 'maintainer' | 'contributor';
export type WorkspaceTier = 'free' | 'pro' | 'enterprise';
export type InvitationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
export type BillingCycle = 'monthly' | 'yearly';
export type EmailType =
  | 'workspace_invitation'
  | 'member_added'
  | 'member_removed'
  | 'role_changed'
  | 'subscription_confirmation'
  | 'payment_receipt'
  | 'payment_failed'
  | 'usage_limit_warning'
  | 'data_retention_warning'
  | 'workspace_summary';

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
  tier: WorkspaceTier;
  max_repositories: number;
  current_repository_count: number;
  data_retention_days: number;
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

    // Trend comparisons (vs previous period)
    stars_trend?: number;
    prs_trend?: number;
    contributors_trend?: number;
    commits_trend?: number;
    issues_trend?: number;
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
  message?: string;
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
  action:
    | 'workspace_created'
    | 'workspace_updated'
    | 'repository_added'
    | 'repository_removed'
    | 'member_invited'
    | 'member_joined'
    | 'member_removed'
    | 'member_left'
    | 'role_changed'
    | 'settings_updated'
    | 'invitation_sent'
    | 'invitation_accepted'
    | 'invitation_declined';
  details?: {
    target_type?: 'workspace' | 'repository' | 'member' | 'invitation';
    target_id?: string;
    target_name?: string;
    old_value?: string;
    new_value?: string;
    role?: WorkspaceRole;
    repository_name?: string;
    member_email?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

/**
 * Workspace activity with user details
 */
export interface WorkspaceActivityWithUser extends WorkspaceActivity {
  user: {
    id: string;
    email: string;
    avatar_url?: string;
    display_name?: string;
  };
}

// =====================================================
// PERMISSION HELPERS
// =====================================================

/**
 * Check if a role has permission for an action
 */
export const canEditWorkspace = (role: WorkspaceRole): boolean => {
  return ['owner', 'maintainer'].includes(role);
};

export const canManageRepositories = (role: WorkspaceRole): boolean => {
  return ['owner', 'maintainer'].includes(role);
};

export const canManageMembers = (role: WorkspaceRole): boolean => {
  return ['owner', 'maintainer'].includes(role);
};

export const canInviteContributors = (role: WorkspaceRole): boolean => {
  return ['owner', 'maintainer'].includes(role);
};

export const canInviteMaintainers = (role: WorkspaceRole): boolean => {
  return role === 'owner';
};

export const canViewWorkspace = (): boolean => {
  return true; // All roles can view
};

/**
 * Get display name for role
 */
export const getRoleDisplayName = (role: WorkspaceRole): string => {
  const roleNames: Record<WorkspaceRole, string> = {
    owner: 'Owner',
    maintainer: 'Maintainer',
    contributor: 'Contributor',
  };
  return roleNames[role];
};

/**
 * Get role description
 */
export const getRoleDescription = (role: WorkspaceRole): string => {
  const descriptions: Record<WorkspaceRole, string> = {
    owner: 'Full control over the workspace, manage billing',
    maintainer: 'Can manage repositories and invite contributors',
    contributor: 'View-only access to workspace content',
  };
  return descriptions[role];
};

// =====================================================
// SUBSCRIPTION TYPES
// =====================================================

/**
 * User subscription entity
 */
export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  tier: WorkspaceTier;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  max_workspaces: number;
  max_repos_per_workspace: number;
  data_retention_days: number;
  allows_private_repos: boolean;
  features: {
    priority_queue: boolean;
    advanced_analytics: boolean;
    api_access: boolean;
    export_data: boolean;
    team_collaboration: boolean;
    custom_branding: boolean;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Usage tracking entity
 */
export interface UsageTracking {
  id: string;
  user_id: string;
  workspace_id: string | null;
  metric_type:
    | 'workspace_count'
    | 'repository_count'
    | 'member_count'
    | 'api_calls'
    | 'data_queries'
    | 'export_count';
  value: number;
  period_start: string;
  period_end: string;
  recorded_at: string;
}

/**
 * Billing history entity
 */
export interface BillingHistory {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  amount: number; // in cents
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  description: string | null;
  invoice_url: string | null;
  receipt_url: string | null;
  billing_date: string;
  paid_at: string | null;
  failed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Priority queue entity
 */
export interface PriorityQueue {
  id: string;
  workspace_id: string;
  repository_id: string;
  priority: number; // 1-1000, lower is higher priority
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  retry_count: number;
  error_message: string | null;
  capture_window_hours: number;
  last_captured_at: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Email notification entity
 */
export interface EmailNotification {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  recipient_email: string;
  email_type: EmailType;
  resend_email_id: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'bounced' | 'failed';
  subject: string;
  template_data: Record<string, unknown> | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  created_at: string;
}

/**
 * Tier limits configuration
 */
export interface TierLimits {
  tier: WorkspaceTier;
  max_workspaces: number;
  max_repos_per_workspace: number;
  max_members_per_workspace: number | null;
  data_retention_days: number;
  allows_private_repos: boolean;
  priority_queue_enabled: boolean;
  advanced_analytics: boolean;
  api_access: boolean;
  export_enabled: boolean;
  custom_branding: boolean;
  monthly_price: number | null; // in cents
  yearly_price: number | null; // in cents
  additional_workspace_yearly: number | null; // in cents
  created_at: string;
  updated_at: string;
}

/**
 * Subscription upgrade request
 */
export interface UpgradeSubscriptionRequest {
  tier: WorkspaceTier;
  billing_cycle: BillingCycle;
  payment_method_id?: string;
}

/**
 * Check if user can create more workspaces
 */
export const canCreateMoreWorkspaces = (
  subscription: Subscription | null,
  currentWorkspaceCount: number
): boolean => {
  const maxWorkspaces = subscription?.max_workspaces ?? 1;
  return currentWorkspaceCount < maxWorkspaces;
};

/**
 * Check if workspace can add more repositories
 */
export const canAddMoreRepositories = (workspace: Workspace): boolean => {
  return workspace.current_repository_count < workspace.max_repositories;
};

/**
 * Get tier display information
 */
export const getTierInfo = (
  tier: WorkspaceTier
): {
  name: string;
  badge: string;
  color: string;
} => {
  const tierInfo = {
    free: {
      name: 'Free',
      badge: '🆓',
      color: 'gray',
    },
    pro: {
      name: 'Pro',
      badge: '💎',
      color: 'blue',
    },
    enterprise: {
      name: 'Enterprise',
      badge: '🔒',
      color: 'purple',
    },
  };
  return tierInfo[tier];
};
