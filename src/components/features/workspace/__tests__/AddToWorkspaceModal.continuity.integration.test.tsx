import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AddToWorkspaceModal } from '../AddToWorkspaceModal';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), workspaces: [] }));
vi.mock('@/services/workspace.service', () => ({
  WorkspaceService: { addRepositoryToWorkspace: vi.fn() },
}));
vi.mock('@/lib/auth-helpers', () => ({ getAppUserId: vi.fn() }));
vi.mock('react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/hooks/use-github-auth', () => ({ useGitHubAuth: () => ({ isLoggedIn: true }) }));
vi.mock('@/hooks/use-user-workspaces', () => ({
  useUserWorkspaces: () => ({ workspaces: mocks.workspaces, loading: false }),
}));
vi.mock('@/hooks/use-subscription-limits', () => ({
  useSubscriptionLimits: () => ({ tier: 'team', canCreateWorkspace: true, loading: false }),
}));
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'auth-user' } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'repo-id' } }) }),
          }),
        }),
      }),
    }),
}));

describe('add-to-workspace creation handoff', () => {
  const originalScrollIntoView = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView'
  );
  afterEach(() => {
    if (originalScrollIntoView)
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView);
    else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
  });
  it('preserves the selected repository when choosing to create a workspace', async () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    const onOpenChange = vi.fn();
    render(
      <AddToWorkspaceModal open onOpenChange={onOpenChange} owner="papercomputeco" repo="tapes" />
    );
    fireEvent.keyDown(await screen.findByRole('combobox'), { key: 'Enter' });
    fireEvent.keyDown(await screen.findByRole('option', { name: /Create new workspace/ }), {
      key: 'Enter',
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      '/workspaces/new?repository=papercomputeco%2Ftapes'
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
