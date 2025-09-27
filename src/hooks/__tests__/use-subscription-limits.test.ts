import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSubscriptionLimits } from '../use-subscription-limits';
import { SubscriptionService } from '@/services/polar/subscription.service';
import * as subscriptionLimits from '@/lib/subscription-limits';

// Mock the dependencies
vi.mock('../use-current-user');
vi.mock('@/services/polar/subscription.service');
vi.mock('@/lib/subscription-limits');

// Import after mocking
import { useCurrentUser } from '../use-current-user';

describe('useSubscriptionLimits', () => {
  const mockUser = {
    id: 'test-user-123',
    email: 'test@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useCurrentUser
    vi.mocked(useCurrentUser).mockReturnValue({
      user: mockUser,
      loading: false,
      isAdmin: false,
      isMaintainer: false,
    });
  });

  describe('Subscription Tier Loading', () => {
    it('should load free tier limits when no subscription exists', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue(null);
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 1, // Free tier defaults to 1 workspace
        current: 0,
      });
      vi.mocked(SubscriptionService.checkFeatureAccess).mockResolvedValue(false);
      vi.mocked(SubscriptionService.getFeatureLimit).mockResolvedValue(30); // Default retention is 30 days

      const { result } = renderHook(() => useSubscriptionLimits());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('free');
      expect(result.current.workspaceLimit).toBe(1); // Default is 1, not 0
      expect(result.current.canUsePrivateWorkspaces).toBe(false);
      expect(result.current.canExportData).toBe(false);
      expect(result.current.dataRetentionDays).toBe(30); // Default is 30
    });

    it('should load pro tier limits when pro subscription exists', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
      });
      vi.mocked(SubscriptionService.checkFeatureAccess).mockImplementation(async (_, feature) => {
        return feature === 'privateWorkspaces' || feature === 'exportsEnabled';
      });
      vi.mocked(SubscriptionService.getFeatureLimit).mockResolvedValue(30);

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('pro');
      expect(result.current.workspaceLimit).toBe(1);
      expect(result.current.canUsePrivateWorkspaces).toBe(true);
      expect(result.current.canExportData).toBe(true);
      expect(result.current.dataRetentionDays).toBe(30);
    });

    it('should load team tier limits when team subscription exists', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-456',
        user_id: 'test-user-123',
        tier: 'team',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 3,
        current: 1,
      });
      vi.mocked(SubscriptionService.checkFeatureAccess).mockImplementation(async (_, feature) => {
        return feature === 'privateWorkspaces' || feature === 'exportsEnabled';
      });
      vi.mocked(SubscriptionService.getFeatureLimit).mockResolvedValue(30);

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('team');
      expect(result.current.workspaceLimit).toBe(3);
      expect(result.current.currentWorkspaceCount).toBe(1);
      expect(result.current.canUsePrivateWorkspaces).toBe(true);
      expect(result.current.canExportData).toBe(true);
      expect(result.current.dataRetentionDays).toBe(30);
    });
  });

  describe('Workspace Limit Checking', () => {
    it('should check if user can create workspace', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: false,
        limit: 1,
        current: 1,
        message: "You've reached your limit of 1 workspace. Upgrade to create more.",
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreateWorkspace).toBe(false);
      expect(result.current.workspaceLimit).toBe(1);
      expect(result.current.currentWorkspaceCount).toBe(1);
    });

    it('should allow unlimited workspaces for certain tiers', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-enterprise',
        user_id: 'test-user-123',
        tier: 'enterprise',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 'unlimited',
        current: 50,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.canCreateWorkspace).toBe(true);
      expect(result.current.workspaceLimit).toBe('unlimited');
      expect(result.current.currentWorkspaceCount).toBe(50);
    });
  });

  describe('Repository Limit Checking', () => {
    it('should check if user can add repository to workspace', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
      });
      vi.mocked(subscriptionLimits.checkRepositoryLimit).mockResolvedValue({
        allowed: true,
        limit: 3,
        current: 2,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canAdd = await result.current.canAddRepository('workspace-123');
      expect(canAdd).toBe(true);
      expect(subscriptionLimits.checkRepositoryLimit).toHaveBeenCalledWith(
        'test-user-123',
        'workspace-123'
      );
    });

    it('should prevent adding repository when limit reached', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkRepositoryLimit).mockResolvedValue({
        allowed: false,
        limit: 3,
        current: 3,
        message: "You've reached your limit of 3 repositories per workspace. Upgrade to add more.",
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canAdd = await result.current.canAddRepository('workspace-123');
      expect(canAdd).toBe(false);
    });
  });

  describe('Member Limit Checking', () => {
    it('should check if user can add member to workspace', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-team',
        user_id: 'test-user-123',
        tier: 'team',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkMemberLimit).mockResolvedValue({
        allowed: true,
        limit: 5,
        current: 3,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canAdd = await result.current.canAddMember('workspace-456');
      expect(canAdd).toBe(true);
      expect(subscriptionLimits.checkMemberLimit).toHaveBeenCalledWith(
        'test-user-123',
        'workspace-456'
      );
    });

    it('should prevent adding member when limit reached', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-team',
        user_id: 'test-user-123',
        tier: 'team',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkMemberLimit).mockResolvedValue({
        allowed: false,
        limit: 5,
        current: 5,
        message: "You've reached your limit of 5 members per workspace. Upgrade to add more.",
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canAdd = await result.current.canAddMember('workspace-456');
      expect(canAdd).toBe(false);
    });

    it('should return false for pro tier (solo plan)', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-pro',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkMemberLimit).mockResolvedValue({
        allowed: false,
        limit: 1,
        current: 1,
        message: 'Pro plan is a solo plan. Upgrade to Team to add members.',
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const canAdd = await result.current.canAddMember('workspace-789');
      expect(canAdd).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully when loading subscription', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(SubscriptionService.getCurrentSubscription).mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error loading subscription limits:',
        expect.any(Error)
      );
      expect(result.current.tier).toBe('free');
      expect(result.current.workspaceLimit).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it('should return false when user is not authenticated', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        user: null,
        loading: false,
        isAdmin: false,
        isMaintainer: false,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      const canAddRepo = await result.current.canAddRepository('workspace-123');
      const canAddMember = await result.current.canAddMember('workspace-123');

      expect(canAddRepo).toBe(false);
      expect(canAddMember).toBe(false);
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching subscription data', async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.mocked(SubscriptionService.getCurrentSubscription).mockReturnValue(
        promise as ReturnType<typeof SubscriptionService.getCurrentSubscription>
      );
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      expect(result.current.loading).toBe(true);

      resolvePromise!({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('pro');
    });

    it('should not load when user is not authenticated', async () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        user: null,
        loading: false,
        isAdmin: false,
        isMaintainer: false,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      // The hook should immediately set loading to false when there's no user
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(SubscriptionService.getCurrentSubscription).not.toHaveBeenCalled();
    });
  });

  describe('Feature Access', () => {
    it('should correctly determine feature access for free tier', async () => {
      // Test free tier
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue(null);
      vi.mocked(SubscriptionService.checkFeatureAccess).mockResolvedValue(false);
      vi.mocked(SubscriptionService.getFeatureLimit).mockResolvedValue(30);
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: false,
        limit: 1,
        current: 0,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('free');
      expect(result.current.canUsePrivateWorkspaces).toBe(false);
      expect(result.current.canExportData).toBe(false);
      expect(result.current.dataRetentionDays).toBe(30);
    });

    it('should correctly determine feature access for team tier', async () => {
      // Test team tier
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-team',
        user_id: 'test-user-123',
        tier: 'team',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(SubscriptionService.checkFeatureAccess).mockResolvedValue(true);
      vi.mocked(SubscriptionService.getFeatureLimit).mockResolvedValue(30);
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 3,
        current: 0,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('team');
      expect(result.current.canUsePrivateWorkspaces).toBe(true);
      expect(result.current.canExportData).toBe(true);
      expect(result.current.dataRetentionDays).toBe(30);
    });
  });

  describe('Edge Cases', () => {
    it('should handle subscription status transitions', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'pro',
        status: 'trialing',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 1,
        current: 0,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.tier).toBe('pro');
    });

    it('should handle concurrent async operations', async () => {
      vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({
        id: 'sub-123',
        user_id: 'test-user-123',
        tier: 'team',
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
      });
      vi.mocked(subscriptionLimits.checkWorkspaceLimit).mockResolvedValue({
        allowed: true,
        limit: 3,
        current: 1,
      });
      vi.mocked(subscriptionLimits.checkRepositoryLimit).mockResolvedValue({
        allowed: true,
        limit: 3,
        current: 0,
      });
      vi.mocked(subscriptionLimits.checkMemberLimit).mockResolvedValue({
        allowed: true,
        limit: 5,
        current: 2,
      });

      const { result } = renderHook(() => useSubscriptionLimits());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Call multiple async functions concurrently
      const [canAddRepo1, canAddRepo2, canAddMember] = await Promise.all([
        result.current.canAddRepository('workspace-1'),
        result.current.canAddRepository('workspace-2'),
        result.current.canAddMember('workspace-1'),
      ]);

      expect(canAddRepo1).toBe(true);
      expect(canAddRepo2).toBe(true);
      expect(canAddMember).toBe(true);
      expect(subscriptionLimits.checkRepositoryLimit).toHaveBeenCalledTimes(2);
      expect(subscriptionLimits.checkMemberLimit).toHaveBeenCalledTimes(1);
    });
  });
});
