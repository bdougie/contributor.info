import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { WorkspaceCreationDisabled } from '../WorkspaceCreationDisabled';
import React from 'react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}));

describe('WorkspaceCreationDisabled', () => {
  const mockOnRequestAccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('card variant', () => {
    it('should render the card variant by default (not logged in)', () => {
      render(<WorkspaceCreationDisabled />);

      expect(screen.getByText('Sign In Required')).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to organize repositories and collaborate with your team/)
      ).toBeInTheDocument();
    });

    it('should show login button when callback provided (not logged in)', () => {
      render(<WorkspaceCreationDisabled onRequestAccess={mockOnRequestAccess} />);

      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should not show login button when callback not provided (not logged in)', () => {
      render(<WorkspaceCreationDisabled />);

      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    });

    it('should render upgrade to pro for logged in user', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(<WorkspaceCreationDisabled user={mockUser} />);

      // No heading for logged in users in card variant, just the upgrade message
      expect(screen.getByText(/Workspaces are a Pro feature/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Upgrade and find out' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Upgrade to Pro' })).toBeInTheDocument();
    });
  });

  describe('modal variant', () => {
    it('should render the modal variant (not logged in)', () => {
      render(<WorkspaceCreationDisabled variant="modal" />);

      expect(screen.getByText('Sign In Required')).toBeInTheDocument();
      expect(
        screen.getByText(/Sign in to organize repositories and collaborate with your team/)
      ).toBeInTheDocument();
    });

    it('should render the modal variant (logged in)', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(<WorkspaceCreationDisabled variant="modal" user={mockUser} />);

      // No heading for logged in users in modal variant either
      expect(screen.getByText(/Workspaces are a Pro feature/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Upgrade and find out' })).toBeInTheDocument();
    });

    it('should show sign in button for modal variant when not logged in', () => {
      render(<WorkspaceCreationDisabled variant="modal" onRequestAccess={mockOnRequestAccess} />);

      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    it('should show upgrade button for modal variant when logged in', () => {
      const mockUser = { id: '123', email: 'test@example.com' } as User;
      render(<WorkspaceCreationDisabled variant="modal" user={mockUser} />);

      expect(screen.getByRole('link', { name: /Upgrade to Pro/i })).toBeInTheDocument();
    });

    it('should render different layout for modal variant', () => {
      render(<WorkspaceCreationDisabled variant="modal" />);

      // Modal variant should have centered layout
      const container = screen.getByText('Sign In Required').closest('div');
      expect(container?.className).toContain('text-center');
    });
  });
});
