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
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled />
        </MemoryRouter>
      );

      expect(screen.getByText('Sign In Required')).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to organize repositories and collaborate with your team/)
      ).toBeInTheDocument();
    });

    it('should show login button when callback provided (not logged in)', () => {
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled onRequestAccess={mockOnRequestAccess} />
        </MemoryRouter>
      );

      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should not show login button when callback not provided (not logged in)', () => {
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled />
        </MemoryRouter>
      );

      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('should render upgrade to pro for logged in user', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled user={mockUser} />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Upgrade to Pro' })).toBeInTheDocument();
      expect(screen.getByText(/Workspaces are a Pro feature/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    });
  });

  describe('modal variant', () => {
    it('should render the modal variant (not logged in)', () => {
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" />
        </MemoryRouter>
      );

      expect(screen.getByText('Sign In Required')).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to organize repositories and collaborate with your team/)
      ).toBeInTheDocument();
    });

    it('should render the modal variant (logged in)', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" user={mockUser} />
        </MemoryRouter>
      );

      expect(screen.getByRole('heading', { name: 'Upgrade to Pro' })).toBeInTheDocument();
      expect(screen.getByText(/Workspaces are a Pro feature/)).toBeInTheDocument();
    });

    it('should show sign in button for modal variant when not logged in', () => {
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" onRequestAccess={mockOnRequestAccess} />
        </MemoryRouter>
      );

      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should show upgrade button for modal variant when logged in', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" user={mockUser} />
        </MemoryRouter>
      );

      expect(screen.getByRole('link', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    });

    it('should render different layout for modal variant', () => {
      render(
        <MemoryRouter>
          <WorkspaceCreationDisabled variant="modal" />
        </MemoryRouter>
      );

      // Modal variant should have centered layout
      const container = screen.getByText('Sign In Required').closest('div');
      expect(container?.className).toContain('text-center');
    });
  });
});
