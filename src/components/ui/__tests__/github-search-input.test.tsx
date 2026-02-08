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
  OrganizationAvatar: (props: Record<string, unknown>) => (
    <div data-testid="org-avatar" {...props} />
  ),
}));

// Mock icons
vi.mock('@/components/ui/icon', () => ({
  SearchIcon: (props: Record<string, unknown>) => <span data-testid="search-icon" {...props} />,
  Star: () => <span />,
  Clock: () => <span />,
  GitBranch: () => <span />,
  Loader2: (props: Record<string, unknown>) => <span data-testid="loader" {...props} />,
  X: (props: Record<string, unknown>) => <span data-testid="x-icon" {...props} />,
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

  it('renders search input', () => {
    render(<GitHubSearchInput onSearch={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Search repositories/i)).toBeInTheDocument();
  });

  it('renders shortcut hint when globalShortcut is provided', () => {
    render(<GitHubSearchInput onSearch={vi.fn()} globalShortcut={{ key: 'k', metaKey: true }} />);
    expect(screen.getByText(/⌘K|Ctrl\+K/)).toBeInTheDocument();
  });

  it('does not render shortcut hint when globalShortcut is not provided', () => {
    render(<GitHubSearchInput onSearch={vi.fn()} />);
    expect(screen.queryByText(/⌘K|Ctrl\+K/)).not.toBeInTheDocument();
  });

  it('hides shortcut hint when input has value', () => {
    render(<GitHubSearchInput onSearch={vi.fn()} globalShortcut={{ key: 'k', metaKey: true }} />);
    const input = screen.getByPlaceholderText(/Search repositories/i);
    fireEvent.change(input, { target: { value: 'react' } });
    expect(screen.queryByText(/⌘K|Ctrl\+K/)).not.toBeInTheDocument();
  });

  it('hides shortcut hint when input is focused', () => {
    render(<GitHubSearchInput onSearch={vi.fn()} globalShortcut={{ key: 'k', metaKey: true }} />);
    const input = screen.getByPlaceholderText(/Search repositories/i);
    fireEvent.focus(input);
    expect(screen.queryByText(/⌘K|Ctrl\+K/)).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(screen.getByText(/⌘K|Ctrl\+K/)).toBeInTheDocument();
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
