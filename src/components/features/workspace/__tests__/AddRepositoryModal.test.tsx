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
    owner_id: 'user-123',
    visibility: 'public',
    tier: 'free',
    max_repositories: 4,
    current_repository_count: 0,
    data_retention_days: 30,
    settings: {},
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      };
    });
    
    // Setup default WorkspaceService mocks
    vi.mocked(WorkspaceService.getWorkspace).mockResolvedValue({
      success: true,
      data: mockWorkspace
    });
    
    vi.mocked(WorkspaceService.listWorkspaceRepositories).mockResolvedValue({
      success: true,
      data: {
        items: [],
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0
        }
      }
    });
    
    // Setup default GitHub search mock
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [],
      loading: false,
      error: null,
      search: vi.fn()
    });
  });

  it('should render modal with workspace information', async () => {
    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for async operations
    await waitFor(() => {
      expect(screen.getByText('Add Repositories to Workspace')).toBeInTheDocument();
    });
    
    // Check free tier message
    expect(screen.getByText(/Free tier is limited to 4 repositories/)).toBeInTheDocument();
    
    // Check repository slots display
    expect(screen.getByText('Repository Slots:')).toBeInTheDocument();
    expect(screen.getByText('0/4')).toBeInTheDocument();
  });

  it('should display correct limits for pro tier', async () => {
    const proWorkspace = {
      ...mockWorkspace,
      tier: 'pro' as const,
      max_repositories: 10,
      current_repository_count: 3
    };

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
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      };
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('3/10')).toBeInTheDocument();
    });
    
    // Should not show free tier message
    expect(screen.queryByText(/Free tier is limited/)).not.toBeInTheDocument();
  });

  it('should search for repositories', async () => {
    const mockSearch = vi.fn();
    
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        {
          id: 1,
          full_name: 'vercel/next.js',
          name: 'next.js',
          owner: { login: 'vercel' },
          description: 'The React Framework',
          stargazers_count: 100000,
          language: 'TypeScript'
        }
      ],
      loading: false,
      error: null,
      search: mockSearch
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search for repositories/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search for repositories/i);
    await userEvent.type(searchInput, 'next.js');

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith('next.js');
    });

    // Check search results are displayed
    expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    expect(screen.getByText('The React Framework')).toBeInTheDocument();
  });

  it('should add repository to staging area', async () => {
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        {
          id: 1,
          full_name: 'vercel/next.js',
          name: 'next.js',
          owner: { login: 'vercel' },
          description: 'The React Framework',
          stargazers_count: 100000,
          language: 'TypeScript'
        }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });

    // Click add to cart button
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    // Check staging area
    await waitFor(() => {
      expect(screen.getByText('Cart (1)')).toBeInTheDocument();
    });
    
    // Check remove button exists in staging
    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });

  it('should prevent adding repositories beyond limit', async () => {
    const nearLimitWorkspace = {
      ...mockWorkspace,
      current_repository_count: 3 // Near free tier limit of 4
    };

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: nearLimitWorkspace,
                error: null
              })
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      };
    });

    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' } },
        { id: 2, full_name: 'repo2', name: 'repo2', owner: { login: 'owner' } }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('repo1')).toBeInTheDocument();
    });

    // Try to add 2 repositories (would exceed limit)
    const addButtons = screen.getAllByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButtons[0]);
    await userEvent.click(addButtons[1]);

    // Check warning about exceeding limit
    await waitFor(() => {
      expect(screen.getByText(/exceeds your remaining slots/i)).toBeInTheDocument();
    });
    
    // Add button should be disabled
    const addAllButton = screen.getByRole('button', { name: /Add \d+ Repositories/i });
    expect(addAllButton).toBeDisabled();
  });

  it('should successfully add repositories to workspace', async () => {
    // Mock successful API call
    vi.mocked(WorkspaceService.addRepositoryToWorkspace).mockResolvedValue({
      success: true,
      data: { id: 'workspace-repo-1' }
    });

    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        {
          id: 1,
          full_name: 'vercel/next.js',
          name: 'next.js',
          owner: { login: 'vercel' }
        }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('vercel/next.js')).toBeInTheDocument();
    });

    // Add to cart
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Cart (1)')).toBeInTheDocument();
    });

    // Click add repositories button
    const addAllButton = screen.getByRole('button', { name: /Add 1 Repository/i });
    await userEvent.click(addAllButton);

    await waitFor(() => {
      expect(WorkspaceService.addRepositoryToWorkspace).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Successfully added 1 repository');
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    vi.mocked(WorkspaceService.addRepositoryToWorkspace).mockResolvedValue({
      success: false,
      error: 'Database error'
    });

    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' } }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('repo1')).toBeInTheDocument();
    });

    // Add to cart and try to add
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Cart (1)')).toBeInTheDocument();
    });

    const addAllButton = screen.getByRole('button', { name: /Add 1 Repository/i });
    await userEvent.click(addAllButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add repositories: Database error');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('should remove repository from staging area', async () => {
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' } }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    });

    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('repo1')).toBeInTheDocument();
    });

    // Add to cart
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Cart (1)')).toBeInTheDocument();
    });

    // Remove from cart
    const removeButton = screen.getByRole('button', { name: /Remove/i });
    await userEvent.click(removeButton);

    // Cart should be empty
    await waitFor(() => {
      expect(screen.queryByText('Cart (1)')).not.toBeInTheDocument();
      expect(screen.getByText('No repositories in cart')).toBeInTheDocument();
    });
  });

  it('should close modal when cancel is clicked', async () => {
    render(
      <AddRepositoryModal
        open={true}
        onOpenChange={mockOnOpenChange}
        workspaceId={mockWorkspaceId}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});