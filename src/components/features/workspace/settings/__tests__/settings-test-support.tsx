import { render } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { WorkspaceSettings } from '../WorkspaceSettings';
import type { Workspace, WorkspaceMember, WorkspaceRole } from '@/types/workspace';

vi.mock('../MembersTab', () => ({ MembersTab: () => null }));
vi.mock('../SlackIntegrationCard', () => ({ SlackIntegrationCard: () => null }));
vi.mock('../TUISetupTab', () => ({ TUISetupTab: () => null }));
vi.mock('../../WorkspaceBackfillManager', () => ({ WorkspaceBackfillManager: () => null }));
vi.mock('@/lib/supabase-lazy', () => ({ getSupabase: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ refreshWorkspaces: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});
afterEach(() => vi.unstubAllGlobals());

export const workspace: Workspace = {
  id: 'workspace-one',
  name: 'Paper Compute',
  slug: 'open-source-repos',
  description: 'Open source projects',
  owner_id: 'owner-one',
  visibility: 'public',
  tier: 'team',
  max_repositories: 10,
  current_repository_count: 2,
  data_retention_days: 90,
  settings: { theme: 'dark', notifications: { email: true, in_app: false } },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_activity_at: null,
  is_active: true,
};

export function renderSettings(role: WorkspaceRole = 'owner', value = workspace) {
  const member: WorkspaceMember = {
    id: 'member-one',
    workspace_id: value.id,
    user_id: 'owner-one',
    role,
    accepted_at: null,
    invited_at: null,
    invited_by: null,
    notifications_enabled: true,
    created_at: value.created_at,
    updated_at: value.updated_at,
    last_active_at: null,
  };
  return render(<WorkspaceSettings workspace={value} currentMember={member} memberCount={2} />);
}
