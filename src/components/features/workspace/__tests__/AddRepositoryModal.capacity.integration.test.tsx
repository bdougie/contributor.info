import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddRepositoryModal } from '../AddRepositoryModal';
import { getSupabase } from '@/lib/supabase-lazy';
import { WorkspaceService } from '@/services/workspace.service';
import { createMockQueryBuilder } from '@/services/__tests__/test-types';
import type { GitHubRepository } from '@/lib/github';

vi.mock('@/lib/supabase-lazy', () => ({ getSupabase: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getAppUserId: vi.fn().mockResolvedValue('app-user') }));
vi.mock('@/services/workspace.service', () => ({
  WorkspaceService: { addRepositoryToWorkspace: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/github-search-input', () => ({
  GitHubSearchInput: ({ onSelect }: { onSelect: (repo: GitHubRepository) => void }) => (
    <div>
      {Array.from({ length: 5 }, (_, index) => (
        <button
          key={index}
          onClick={() =>
            onSelect({
              id: index,
              name: `project-${index}`,
              full_name: `pcc-labs/project-${index}`,
              owner: { login: 'pcc-labs', avatar_url: 'https://example.com/avatar.png' },
              description: null,
              language: null,
              stargazers_count: 0,
              forks_count: 0,
              private: false,
            })
          }
        >
          Select project {index}
        </button>
      ))}
    </div>
  ),
}));

const membership = (index: number) => ({
  repository_id: `repo-${index}`,
  repositories: {
    id: `repo-${index}`,
    name: `existing-${index}`,
    full_name: `other/existing-${index}`,
    owner: 'other',
    description: null,
    language: null,
    stargazers_count: 0,
    forks_count: 0,
  },
});

describe('workspace picker capacity', () => {
  let workspace: { tier: string; max_repositories: number; current_repository_count: number };
  let memberships: Array<{
    repository_id: string;
    repositories: ReturnType<typeof membership>['repositories'] | null;
  }>;
  let workspaceError: Error | null;

  beforeEach(() => {
    vi.clearAllMocks();
    workspace = { tier: 'free', max_repositories: 3, current_repository_count: 999 };
    memberships = [];
    workspaceError = null;
    vi.mocked(getSupabase).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'workspaces') {
          return createMockQueryBuilder({ data: workspace, error: workspaceError });
        }
        if (table === 'workspace_repositories') {
          return createMockQueryBuilder({ data: memberships, error: null });
        }
        if (table === 'repositories' || table === 'tracked_repositories') {
          return createMockQueryBuilder({ data: { id: 'tracked-repo' }, error: null });
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as Awaited<ReturnType<typeof getSupabase>>);
  });

  function renderPicker() {
    return render(<AddRepositoryModal open workspaceId="workspace" onOpenChange={vi.fn()} />);
  }

  function select(index: number) {
    fireEvent.click(screen.getByRole('button', { name: `Select project ${index}` }));
  }

  it('blocks the fourth repository when the stored free workspace limit is three', async () => {
    memberships = Array.from({ length: 3 }, (_, index) => membership(index));
    renderPicker();
    await screen.findByText('3 / 3 used');

    select(0);

    expect(screen.getByText('Selected Repositories (0)')).toBeInTheDocument();
    expect(screen.getByText(/Maximum 3 repositories allowed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 0 Repositories' })).toBeDisabled();
  });

  it('allows the five-repo Tapes core set on a team workspace with enough purchased slots', async () => {
    workspace = { tier: 'team', max_repositories: 8, current_repository_count: 999 };
    renderPicker();
    await screen.findByText('0 / 8 used');

    for (let index = 0; index < 5; index++) select(index);

    expect(screen.getByText('Selected Repositories (5)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 5 Repositories' })).toBeEnabled();
  });

  it('honors a pro override above ten and counts the pending selection toward capacity', async () => {
    workspace = { tier: 'pro', max_repositories: 12, current_repository_count: 0 };
    memberships = Array.from({ length: 10 }, (_, index) => membership(index));
    renderPicker();
    await screen.findByText('10 / 12 used');

    select(0);
    select(1);
    select(2);

    expect(screen.getByText('Selected Repositories (2)')).toBeInTheDocument();
    expect(screen.getByText(/Maximum 12 repositories allowed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 2 Repositories' })).toBeEnabled();
  });

  it('counts a membership whose joined repository is not visible', async () => {
    memberships = [membership(0), membership(1), { repository_id: 'hidden', repositories: null }];
    renderPicker();
    await screen.findByText('3 / 3 used');

    select(0);

    expect(screen.getByText('Selected Repositories (0)')).toBeInTheDocument();
  });

  it('does not enable additions when capacity cannot be loaded', async () => {
    workspaceError = new Error('Unavailable');
    renderPicker();
    await screen.findByText(/Failed to load workspace details/);

    select(0);

    expect(screen.getByText('Capacity unavailable')).toBeInTheDocument();
    expect(screen.getByText('Selected Repositories (0)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add 0 Repositories' })).toBeDisabled();
  });

  it('updates occupied slots and retains failed selections after partial success', async () => {
    vi.mocked(WorkspaceService.addRepositoryToWorkspace)
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'Temporary failure' });
    renderPicker();
    await screen.findByText('0 / 3 used');
    select(0);
    select(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add 2 Repositories' }));
    await screen.findByText('1 / 3 used');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add 1 Repository' })).toBeEnabled()
    );

    expect(screen.getByText('Selected Repositories (1)')).toBeInTheDocument();
    select(2);
    select(3);

    expect(screen.getByText('Selected Repositories (2)')).toBeInTheDocument();
    expect(screen.getByText(/Maximum 3 repositories allowed/)).toBeInTheDocument();
  });
});
