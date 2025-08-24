import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddRepositoryModal } from '../AddRepositoryModal';

// Simple mock - no complex async behavior
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          data: null
        })),
        in: vi.fn(() => ({ data: [] }))
      }))
    })),
    auth: {
      getUser: vi.fn(() => ({ data: { user: null } }))
    }
  }
}));

vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: vi.fn(() => ({
    query: '',
    setQuery: vi.fn(),
    results: [],
    loading: false,
    error: null,
    clearResults: vi.fn()
  }))
}));

vi.mock('@/services/workspace.service', () => ({
  WorkspaceService: {
    getWorkspace: vi.fn(),
    addRepositoryToWorkspace: vi.fn(),
    listWorkspaceRepositories: vi.fn()
  }
}));

describe('AddRepositoryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render modal when open', () => {
    render(
      <AddRepositoryModal
        workspaceId="test-id"
        open={true}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Simple synchronous assertion
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('should not render modal when closed', () => {
    const { container } = render(
      <AddRepositoryModal
        workspaceId="test-id"
        open={false}
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    // Simple synchronous assertion
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('should call onOpenChange when cancel clicked', () => {
    const mockOnOpenChange = vi.fn();
    
    render(
      <AddRepositoryModal
        workspaceId="test-id"
        open={true}
        onOpenChange={mockOnOpenChange}
        onSuccess={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    cancelButton.click();

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});