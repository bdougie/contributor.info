import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubSearchInput } from '../github-search-input';

// Mock hooks
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
    formatRelativeTime: (date: string) => date,
  }),
}));

// Mock OrganizationAvatar
vi.mock('@/components/ui/organization-avatar', () => ({
  OrganizationAvatar: () => <div data-testid="org-avatar" />,
}));

describe('GitHubSearchInput Shortcut', () => {
  const onSearchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with shortcut hint', () => {
    render(<GitHubSearchInput onSearch={onSearchMock} shortcut="/" />);
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('focuses input when shortcut is pressed', () => {
    render(<GitHubSearchInput onSearch={onSearchMock} shortcut="/" />);
    const input = screen.getByRole('combobox');

    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: '/' });

    expect(document.activeElement).toBe(input);
  });

  it('does not focus when other input is active', () => {
    render(
      <div>
        <input type="text" data-testid="other-input" />
        <GitHubSearchInput onSearch={onSearchMock} shortcut="/" />
      </div>
    );

    const otherInput = screen.getByTestId('other-input');
    otherInput.focus();

    const searchInput = screen.getByRole('combobox');

    fireEvent.keyDown(window, { key: '/' });

    expect(document.activeElement).toBe(otherInput);
    expect(document.activeElement).not.toBe(searchInput);
  });

  it('hides shortcut hint when input has value', () => {
    render(<GitHubSearchInput onSearch={onSearchMock} shortcut="/" value="react" />);
    // The hint should not be in the document because of conditional rendering
    expect(screen.queryByText('/')).not.toBeInTheDocument();
  });
});
