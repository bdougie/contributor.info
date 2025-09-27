import { useState, useEffect } from 'react';
import { useCurrentUser } from './use-current-user';
import { SubscriptionService } from '@/services/polar/subscription.service';
import {
  checkWorkspaceLimit,
  checkRepositoryLimit,
  checkMemberLimit,
} from '@/lib/subscription-limits';

interface SubscriptionLimits {
  tier: string;
  canCreateWorkspace: boolean;
  workspaceLimit: number | 'unlimited';
  currentWorkspaceCount: number;
  canAddRepository: (workspaceId: string) => Promise<boolean>;
  canAddMember: (workspaceId: string) => Promise<boolean>;
  canUsePrivateWorkspaces: boolean;
  canExportData: boolean;
  dataRetentionDays: number | 'unlimited';
  loading: boolean;
}

export function useSubscriptionLimits(): SubscriptionLimits {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [limits, setLimits] = useState<Partial<SubscriptionLimits>>({});

  useEffect(() => {
    const loadLimits = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Get current subscription and usage
        const [subscription, workspaceCheck] = await Promise.all([
          SubscriptionService.getCurrentSubscription(user.id),
          checkWorkspaceLimit(user.id),
        ]);

        const tier = subscription?.tier || 'free';

        // Check feature access
        const [privateAccess, exportAccess, retentionDays] = await Promise.all([
          SubscriptionService.checkFeatureAccess(user.id, 'privateWorkspaces'),
          SubscriptionService.checkFeatureAccess(user.id, 'exportsEnabled'),
          SubscriptionService.getFeatureLimit(user.id, 'dataRetentionDays'),
        ]);

        setLimits({
          tier,
          canCreateWorkspace: workspaceCheck.allowed,
          workspaceLimit: workspaceCheck.limit,
          currentWorkspaceCount: workspaceCheck.current,
          canUsePrivateWorkspaces: privateAccess,
          canExportData: exportAccess,
          dataRetentionDays: retentionDays,
        });
      } catch (error) {
        console.error('Error loading subscription limits:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLimits();
  }, [user]);

  const canAddRepository = async (workspaceId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const check = await checkRepositoryLimit(user.id, workspaceId);
    return check.allowed;
  };

  const canAddMember = async (workspaceId: string): Promise<boolean> => {
    if (!user?.id) return false;
    const check = await checkMemberLimit(user.id, workspaceId);
    return check.allowed;
  };

  return {
    tier: loading ? 'free' : limits.tier || 'free',
    canCreateWorkspace: limits.canCreateWorkspace || false,
    workspaceLimit: limits.workspaceLimit || 1,
    currentWorkspaceCount: limits.currentWorkspaceCount || 0,
    canAddRepository,
    canAddMember,
    canUsePrivateWorkspaces: limits.canUsePrivateWorkspaces || false,
    canExportData: limits.canExportData || false,
    dataRetentionDays: limits.dataRetentionDays || 30,
    loading,
  };
}
