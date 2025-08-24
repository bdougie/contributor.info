import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddRepositoryModal } from '../AddRepositoryModal';
import type { Workspace } from '@/types/workspace';

// Mock GitHub search hook
vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: vi.fn(() => ({
    results: [],
    loading: false,
    error: null,
    search: vi.fn()
  }))
}));

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('AddRepositoryModal', () => {
  const mockWorkspace: Workspace = {
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

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal with workspace information', () => {
    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Check modal title
    expect(screen.getByText('Add Repositories to Workspace')).toBeInTheDocument();
    
    // Check free tier message
    expect(screen.getByText(/Free tier is limited to 4 repositories/)).toBeInTheDocument();
    
    // Check repository slots display
    expect(screen.getByText('Repository Slots:')).toBeInTheDocument();
    expect(screen.getByText('0/4')).toBeInTheDocument();
  });

  it('should display correct limits for pro tier', () => {
    const proWorkspace = {
      ...mockWorkspace,
      tier: 'pro' as const,
      max_repositories: 10,
      current_repository_count: 3
    };

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={proWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Should not show free tier message
    expect(screen.queryByText(/Free tier is limited/)).not.toBeInTheDocument();
    
    // Check repository slots for pro tier
    expect(screen.getByText('3/10')).toBeInTheDocument();
  });

  it('should search for repositories', async () => {
    const { useGitHubSearch } = await import('@/hooks/use-github-search');
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
    } as any);

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

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
    const { useGitHubSearch } = await import('@/hooks/use-github-search');
    
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
    } as any);

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Click add to cart button
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    // Check staging area
    expect(screen.getByText('Cart (1)')).toBeInTheDocument();
    
    // Check remove button exists in staging
    expect(screen.getByRole('button', { name: /Remove/i })).toBeInTheDocument();
  });

  it('should prevent adding repositories beyond limit', async () => {
    const nearLimitWorkspace = {
      ...mockWorkspace,
      current_repository_count: 3 // Near free tier limit of 4
    };

    const { useGitHubSearch } = await import('@/hooks/use-github-search');
    
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' } },
        { id: 2, full_name: 'repo2', name: 'repo2', owner: { login: 'owner' } }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    } as any);

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={nearLimitWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Try to add 2 repositories (would exceed limit)
    const addButtons = screen.getAllByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButtons[0]);
    await userEvent.click(addButtons[1]);

    // Check warning about exceeding limit
    expect(screen.getByText(/exceeds your remaining slots/i)).toBeInTheDocument();
    
    // Add button should be disabled
    const addAllButton = screen.getByRole('button', { name: /Add \d+ Repositories/i });
    expect(addAllButton).toBeDisabled();
  });

  it('should successfully add repositories to workspace', async () => {
    const { supabase } = await import('@/lib/supabase');
    const { toast } = await import('sonner');
    
    // Mock successful API call
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: 'workspace-repo-1' }],
          error: null
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null
        })
      })
    } as any);

    const { useGitHubSearch } = await import('@/hooks/use-github-search');
    
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
    } as any);

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Add to cart
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    // Click add repositories button
    const addAllButton = screen.getByRole('button', { name: /Add 1 Repository/i });
    await userEvent.click(addAllButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Successfully added 1 repository');
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle API errors gracefully', async () => {
    const { supabase } = await import('@/lib/supabase');
    const { toast } = await import('sonner');
    
    // Mock API error
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      })
    } as any);

    const { useGitHubSearch } = await import('@/hooks/use-github-search');
    
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' } }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    } as any);

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Add to cart and try to add
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    const addAllButton = screen.getByRole('button', { name: /Add 1 Repository/i });
    await userEvent.click(addAllButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to add repositories: Database error');
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });
  });

  it('should remove repository from staging area', async () => {
    const { useGitHubSearch } = await import('@/hooks/use-github-search');
    
    vi.mocked(useGitHubSearch).mockReturnValue({
      results: [
        { id: 1, full_name: 'repo1', name: 'repo1', owner: { login: 'owner' } }
      ],
      loading: false,
      error: null,
      search: vi.fn()
    } as any);

    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    // Add to cart
    const addButton = screen.getByRole('button', { name: /Add to Cart/i });
    await userEvent.click(addButton);

    expect(screen.getByText('Cart (1)')).toBeInTheDocument();

    // Remove from cart
    const removeButton = screen.getByRole('button', { name: /Remove/i });
    await userEvent.click(removeButton);

    // Cart should be empty
    expect(screen.queryByText('Cart (1)')).not.toBeInTheDocument();
    expect(screen.getByText('No repositories in cart')).toBeInTheDocument();
  });

  it('should close modal when cancel is clicked', async () => {
    render(
      <AddRepositoryModal
        isOpen={true}
        onClose={mockOnClose}
        workspace={mockWorkspace}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});