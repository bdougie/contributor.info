import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { GitHubSearchInput } from '@/components/ui/github-search-input';
import { AddRepositoryModal } from '../AddRepositoryModal';
import type { GitHubRepository } from '@/lib/github';
import { toOrgImportRepo, type OrgImportRepo } from '@/lib/utils/org-import';

const mocks = vi.hoisted(() => ({
  fetchRepositoryInfo: vi.fn(),
  results: [] as GitHubRepository[],
  setQuery: vi.fn(),
  analytics: {
    trackRepoSearchInitiated: vi.fn(),
    trackRepoSearchQueryEntered: vi.fn(),
    trackSearchResultsViewed: vi.fn(),
    trackRepositorySelectedFromSearch: vi.fn(),
    trackRepoSearchResultClicked: vi.fn(),
    trackRepoSearchCompleted: vi.fn(),
  },
  maxRepositories: 3,
  addRepositories: vi.fn(),
  orgRepos: [] as OrgImportRepo[],
  savedLookup: vi.fn(),
}));
vi.mock('@/lib/github', () => ({ fetchRepositoryInfo: mocks.fetchRepositoryInfo }));
vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: () => ({ results: mocks.results, setQuery: mocks.setQuery, loading: false }),
}));
vi.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => mocks.analytics }));
vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({ formatRelativeTime: () => 'today' }),
}));
vi.mock('@/components/ui/organization-avatar', () => ({ OrganizationAvatar: () => <span /> }));
vi.mock('@/hooks/use-org-repos-for-import', () => ({
  useOrgReposForImport: () => ({
    repos: mocks.orgRepos,
    appInstalled: false,
    isLoading: false,
    error: null,
  }),
}));
vi.mock('@/lib/auth-helpers', () => ({ getAppUserId: () => Promise.resolve('app-user') }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/services/workspace.service', () => ({
  WorkspaceService: { addRepositoriesToWorkspace: mocks.addRepositories },
}));
vi.mock('@/lib/supabase-lazy', () => ({
  getSupabase: () =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'auth-user' } } }) },
      from: (table: string) =>
        table === 'repositories'
          ? {
              select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: mocks.savedLookup }) }) }),
            }
          : {
              select: () => ({
                eq: () =>
                  table === 'workspaces'
                    ? {
                        maybeSingle: () =>
                          Promise.resolve({
                            data: { tier: 'team', max_repositories: mocks.maxRepositories },
                            error: null,
                          }),
                      }
                    : Promise.resolve({ data: [], error: null }),
              }),
            },
    }),
}));

const tapes: GitHubRepository = {
  id: 42,
  name: 'tapes',
  full_name: 'papercomputeco/tapes',
  owner: { login: 'papercomputeco', avatar_url: 'https://github.com/papercomputeco.png' },
  description: null,
  stargazers_count: 0,
  forks_count: 0,
  private: false,
};
function renderPicker(initialRepository?: string) {
  return render(
    <TooltipProvider>
      <AddRepositoryModal
        open
        workspaceId="workspace"
        initialRepository={initialRepository}
        onOpenChange={vi.fn()}
      />
    </TooltipProvider>
  );
}

describe('workspace exact repository selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.results = [];
    mocks.maxRepositories = 3;
    mocks.orgRepos = [];
    mocks.savedLookup.mockResolvedValue({ data: null, error: null });
    mocks.fetchRepositoryInfo.mockResolvedValue(tapes);
  });

  it.each(['papercomputeco/tapes', 'https://github.com/papercomputeco/tapes'])(
    'stages %s on Enter without an autocomplete selection',
    async (query) => {
      const user = userEvent.setup();
      renderPicker();
      await screen.findByText('0 / 3 used');
      await user.type(screen.getByRole('combobox'), `${query}{Enter}`);
      await screen.findByText('Selected Repositories (1)');
      expect(screen.getByRole('combobox')).toHaveValue('');
      expect(mocks.fetchRepositoryInfo).toHaveBeenCalledWith('papercomputeco', 'tapes', {
        throwOnError: true,
      });
      expect(mocks.addRepositories).not.toHaveBeenCalled();
    }
  );

  it('stages an inaccessible exact name for verification from the same input', async () => {
    mocks.fetchRepositoryInfo.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    renderPicker('papercomputeco/paper');
    await screen.findByText('0 / 3 used');
    await user.click(screen.getByRole('button', { name: 'Select', exact: true }));
    await screen.findByText('Selected Repositories (1)');
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.queryByText('Private', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Add private repo' })).not.toBeInTheDocument();
    expect(mocks.savedLookup).toHaveBeenCalledOnce();
    expect(mocks.addRepositories).not.toHaveBeenCalled();
  });

  it('finds a registered private repository after GitHub cannot see it', async () => {
    mocks.fetchRepositoryInfo.mockResolvedValueOnce(null);
    mocks.savedLookup.mockResolvedValueOnce({
      data: {
        github_id: 99,
        owner: 'papercomputeco',
        name: 'paper',
        description: null,
        language: 'Go',
        stargazers_count: 0,
        forks_count: 0,
        is_private: true,
      },
      error: null,
    });
    renderPicker('https://github.com/papercomputeco/paper');
    await screen.findByText('0 / 3 used');
    fireEvent.click(screen.getByRole('button', { name: 'Select', exact: true }));
    await screen.findByText('Selected Repositories (1)');
    expect(screen.getByText('papercomputeco/paper')).toBeInTheDocument();
    expect(screen.getByText('Private', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('Pending verification')).not.toBeInTheDocument();
  });

  it('keeps the query for retry when the private lookup fails', async () => {
    mocks.fetchRepositoryInfo.mockResolvedValueOnce(null);
    mocks.savedLookup.mockResolvedValueOnce({ data: null, error: new Error('Unavailable') });
    renderPicker('papercomputeco/paper');
    await screen.findByText('0 / 3 used');
    fireEvent.click(screen.getByRole('button', { name: 'Select', exact: true }));
    await screen.findByText('Repository lookup failed. Please try again.');
    expect(screen.getByRole('combobox')).toHaveValue('papercomputeco/paper');
    expect(screen.getByText('Selected Repositories (0)')).toBeInTheDocument();
  });

  it('preserves input when a lookup rejects or input is not an exact repository', async () => {
    mocks.fetchRepositoryInfo.mockRejectedValue(new Error('Network unavailable'));
    const user = userEvent.setup();
    renderPicker('papercomputeco/tapes');
    await screen.findByText('0 / 3 used');
    await user.click(screen.getByRole('button', { name: 'Select', exact: true }));
    await screen.findByText(/Repository lookup failed/);
    expect(screen.getByRole('combobox')).toHaveValue('papercomputeco/tapes');
    await user.clear(screen.getByRole('combobox'));
    expect(screen.queryByText(/Repository lookup failed/)).not.toBeInTheDocument();
    await user.type(screen.getByRole('combobox'), 'tapes{Enter}');
    expect(screen.getByText(/Enter an exact owner\/repository/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('tapes');
    expect(mocks.fetchRepositoryInfo).toHaveBeenCalledTimes(1);
  });

  it('keeps arrow-key selection working without an extra exact lookup', async () => {
    mocks.results = [tapes];
    const user = userEvent.setup();
    renderPicker();
    await screen.findByText('0 / 3 used');
    await user.type(screen.getByRole('combobox'), 'tapes{ArrowDown}{Enter}');
    await screen.findByText('Selected Repositories (1)');
    expect(mocks.fetchRepositoryInfo).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('retains the query when the workspace is full', async () => {
    mocks.maxRepositories = 0;
    const user = userEvent.setup();
    renderPicker('papercomputeco/tapes');
    await screen.findByText('0 / 0 used');
    await user.click(screen.getByRole('button', { name: 'Select', exact: true }));
    await screen.findByText(/Maximum 0 repositories allowed/);
    expect(screen.getByRole('combobox')).toHaveValue('papercomputeco/tapes');
    expect(screen.getByText('Selected Repositories (0)')).toBeInTheDocument();
  });

  it('uses the latest selection when an exact lookup resolves late', async () => {
    let resolveLookup!: (repo: GitHubRepository) => void;
    mocks.fetchRepositoryInfo.mockReturnValue(
      new Promise<GitHubRepository>((resolve) => {
        resolveLookup = resolve;
      })
    );
    renderPicker('papercomputeco/tapes');
    await screen.findByText('0 / 3 used');
    fireEvent.click(screen.getByRole('button', { name: 'Select', exact: true }));
    expect(screen.getByRole('combobox')).toBeDisabled();
    mocks.orgRepos = [toOrgImportRepo({ id: 99, name: 'other', full_name: 'pcc-labs/other' })];
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Import from org' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'GitHub organization name' }), {
      target: { value: 'pcc-labs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load repos' }));
    await screen.findByText('Selected Repositories (1)');
    await act(async () => {
      resolveLookup(tapes);
    });
    await waitFor(() => expect(screen.getByText('Selected Repositories (2)')).toBeInTheDocument());
  });

  it('prevents duplicate staging with different casing', async () => {
    const user = userEvent.setup();
    renderPicker('papercomputeco/tapes');
    await screen.findByText('0 / 3 used');
    await user.click(screen.getByRole('button', { name: 'Select', exact: true }));
    mocks.fetchRepositoryInfo.mockResolvedValue({ ...tapes, full_name: 'PaperComputeCo/Tapes' });
    await user.type(screen.getByRole('combobox'), 'PaperComputeCo/Tapes{Enter}');
    await screen.findByText(/already in your selection/);
    expect(screen.getByText('Selected Repositories (1)')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('PaperComputeCo/Tapes');
  });

  it('does not stage a lookup after the modal closes and reopens', async () => {
    let resolveLookup!: (repo: GitHubRepository) => void;
    mocks.fetchRepositoryInfo.mockReturnValue(
      new Promise<GitHubRepository>((resolve) => {
        resolveLookup = resolve;
      })
    );
    const props = {
      workspaceId: 'workspace',
      initialRepository: 'papercomputeco/tapes',
      onOpenChange: vi.fn(),
    };
    const view = render(
      <TooltipProvider>
        <AddRepositoryModal open {...props} />
      </TooltipProvider>
    );
    await screen.findByText('0 / 3 used');
    fireEvent.click(screen.getByRole('button', { name: 'Select', exact: true }));
    view.rerender(
      <TooltipProvider>
        <AddRepositoryModal open={false} {...props} />
      </TooltipProvider>
    );
    view.rerender(
      <TooltipProvider>
        <AddRepositoryModal open {...props} />
      </TooltipProvider>
    );
    await screen.findByText('0 / 3 used');
    await act(async () => {
      resolveLookup(tapes);
    });
    expect(screen.getByText('Selected Repositories (0)')).toBeInTheDocument();
  });

  it('rejects a late lookup when another selection has taken the last slot', async () => {
    mocks.maxRepositories = 1;
    let resolveLookup!: (repo: GitHubRepository) => void;
    mocks.fetchRepositoryInfo.mockReturnValue(
      new Promise<GitHubRepository>((resolve) => {
        resolveLookup = resolve;
      })
    );
    renderPicker('papercomputeco/tapes');
    await screen.findByText('0 / 1 used');
    fireEvent.click(screen.getByRole('button', { name: 'Select', exact: true }));
    mocks.orgRepos = [toOrgImportRepo({ id: 99, name: 'other', full_name: 'pcc-labs/other' })];
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Import from org' }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'GitHub organization name' }), {
      target: { value: 'pcc-labs' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Load repos' }));
    await screen.findByText('Selected Repositories (1)');
    await act(async () => {
      resolveLookup(tapes);
    });
    expect(screen.getByText('Selected Repositories (1)')).toBeInTheDocument();
    expect(screen.getByText(/Maximum 1 repositories allowed/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Search', exact: true }), {
      button: 0,
      ctrlKey: false,
    });
    expect(screen.getByRole('combobox')).toHaveValue('papercomputeco/tapes');
  });

  it('preserves legacy synchronous search callbacks that return no result', () => {
    const onSearch = vi.fn();
    render(
      <TooltipProvider>
        <GitHubSearchInput value="papercomputeco/tapes" onSearch={onSearch} />
      </TooltipProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    expect(onSearch).toHaveBeenCalledWith('papercomputeco/tapes');
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('retains the input and re-enables retry when a search callback rejects', async () => {
    const onSearch = vi.fn().mockRejectedValue(new Error('Failed'));
    render(
      <TooltipProvider>
        <GitHubSearchInput value="papercomputeco/tapes" onSearch={onSearch} />
      </TooltipProvider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getByRole('combobox')).toBeEnabled());
    expect(screen.getByRole('combobox')).toHaveValue('papercomputeco/tapes');
  });
});
