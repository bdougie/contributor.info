import { SubscriptionService } from '@/services/polar/subscription.service';
import { supabase } from './supabase';

export interface LimitCheckResult {
  allowed: boolean;
  limit: number | 'unlimited';
  current: number;
  message?: string;
}

/**
 * Check if a user can create a new workspace
 */
export async function checkWorkspaceLimit(userId: string): Promise<LimitCheckResult> {
  const limit = await SubscriptionService.getFeatureLimit(userId, 'maxWorkspaces');

  if (limit === 'unlimited') {
    return {
      allowed: true,
      limit: 'unlimited',
      current: 0,
    };
  }

  const { count, error } = await supabase
    .from('workspaces')
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', userId);

  if (error) {
    console.error('Error checking workspace count:', error);
    return {
      allowed: false,
      limit,
      current: 0,
      message: 'Error checking workspace limit',
    };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limit;

  return {
    allowed,
    limit,
    current: currentCount,
    message: allowed
      ? undefined
      : `You've reached your limit of ${limit} workspace${limit !== 1 ? 's' : ''}. Upgrade to create more.`,
  };
}

/**
 * Check if a user can add a repository to a workspace
 */
export async function checkRepositoryLimit(
  userId: string,
  workspaceId: string
): Promise<LimitCheckResult> {
  const limit = await SubscriptionService.getFeatureLimit(userId, 'maxReposPerWorkspace');

  if (limit === 'unlimited') {
    return {
      allowed: true,
      limit: 'unlimited',
      current: 0,
    };
  }

  const { count, error } = await supabase
    .from('workspace_repositories')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error checking repository count:', error);
    return {
      allowed: false,
      limit,
      current: 0,
      message: 'Error checking repository limit',
    };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limit;

  return {
    allowed,
    limit,
    current: currentCount,
    message: allowed
      ? undefined
      : `You've reached your limit of ${limit} repositories per workspace. Upgrade to add more.`,
  };
}

/**
 * Check if a user can add a member to a workspace
 */
export async function checkMemberLimit(
  userId: string,
  workspaceId: string
): Promise<LimitCheckResult> {
  const limit = await SubscriptionService.getFeatureLimit(userId, 'maxMembersPerWorkspace');

  if (limit === 'unlimited') {
    return {
      allowed: true,
      limit: 'unlimited',
      current: 0,
    };
  }

  const { count, error } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) {
    console.error('Error checking member count:', error);
    return {
      allowed: false,
      limit,
      current: 0,
      message: 'Error checking member limit',
    };
  }

  const currentCount = count || 0;
  const allowed = currentCount < limit;

  return {
    allowed,
    limit,
    current: currentCount,
    message: allowed
      ? undefined
      : `You've reached your limit of ${limit} members per workspace. Upgrade to add more.`,
  };
}

/**
 * Check if a workspace can be private for a user
 */
export async function checkPrivateWorkspaceAccess(userId: string): Promise<boolean> {
  return await SubscriptionService.checkFeatureAccess(userId, 'privateWorkspaces');
}

/**
 * Check if data exports are enabled for a user
 */
export async function checkExportAccess(userId: string): Promise<boolean> {
  return await SubscriptionService.checkFeatureAccess(userId, 'exportsEnabled');
}

/**
 * Get data retention days for a user's tier
 */
export async function getDataRetentionDays(userId: string): Promise<number | 'unlimited'> {
  const days = await SubscriptionService.getFeatureLimit(userId, 'dataRetentionDays');
  return days;
}

/**
 * Update feature usage tracking
 */
export async function updateFeatureUsage(
  userId: string,
  workspaceId: string,
  metricType: 'repos_count' | 'members_count' | 'api_calls',
  value: number
) {
  await SubscriptionService.updateFeatureUsage(userId, workspaceId, metricType, value);
}
