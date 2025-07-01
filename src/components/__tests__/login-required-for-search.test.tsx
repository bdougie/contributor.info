import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import { RepoView } from "../features/repository";
import { MetaTagsProvider } from "../common/layout";

// Mock ResizeObserver to avoid test errors
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock the Supabase client BEFORE importing any hooks
vi.mock("@/lib/supabase", () => ({
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
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { useRepoSearch } from "@/hooks/use-repo-search";

// Mock problematic components to avoid ESM/CJS issues
vi.mock("../contributions", () => ({
  default: () => (
    <div data-testid="mocked-contributions">Mocked Contributions</div>
  ),
}));

vi.mock("../distribution", () => ({
  default: () => (
    <div data-testid="mocked-distribution">Mocked Distribution</div>
  ),
}));

vi.mock("../pr-activity", () => ({
  default: () => <div data-testid="mocked-pr-activity">Mocked PR Activity</div>,
}));

// Mock the hooks
vi.mock("@/hooks/use-github-auth", () => ({
  useGitHubAuth: vi.fn(),
}));

vi.mock("@/hooks/use-cached-repo-data", () => ({
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

// Mock repository search hook
vi.mock("@/hooks/use-repository-search", () => ({
  useRepositorySearch: vi.fn(() => ({
    query: "",
    setQuery: vi.fn(),
    results: [],
    isLoading: false,
    error: null,
    hasResults: false,
    clearResults: vi.fn(),
  })),
}));

// Mock actual navigation functionality
const mockNavigate = vi.fn();
const mockSetSearchInput = vi.fn();
const mockSetShowLoginDialog = vi.fn();

vi.mock("@/hooks/use-repo-search", () => ({
  useRepoSearch: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: vi.fn(() => ({ owner: "testowner", repo: "testrepo" })),
    useNavigate: vi.fn(() => mockNavigate),
    useLocation: vi.fn(() => ({ pathname: "/testowner/testrepo" })),
    Outlet: () => <div data-testid="outlet-mock" />,
  };
});

// Mock the time range store
vi.mock("@/lib/time-range-store", () => ({
  useTimeRangeStore: vi.fn(() => ({ timeRange: "30d" })),
}));

describe("Login behavior for repository search", () => {
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

    // Default mock implementation
    vi.mocked(useRepoSearch).mockReturnValue({
      searchInput: "test/repo",
      setSearchInput: mockSetSearchInput,
      handleSearch: vi.fn((e) => {
        e.preventDefault();
        mockNavigate("/test/repo");
      }),
      handleSelectExample: vi.fn((repo) => {
        // Only update the search input, don't navigate
        mockSetSearchInput(repo);
      }),
    });
  });

  it("requires login for searches from repo view when unauthenticated", async () => {
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
    const searchInput = screen.getByPlaceholderText(
      /Search another repository/i
    );
    const searchButton = screen.getByRole("button", { name: /search/i });

    // Enter a repo name and submit the form
    await user.clear(searchInput);
    await user.type(searchInput, "facebook/react");
    
    // Use form submission instead of button click for more reliable testing
    const form = searchInput.closest('form');
    if (form) {
      await user.click(searchButton);
    }

    // Check that it navigates to login since repo view requires auth
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("stores redirect URL when navigating to login", async () => {
    const user = userEvent.setup();
    const mockSetItem = vi.fn();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        setItem: mockSetItem,
        getItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Reset navigation mock
    mockNavigate.mockReset();

    // Find the search form and submit button
    const searchInput = screen.getByPlaceholderText(
      /Search another repository/i
    );
    const searchButton = screen.getByRole("button", { name: /search/i });

    // Enter a repo name and submit the form
    await user.clear(searchInput);
    await user.type(searchInput, "facebook/react");
    
    // Use form submission for more reliable testing
    const form = searchInput.closest('form');
    if (form) {
      await user.click(searchButton);
    }

    // Check that it stores the redirect URL before navigating to login
    expect(mockSetItem).toHaveBeenCalledWith('redirectAfterLogin', '/facebook/react');
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it("clicking an example repo navigates directly without auth check", async () => {
    const user = userEvent.setup();
    
    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Reset navigation mock  
    mockNavigate.mockReset();

    // Find example repo buttons
    const exampleButtons = await screen.findAllByRole("button");
    const exampleButton = exampleButtons.find((button) =>
      button.textContent?.includes("kubernetes/kubernetes")
    );

    // Click an example repo button
    if (exampleButton) {
      await user.click(exampleButton);
    }

    // The handleSelectExample in RepoView navigates directly without auth check
    // This is the current behavior based on the RepoView implementation
    expect(mockNavigate).toHaveBeenCalledWith("/kubernetes/kubernetes");
  });

  it("allows viewing repo details when logged in", async () => {
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
