import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubSearchInput } from '../github-search-input';

// Mock dependencies
const mockSetQuery = vi.fn();
const mockClearResults = vi.fn();

vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: () => ({
    query: '',
    setQuery: mockSetQuery,
    results: [],
    loading: false,
    error: null,
    clearResults: mockClearResults,
  }),
}));

const mockTrackRepoSearchInitiated = vi.fn();
const mockTrackRepoSearchQueryEntered = vi.fn();
const mockTrackSearchResultsViewed = vi.fn();
const mockTrackRepositorySelectedFromSearch = vi.fn();
const mockTrackRepoSearchResultClicked = vi.fn();
const mockTrackRepoSearchCompleted = vi.fn();

vi.mock('@/hooks/use-analytics', () => ({
  useAnalytics: () => ({
    trackRepoSearchInitiated: mockTrackRepoSearchInitiated,
    trackRepoSearchQueryEntered: mockTrackRepoSearchQueryEntered,
    trackSearchResultsViewed: mockTrackSearchResultsViewed,
    trackRepositorySelectedFromSearch: mockTrackRepositorySelectedFromSearch,
    trackRepoSearchResultClicked: mockTrackRepoSearchResultClicked,
    trackRepoSearchCompleted: mockTrackRepoSearchCompleted,
  }),
}));

vi.mock('@/hooks/use-time-formatter', () => ({
  useTimeFormatter: () => ({
    formatRelativeTime: () => '2 hours ago',
  }),
}));

vi.mock('@/components/ui/organization-avatar', () => ({
  OrganizationAvatar: (props: any) => <div data-testid="org-avatar" {...props} />,
}));

// Mock icons
vi.mock('@/components/ui/icon', () => ({
  SearchIcon: (props: any) => <span data-testid="search-icon" {...props} />,
  Star: () => <span />,
  Clock: () => <span />,
  GitBranch: () => <span />,
  Loader2: (props: any) => <span data-testid="loader" {...props} />,
  X: (props: any) => <span data-testid="x-icon" {...props} />,
}));

// Mock Tooltip components to avoid needing Provider in tests
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('GitHubSearchInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with placeholder', () => {
    render(<GitHubSearchInput onSearch={() => {}} placeholder="Test placeholder" />);
    expect(screen.getByPlaceholderText('Test placeholder')).toBeDefined();
  });

  it('does not show clear button when input is empty', () => {
    render(<GitHubSearchInput onSearch={() => {}} />);
    expect(screen.queryByTestId('clear-button')).toBeNull();
  });

  it('shows clear button when input has text', () => {
    render(<GitHubSearchInput onSearch={() => {}} value="react" />);
    expect(screen.getByTestId('clear-button')).toBeDefined();
  });

  it('clears input when clear button is clicked', () => {
    render(<GitHubSearchInput onSearch={() => {}} value="react" />);
    const clearButton = screen.getByTestId('clear-button');
    const input = screen.getByRole('combobox');

    fireEvent.click(clearButton);

    expect(input.getAttribute('value')).toBe('');
    expect(screen.queryByTestId('clear-button')).toBeNull();
  });

  it('updates input value on change', () => {
      render(<GitHubSearchInput onSearch={() => {}} />);
      const input = screen.getByRole('combobox');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(input.getAttribute('value')).toBe('test');
  });
});
