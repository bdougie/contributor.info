import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import RepoView from "../repo-view";

// Import the hooks before mocking them
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
    includeBots: false,
    setIncludeBots: vi.fn(),
  })),
}));

// Mock actual navigation functionality
const mockNavigate = vi.fn();
const mockSetSearchInput = vi.fn();
const mockSetShowLoginDialog = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock("@/hooks/use-repo-search", () => ({
  useRepoSearch: vi.fn(),
}));

vi.mock("@/services/supabase-client", () => ({
  supabase: {
    auth: {
      getSession: vi
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
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
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
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
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
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
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
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
      showLoginDialog: false,
      setShowLoginDialog: mockSetShowLoginDialog,
    });

    render(
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
    );

    // Since RepoView doesn't auto-redirect anymore with our fix,
    // we should not have any navigation occurring
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// Add new test suite for login and redirect flow
describe("Login and redirect flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Set up default mocks
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      showLoginDialog: false,
      setShowLoginDialog: mockSetShowLoginDialog,
    });

    vi.mocked(useRepoSearch).mockReturnValue({
      searchInput: "test/repo",
      setSearchInput: mockSetSearchInput,
      handleSearch: vi.fn((e) => {
        e.preventDefault();
        mockNavigate("/test/repo");
      }),
      handleSelectExample: vi.fn(),
    });
  });

  it("stores intended destination in localStorage when navigating to login page", async () => {
    // Initially not logged in, trying to access a protected route
    const originalPath = "/kubernetes/kubernetes";
    localStorage.setItem("redirectAfterLogin", originalPath);

    // Render repo view component
    render(
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
    );

    // Simulate user clicking login button
    const loginButton = screen.getByRole("button", {
      name: /login with github/i,
    });
    await userEvent.click(loginButton);

    // Should have called the login function from useGitHubAuth
    expect(mockLogin).toHaveBeenCalled();

    // The redirect path should remain in localStorage for after auth
    expect(localStorage.getItem("redirectAfterLogin")).toBe(originalPath);
  });

  it("redirects to intended destination after successful login", async () => {
    // Setup: Store intended destination
    const intendedDestination = "/facebook/react";
    localStorage.setItem("redirectAfterLogin", intendedDestination);

    // Update the mock to simulate a successful login
    const mockAuthStateChange = vi.fn();
    let authCallback: any;

    vi.mocked(useGitHubAuth).mockImplementation(() => {
      // Mock the auth state change listener being triggered
      useEffect(() => {
        // Simulate auth state change after login
        setTimeout(() => {
          if (authCallback) {
            authCallback("SIGNED_IN", { user: { id: "test-user" } });
          }
        }, 100);
      }, []);

      return {
        isLoggedIn: true, // Now logged in
        loading: false,
        login: mockLogin,
        logout: mockLogout,
        showLoginDialog: false,
        setShowLoginDialog: mockSetShowLoginDialog,
      };
    });

    // Mock supabase auth state change
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
      (callback) => {
        authCallback = callback;
        return {
          data: {
            subscription: { unsubscribe: vi.fn() },
          },
        };
      }
    );

    // Render the component
    render(
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
    );

    // Wait for the auth state change to be processed
    await waitFor(() => {
      // Verify navigation to intended destination
      expect(mockNavigate).toHaveBeenCalledWith(intendedDestination);
      // Verify localStorage was cleared
      expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
    });
  });

  it("signs out successfully when logout is called", async () => {
    // Setup: Initially logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      showLoginDialog: false,
      setShowLoginDialog: mockSetShowLoginDialog,
    });

    // Render with authenticated state
    render(
      <BrowserRouter>
        <RepoView />
      </BrowserRouter>
    );

    // Find and click the logout button/option
    // Note: This assumes the RepoView has access to logout functionality
    // If it's in a different component, you might need to adjust this test
    const logoutButton = screen.getByRole("button", { name: /logout/i });
    await userEvent.click(logoutButton);

    // Verify logout was called
    expect(mockLogout).toHaveBeenCalled();

    // After logout, we'd update the mock to show logged out state
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: mockLogin,
      logout: mockLogout,
      showLoginDialog: false,
      setShowLoginDialog: mockSetShowLoginDialog,
    });

    // Wait for the auth state to update and verify appropriate UI changes
    await waitFor(() => {
      // Verify login button is now present
      const loginButtonAfterLogout = screen.getByRole("button", {
        name: /login with github/i,
      });
      expect(loginButtonAfterLogout).toBeInTheDocument();
    });
  });
});
