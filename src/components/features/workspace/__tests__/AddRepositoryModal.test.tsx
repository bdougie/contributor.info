import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRepositoryModal } from '../AddRepositoryModal';

// Mock modules with proper hoisting
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn()
    }
  }
}));

vi.mock('@/services/workspace.service', () => ({
  WorkspaceService: {
    getWorkspace: vi.fn(),
    addRepositoryToWorkspace: vi.fn(),
    listWorkspaceRepositories: vi.fn()
  }
}));

vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Import mocked modules
import { supabase } from '@/lib/supabase';
import { WorkspaceService } from '@/services/workspace.service';
import { useGitHubSearch } from '@/hooks/use-github-search';
import { toast } from 'sonner';

describe('AddRepositoryModal', () => {
  const mockWorkspaceId = 'workspace-123';
  const mockOnOpenChange = vi.fn();
  const mockOnSuccess = vi.fn();

  const mockWorkspace = {
    id: 'workspace-123',
    name: 'Test Workspace',
    slug: 'test-workspace',
    description: 'Test Description',
    avatar_url: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    owner_id: 'user-123',
    tier: 'free',
    repository_limit: 4,
    repositories_count: 0,
    contributors_count: 0,
    last_activity_at: '2024-01-01',
    is_active: true
  };

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: mockUser },
      error: null
    });
    
    // Setup default workspace fetch mock
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockWorkspace,
                error: null
              })
            })
          })
        };
      }
      if (table === 'workspace_repositories') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        };
      }
      if (table === 'repositories') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      };
    });
    
    // Setup default service mocks
    vi.mocked(WorkspaceService.getWorkspace).mockResolvedValue(mockWorkspace);
    vi.mocked(WorkspaceService.listWorkspaceRepositories).mockResolvedValue([]);
    vi.mocked(WorkspaceService.addRepositoryToWorkspace).mockResolvedValue({
      id: 'repo-123',
      workspace_id: mockWorkspaceId,
      repository_id: 'github-repo-123'
    });
    
    // Setup default GitHub search mock
    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });
  });

  it('should render modal with workspace information', async () => {
    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Add Repositories to Workspace')).toBeInTheDocument();
      expect(screen.getByText(/Free tier is limited to 4 repositories/)).toBeInTheDocument();
      expect(screen.getByText('0 / 4 used')).toBeInTheDocument();
    });
  });

  it('should display correct limits for pro tier', async () => {
    const proWorkspace = { ...mockWorkspace, tier: 'pro', repository_limit: 10 };
    
    // Update the Supabase mock to return pro workspace
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: proWorkspace,
                error: null
              })
            })
          })
        };
      }
      if (table === 'workspace_repositories') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        };
      }
      if (table === 'repositories') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      };
    });
    
    vi.mocked(WorkspaceService.getWorkspace).mockResolvedValue(proWorkspace);
    
    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Pro tier is limited to 10 repositories/)).toBeInTheDocument();
      expect(screen.getByText('0 / 10 used')).toBeInTheDocument();
    });
  });

  it('should search for repositories', async () => {
    const mockSetQuery = vi.fn();
    
    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: mockSetQuery,
      results: [
        {
          id: 1,
          full_name: 'vercel/next.js',
          name: 'next.js',
          owner: { login: 'vercel' },
          description: 'The React Framework',
          stargazers_count: 100000,
          language: 'TypeScript',
          forks_count: 20000,
          pushed_at: '2024-01-01T00:00:00Z'
        }
      ],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });

    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    const searchInput = await screen.findByPlaceholderText('Search for repositories (e.g., facebook/react)');
    expect(searchInput).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });
  });

  it('should add repository to staging area', async () => {
    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [
        {
          id: 1,
          full_name: 'vercel/next.js',
          name: 'next.js',
          owner: { login: 'vercel' },
          description: 'The React Framework',
          stargazers_count: 100000,
          language: 'TypeScript',
          forks_count: 20000,
          pushed_at: '2024-01-01T00:00:00Z'
        }
      ],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });

    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add$/ });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Staged Repositories (1)')).toBeInTheDocument();
    });
  });

  it('should prevent adding repositories beyond limit', async () => {
    const limitedWorkspace = {
      ...mockWorkspace,
      tier: 'free',
      repository_limit: 2,
      repositories_count: 1
    };

    // Update the Supabase mock to return limited workspace
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: limitedWorkspace,
                error: null
              })
            })
          })
        };
      }
      if (table === 'workspace_repositories') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ repository_id: 'repo-1' }],
              error: null
            })
          })
        };
      }
      if (table === 'repositories') {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: 'repo-1', full_name: 'existing/repo' }],
              error: null
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      };
    });

    vi.mocked(WorkspaceService.getWorkspace).mockResolvedValue(limitedWorkspace);
    vi.mocked(WorkspaceService.listWorkspaceRepositories).mockResolvedValue([
      { id: 'existing-1', repository_id: 'repo-1', workspace_id: mockWorkspaceId }
    ]);

    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' }, stargazers_count: 100, forks_count: 10, pushed_at: '2024-01-01T00:00:00Z' },
        { id: 2, full_name: 'repo2', name: 'repo2', owner: { login: 'owner' }, stargazers_count: 200, forks_count: 20, pushed_at: '2024-01-01T00:00:00Z' }
      ],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });

    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('1 / 2 used')).toBeInTheDocument();
    });

    // Try to add both repositories
    const addButtons = await screen.findAllByRole('button', { name: /Add$/ });
    await userEvent.click(addButtons[0]);

    // Second add should show toast error
    await userEvent.click(addButtons[1]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Repository limit reached'));
    });
  });

  it('should successfully add repositories to workspace', async () => {
    vi.mocked(WorkspaceService.addRepositoryToWorkspace).mockResolvedValue({
      id: 'new-repo-1',
      workspace_id: mockWorkspaceId,
      repository_id: 'github-repo-1'
    });

    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [
        {
          id: 1,
          full_name: 'vercel/next.js',
          name: 'next.js',
          owner: { login: 'vercel' },
          stargazers_count: 100000,
          forks_count: 20000,
          pushed_at: '2024-01-01T00:00:00Z'
        }
      ],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });

    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add$/ });
    await userEvent.click(addButton);

    const confirmButton = await screen.findByRole('button', { name: /Add 1 Repository/ });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(WorkspaceService.addRepositoryToWorkspace).toHaveBeenCalledWith(
        mockWorkspaceId,
        'vercel',
        'next.js'
      );
      expect(toast.success).toHaveBeenCalledWith('Successfully added 1 repository to workspace');
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    vi.mocked(WorkspaceService.addRepositoryToWorkspace).mockRejectedValue(
      new Error('Failed to add repository')
    );

    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' }, stargazers_count: 100, forks_count: 10, pushed_at: '2024-01-01T00:00:00Z' }
      ],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });

    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('repo1')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add$/ });
    await userEvent.click(addButton);

    const confirmButton = await screen.findByRole('button', { name: /Add 1 Repository/ });
    await userEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add repositories');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('should remove repository from staging area', async () => {
    vi.mocked(useGitHubSearch).mockReturnValue({
      query: '',
      setQuery: vi.fn(),
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' }, stargazers_count: 100, forks_count: 10, pushed_at: '2024-01-01T00:00:00Z' }
      ],
      loading: false,
      error: null,
      clearResults: vi.fn()
    });

    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('repo1')).toBeInTheDocument();
    });

    const addButton = screen.getByRole('button', { name: /Add$/ });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Staged Repositories (1)')).toBeInTheDocument();
    });

    const removeButton = screen.getByRole('button', { name: /Remove/ });
    await userEvent.click(removeButton);

    await waitFor(() => {
      expect(screen.getByText('Staged Repositories (0)')).toBeInTheDocument();
    });
  });

  it('should close modal when cancel is clicked', async () => {
    render(
      <AddRepositoryModal
        workspaceId={mockWorkspaceId}
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = await screen.findByRole('button', { name: /Cancel/ });
    await userEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});