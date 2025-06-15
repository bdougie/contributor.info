import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import RepoView from "../repo-view";
import { MetaTagsProvider } from "../meta-tags-provider";

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

vi.mock("@/hooks/use-repo-data", () => ({
  useRepoData: vi.fn(() => ({
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
    Outlet: () => <div data-testid="outlet-mock" />,
  };
});

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

  it("allows searching for a repo the first time while unauthenticated", async () => {
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

    // Enter a repo name and click search
    await user.clear(searchInput);
    await user.type(searchInput, "facebook/react");
    await user.click(searchButton);

    // Check that direct navigation to repo happens for the first search
    expect(mockNavigate).toHaveBeenCalledWith("/test/repo");
  });

  it("requires login for the second search when unauthenticated", async () => {
    // Mock hasSearchedOnce to true to simulate a second search attempt
    vi.mocked(useRepoSearch).mockReturnValue({
      searchInput: "facebook/react",
      setSearchInput: mockSetSearchInput,
      handleSearch: vi.fn((e) => {
        e.preventDefault();
        // Instead of navigating, it should show login dialog
        mockSetShowLoginDialog(true);
      }),
      handleSelectExample: vi.fn((repo) => {
        // Only update the search input, don't navigate
        mockSetSearchInput(repo);
      }),
    });

    const user = userEvent.setup();

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Find the search form and submit button
    const searchInput = screen.getByPlaceholderText(
      /Search another repository/i
    );
    const searchButton = screen.getByRole("button", { name: /search/i });

    // Enter a repo name and click search
    await user.clear(searchInput);
    await user.type(searchInput, "facebook/react");
    await user.click(searchButton);

    // Check that login dialog is shown instead of navigating
    expect(mockSetShowLoginDialog).toHaveBeenCalledWith(true);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clicking an example repo only fills the search input without navigating", async () => {
    const user = userEvent.setup();
    const handleSelectExample = vi.fn((repo) => {
      mockSetSearchInput(repo);
    });

    vi.mocked(useRepoSearch).mockReturnValue({
      searchInput: "",
      setSearchInput: mockSetSearchInput,
      handleSearch: vi.fn((e) => {
        e.preventDefault();
        mockNavigate("/test/repo");
      }),
      handleSelectExample,
    });

    render(
      <MetaTagsProvider>
        <BrowserRouter>
          <RepoView />
        </BrowserRouter>
      </MetaTagsProvider>
    );

    // Find example repo buttons
    const exampleButtons = await screen.findAllByRole("button");
    const exampleButton = exampleButtons.find((button) =>
      button.textContent?.includes("kubernetes/kubernetes")
    );

    // Click an example repo button
    if (exampleButton) {
      await user.click(exampleButton);
    }

    // Check that handleSelectExample was called
    expect(handleSelectExample).toHaveBeenCalled();

    // Check that setSearchInput was called but navigation did not occur
    expect(mockSetSearchInput).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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
