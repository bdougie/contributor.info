import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { WorkspaceCreationDisabled } from '../WorkspaceCreationDisabled';

describe('WorkspaceCreationDisabled', () => {
  const mockOnRequestAccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('card variant', () => {
    it('should render the card variant by default (not logged in)', () => {
      render(<WorkspaceCreationDisabled />);

      expect(screen.getByText('Login Required')).toBeInTheDocument();
      expect(screen.getByText(/Please log in to create a workspace/)).toBeInTheDocument();
    });

    it('should show login button when callback provided (not logged in)', () => {
      render(<WorkspaceCreationDisabled onRequestAccess={mockOnRequestAccess} />);

      expect(screen.getByText('Login to Continue')).toBeInTheDocument();
    });

    it('should not show login button when callback not provided (not logged in)', () => {
      render(<WorkspaceCreationDisabled />);

      expect(screen.queryByText('Login to Continue')).not.toBeInTheDocument();
    });

    it('should render pro account required for logged in user', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled user={mockUser} />
        </MemoryRouter>
      );

      expect(screen.getByText('Pro Account Required')).toBeInTheDocument();
      expect(
        screen.getByText(/Workspace creation requires a Pro subscription/)
      ).toBeInTheDocument();
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });
  });

  describe('modal variant', () => {
    it('should render the modal variant (not logged in)', () => {
      render(<WorkspaceCreationDisabled variant="modal" />);

      expect(screen.getByText('Login Required')).toBeInTheDocument();
      expect(screen.getByText(/Please log in to create a workspace/)).toBeInTheDocument();
    });

    it('should render the modal variant (logged in)', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" user={mockUser} />
        </MemoryRouter>
      );

      expect(screen.getByText('Pro Account Required')).toBeInTheDocument();
      expect(
        screen.getByText(/Workspace creation requires a Pro subscription/)
      ).toBeInTheDocument();
    });

    it('should show login button for modal variant when not logged in', () => {
      render(<WorkspaceCreationDisabled variant="modal" onRequestAccess={mockOnRequestAccess} />);

      expect(screen.getByText('Login to Continue')).toBeInTheDocument();
    });

    it('should show upgrade button for modal variant when logged in', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" user={mockUser} />
        </MemoryRouter>
      );

      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    });

    it('should render different layout for modal variant', () => {
      render(<WorkspaceCreationDisabled variant="modal" />);

      // Modal variant should have centered layout
      const container = screen.getByText('Login Required').closest('div');
      expect(container?.className).toContain('text-center');
    });
  });
});
