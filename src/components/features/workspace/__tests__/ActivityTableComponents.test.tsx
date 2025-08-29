import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityTableHeader } from '../components/ActivityTableHeader';
import { ActivityTableRow } from '../components/ActivityTableRow';
import { ActivityTableFilters } from '../components/ActivityTableFilters';
import type { ActivityItem } from '../AnalyticsDashboard';

describe('ActivityTable Components', () => {
  describe('ActivityTableHeader', () => {
    it('renders all column headers', () => {
      const onSort = vi.fn();
      render(<ActivityTableHeader sortField="created_at" sortOrder="desc" onSort={onSort} />);

      expect(screen.getByRole('columnheader', { name: /activity/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /status/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /actions/i })).toBeInTheDocument();
    });

    it('shows sort indicators correctly', () => {
      const onSort = vi.fn();
      render(<ActivityTableHeader sortField="created_at" sortOrder="asc" onSort={onSort} />);

      const dateButton = screen.getByRole('button', { name: /sort by date/i });
      expect(dateButton).toHaveAttribute('aria-sort', 'ascending');
    });

    it('calls onSort when column header is clicked', async () => {
      const onSort = vi.fn();
      render(<ActivityTableHeader sortField="created_at" sortOrder="desc" onSort={onSort} />);

      const typeButton = screen.getByRole('button', { name: /sort by type/i });
      await userEvent.click(typeButton);

      expect(onSort).toHaveBeenCalledWith('type');
    });

    it('has proper ARIA labels for screen readers', () => {
      const onSort = vi.fn();
      render(<ActivityTableHeader sortField="author" sortOrder="asc" onSort={onSort} />);

      const authorButton = screen.getByRole('button', {
        name: /sort by author.*sorted ascending/i,
      });
      expect(authorButton).toHaveAttribute('aria-sort', 'ascending');
    });
  });

  describe('ActivityTableRow', () => {
    const mockActivity: ActivityItem = {
      id: '1',
      type: 'pr',
      title: 'Fix critical bug in authentication',
      author: {
        username: 'johndoe',
        avatar_url: 'https://github.com/johndoe.png',
      },
      repository: 'facebook/react',
      created_at: '2024-01-15T10:00:00Z',
      status: 'merged',
      url: 'https://github.com/facebook/react/pull/123',
    };

    it('renders activity data correctly', () => {
      render(<ActivityTableRow activity={mockActivity} />);

      expect(screen.getByText('Fix critical bug in authentication')).toBeInTheDocument();
      expect(screen.getByText('facebook/react')).toBeInTheDocument();
      expect(screen.getByText(/johndoe/)).toBeInTheDocument();
    });

    it('displays correct type badge', () => {
      render(<ActivityTableRow activity={mockActivity} />);

      const badge = screen.getByLabelText(/pull request/i);
      expect(badge).toBeInTheDocument();
    });

    it('shows status badge with correct styling', () => {
      render(<ActivityTableRow activity={mockActivity} />);

      const statusBadge = screen.getByLabelText(/status: merged/i);
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass('bg-purple-500/10');
    });

    it('has keyboard accessibility', () => {
      render(<ActivityTableRow activity={mockActivity} />);

      const row = screen.getByRole('row');
      expect(row).toHaveAttribute('tabIndex', '0');
      expect(row).toHaveAttribute('aria-label', expect.stringContaining('Pull Request by johndoe'));
    });

    it('opens URL safely when clicking external link', async () => {
      const openSpy = vi.fn();
      global.window.open = openSpy;

      render(<ActivityTableRow activity={mockActivity} />);

      const linkButton = screen.getByRole('button', { name: /open.*in new tab/i });
      await userEvent.click(linkButton);

      expect(openSpy).toHaveBeenCalledWith(
        'https://github.com/facebook/react/pull/123',
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('handles missing avatar gracefully', () => {
      const activityWithoutAvatar = {
        ...mockActivity,
        author: { username: 'johndoe' },
      };

      render(<ActivityTableRow activity={activityWithoutAvatar} />);

      const fallback = screen.getByText('JO');
      expect(fallback).toBeInTheDocument();
    });
  });

  describe('ActivityTableFilters', () => {
    it('renders search input and type filter', () => {
      const onSearchChange = vi.fn();
      const onTypeFilterChange = vi.fn();

      render(
        <ActivityTableFilters
          onSearchChange={onSearchChange}
          onTypeFilterChange={onTypeFilterChange}
          typeFilter="all"
          searchQuery=""
        />
      );

      expect(screen.getByLabelText(/search activities/i)).toBeInTheDocument();
      // The Select component doesn't propagate aria-label to the trigger button
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('debounces search input', async () => {
      const onSearchChange = vi.fn();
      const onTypeFilterChange = vi.fn();

      render(
        <ActivityTableFilters
          onSearchChange={onSearchChange}
          onTypeFilterChange={onTypeFilterChange}
          typeFilter="all"
          searchQuery=""
        />
      );

      const searchInput = screen.getByLabelText(/search activities/i);
      await userEvent.type(searchInput, 'react');

      // Should not call immediately
      expect(onSearchChange).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(
        () => {
          expect(onSearchChange).toHaveBeenCalledWith('react');
        },
        { timeout: 500 }
      );
    });

    it('updates type filter immediately', async () => {
      const onSearchChange = vi.fn();
      const onTypeFilterChange = vi.fn();

      render(
        <ActivityTableFilters
          onSearchChange={onSearchChange}
          onTypeFilterChange={onTypeFilterChange}
          typeFilter="all"
          searchQuery=""
        />
      );

      const filterTrigger = screen.getByRole('combobox');
      await userEvent.click(filterTrigger);

      const prOption = screen.getByRole('option', { name: /pull requests/i });
      await userEvent.click(prOption);

      expect(onTypeFilterChange).toHaveBeenCalledWith('pr');
    });

    it('has proper ARIA descriptions', () => {
      const onSearchChange = vi.fn();
      const onTypeFilterChange = vi.fn();

      render(
        <ActivityTableFilters
          onSearchChange={onSearchChange}
          onTypeFilterChange={onTypeFilterChange}
          typeFilter="all"
          searchQuery=""
        />
      );

      const searchInput = screen.getByLabelText(/search activities/i);
      expect(searchInput).toHaveAttribute('aria-describedby', 'search-description');

      const description = screen.getByText(/search by activity title, author, or repository name/i);
      expect(description).toHaveClass('sr-only');
    });

    it('syncs local state with prop changes', () => {
      const onSearchChange = vi.fn();
      const onTypeFilterChange = vi.fn();

      const { rerender } = render(
        <ActivityTableFilters
          onSearchChange={onSearchChange}
          onTypeFilterChange={onTypeFilterChange}
          typeFilter="all"
          searchQuery="initial"
        />
      );

      const searchInput = screen.getByLabelText(/search activities/i) as HTMLInputElement;
      expect(searchInput.value).toBe('initial');

      rerender(
        <ActivityTableFilters
          onSearchChange={onSearchChange}
          onTypeFilterChange={onTypeFilterChange}
          typeFilter="all"
          searchQuery="updated"
        />
      );

      expect(searchInput.value).toBe('updated');
    });
  });
});
