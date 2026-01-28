import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GitHubSearchInput } from '../github-search-input';

// Mocks
vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: () => ({
    setQuery: vi.fn(),
    results: [],
    loading: false,
  }),
}));

vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackSearchResultsViewed: vi.fn(),
    trackRepositorySelectedFromSearch: vi.fn(),
    trackRepoSearchInitiated: vi.fn(),
    trackRepoSearchQueryEntered: vi.fn(),
    trackRepoSearchResultClicked: vi.fn(),
    trackRepoSearchCompleted: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: vi.fn(),
  }),
}));

vi.mock('@/components/ui/organization-avatar', () => ({
  OrganizationAvatar: () => <div data-testid="org-avatar" />,
}));

describe('GitHubSearchInput', () => {
  const defaultProps = {
    onSearch: vi.fn(),
  };

  it('renders search input', () => {
    render(<GitHubSearchInput {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search repositories/i)).toBeInTheDocument();
  });

  it('renders shortcut hint when globalShortcut is provided', () => {
    render(
      <GitHubSearchInput
        {...defaultProps}
        globalShortcut={{ key: 'k', metaKey: true }}
      />
    );
    expect(screen.getByText(/⌘K|Ctrl\+K/)).toBeInTheDocument();
  });

  it('does not render shortcut hint when globalShortcut is not provided', () => {
    render(<GitHubSearchInput {...defaultProps} />);
    expect(screen.queryByText(/⌘K|Ctrl\+K/)).not.toBeInTheDocument();
  });

  it('hides shortcut hint when input has value', () => {
    render(
      <GitHubSearchInput
        {...defaultProps}
        globalShortcut={{ key: 'k', metaKey: true }}
      />
    );
    const input = screen.getByPlaceholderText(/Search repositories/i);
    fireEvent.change(input, { target: { value: 'react' } });
    expect(screen.queryByText(/⌘K|Ctrl\+K/)).not.toBeInTheDocument();
  });

  it('hides shortcut hint when input is focused', () => {
    render(
      <GitHubSearchInput
        {...defaultProps}
        globalShortcut={{ key: 'k', metaKey: true }}
      />
    );
    const input = screen.getByPlaceholderText(/Search repositories/i);
    fireEvent.focus(input);
    expect(screen.queryByText(/⌘K|Ctrl\+K/)).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(screen.getByText(/⌘K|Ctrl\+K/)).toBeInTheDocument();
  });
});
