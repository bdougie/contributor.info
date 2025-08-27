import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { RepoView } from '../features/repository';
import { MetaTagsProvider } from '../common/layout';

// Mock the Supabase client BEFORE importing any hooks
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
  createSupabaseClient: vi.fn(),
}));

// Import the hooks after mocking Supabase
import { useGitHubAuth } from '@/hooks/use-github-auth';

// Mock problematic components to avoid ESM/CJS issues
vi.mock('../contributions', () => ({
  default: () => <div data-testid="mocked-contributions">Mocked Contributions</div>,
}));

vi.mock('../distribution', () => ({
  default: () => <div data-testid="mocked-distribution">Mocked Distribution</div>,
}));

vi.mock('../pr-activity', () => ({
  default: () => <div data-testid="mocked-pr-activity">Mocked PR Activity</div>,
}));

// Mock the hooks
vi.mock('@/hooks/use-github-auth', () => ({
  useGitHubAuth: vi.fn(),
}));

vi.mock('@/hooks/use-cached-repo-data', () => ({
  useCachedRepoData: vi.fn(() => ({
    stats: {
      pullRequests: [],
      loading: false,
      error: null,
    },
    lotteryFactor: null,
    directCommitsData: null,
  })),
}));

// Mock actual navigation functionality
const mockNavigate = vi.fn();
const mockSetShowLoginDialog = vi.fn();

// Mock the GitHub search hook and search input component
vi.mock('@/hooks/use-github-search', () => ({
  useGitHubSearch: vi.fn(() => ({
    query: '',
    setQuery: vi.fn(),
    results: [],
    loading: false,
    error: null,
    clearResults: vi.fn(),
  })),
}));

vi.mock('@/components/ui/github-search-input', () => ({
  GitHubSearchInput: ({ onSearch, placeholder }: any) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.querySelector('input');
        if (input?.value) {
          onSearch(input.value);
        }
      }}
    >
      <input placeholder={placeholder} />
      <button type="submit" aria-label="Search">
        Search
      </button>
    </form>
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: vi.fn(() => ({ owner: 'testowner', repo: 'testrepo' })),
    useNavigate: vi.fn(() => mockNavigate),
    useLocation: vi.fn(() => ({ pathname: '/testowner/testrepo' })),
    Outlet: () => <div data-testid="outlet-mock" />,
  };
});

// Mock the time range store
vi.mock('@/lib/time-range-store', () => ({
  useTimeRangeStore: vi.fn(() => ({ timeRange: '30d' })),
}));

describe('Login behavior for repository search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Set up default mocks for each test
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
      showLoginDialog: false,
      setShowLoginDialog: mockSetShowLoginDialog,
    });
  });

  it('allows searching for a repo the first time while unauthenticated', async () => {
    const user = userEvent.setup();

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Since our component is mocked to simulate viewing a repo already,
    // we need to reset the navigation mock to test the search behavior
    mockNavigate.mockReset();

    // Find the search form and submit button
    const searchInput = screen.getByPlaceholderText(/Search another repository/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    // Enter a repo name and click search
    await user.clear(searchInput);
    await user.type(searchInput, 'facebook/react');
    await user.click(searchButton);

    // Check that direct navigation to repo happens for the first search
    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
  });

  it('requires login for the second search when unauthenticated', async () => {
    const user = userEvent.setup();

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Find the search form and submit button
    const searchInput = screen.getByPlaceholderText(/Search another repository/i);
    const searchButton = screen.getByRole('button', { name: /search/i });

    // First search - should work without login
    await user.clear(searchInput);
    await user.type(searchInput, 'facebook/react');
    await user.click(searchButton);

    expect(mockNavigate).toHaveBeenCalledWith('/facebook/react');
    mockNavigate.mockClear();

    // Second search - should redirect to login
    await user.clear(searchInput);
    await user.type(searchInput, 'vuejs/vue');
    await user.click(searchButton);

    // Check that it navigates to login instead of the repo
    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('redirectAfterLogin')).toBe('/vuejs/vue');
  });

  it('clicking an example repo navigates on first click, requires login on second', async () => {
    const user = userEvent.setup();

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Find example repo buttons
    const exampleButtons = await screen.findAllByRole('button');
    const firstExampleButton = exampleButtons.find((button) =>
      button.textContent?.includes('kubernetes/kubernetes')
    );
    const secondExampleButton = exampleButtons.find((button) =>
      button.textContent?.includes('facebook/react')
    );

    // First click - should navigate directly
    if (firstExampleButton) {
      await user.click(firstExampleButton);
      expect(mockNavigate).toHaveBeenCalledWith('/kubernetes/kubernetes');
    }

    mockNavigate.mockClear();

    // Second click - should redirect to login
    if (secondExampleButton) {
      await user.click(secondExampleButton);
      expect(mockNavigate).toHaveBeenCalledWith('/login');
      expect(localStorage.getItem('redirectAfterLogin')).toBe('/facebook/react');
    }
  });

  it('allows viewing repo details when logged in', async () => {
    // Update auth mock to reflect logged in state
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(true),
      showLoginDialog: false,
      setShowLoginDialog: mockSetShowLoginDialog,
    });

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Since RepoView doesn't auto-redirect anymore with our fix,
    // we should not have any navigation occurring
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
