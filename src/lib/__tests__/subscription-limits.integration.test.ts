import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRepositoryLimit, checkWorkspaceLimit } from '../subscription-limits';
import { supabase } from '../supabase';
import { SubscriptionService } from '@/services/polar/subscription.service';
import { createMockQueryBuilder } from '@/services/__tests__/test-types';

vi.mock('../supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('@/services/polar/subscription.service', () => ({
  SubscriptionService: { getCurrentSubscription: vi.fn(), getFeatureLimit: vi.fn() },
}));

describe('workspace capacity checks', () => {
  beforeEach(() => vi.resetAllMocks());

  it('counts app-owned workspaces using the purchased billing allowance', async () => {
    vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({ max_workspaces: 3 });
    const mapping = createMockQueryBuilder({ data: { id: 'app-user' }, error: null });
    const mappingFilter = vi.spyOn(mapping, 'eq');
    const count = createMockQueryBuilder({ data: null, count: 3, error: null });
    const countFilter = vi.spyOn(count, 'eq');
    vi.mocked(supabase.from).mockReturnValueOnce(mapping).mockReturnValueOnce(count);

    const result = await checkWorkspaceLimit('auth-user');

    expect(result).toMatchObject({ allowed: false, current: 3, limit: 3 });
    expect(SubscriptionService.getCurrentSubscription).toHaveBeenCalledWith('auth-user');
    expect(SubscriptionService.getFeatureLimit).not.toHaveBeenCalled();
    expect(mappingFilter).toHaveBeenCalledWith('auth_user_id', 'auth-user');
    expect(countFilter).toHaveBeenCalledWith('owner_id', 'app-user');
  });

  it('does not allow creation when the app account cannot be resolved', async () => {
    vi.mocked(SubscriptionService.getCurrentSubscription).mockResolvedValue({ max_workspaces: 3 });
    vi.mocked(supabase.from).mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    expect(await checkWorkspaceLimit('auth-user')).toMatchObject({ allowed: false, limit: 3 });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it.each([
    { limit: 3, count: 3, allowed: false },
    { limit: 12, count: 10, allowed: true },
    { limit: 0, count: 0, allowed: false },
  ])('uses the workspace limit $limit at count $count', async ({ limit, count, allowed }) => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        createMockQueryBuilder({ data: { max_repositories: limit }, error: null })
      )
      .mockReturnValueOnce(createMockQueryBuilder({ data: null, count, error: null }));

    expect(await checkRepositoryLimit('auth-user', 'workspace')).toMatchObject({
      allowed,
      limit,
      current: count,
    });
    expect(SubscriptionService.getFeatureLimit).not.toHaveBeenCalled();
  });

  it('does not offer repository slots when the workspace is unavailable', async () => {
    vi.mocked(supabase.from).mockReturnValue(createMockQueryBuilder({ data: null, error: null }));

    expect(await checkRepositoryLimit('auth-user', 'workspace')).toMatchObject({ allowed: false });
  });

  it('does not treat a failed membership count as an empty workspace', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(createMockQueryBuilder({ data: { max_repositories: 3 }, error: null }))
      .mockReturnValueOnce(
        createMockQueryBuilder({ data: null, count: null, error: new Error('Offline') })
      );

    expect(await checkRepositoryLimit('auth-user', 'workspace')).toMatchObject({ allowed: false });
  });
});
