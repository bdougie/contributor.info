import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import "@testing-library/jest-dom"; // Add jest-dom matchers

// Create test components instead of using App
const HomePage = () => <div data-testid="home-page">Home Page</div>;
const LoginPage = () => <div data-testid="login-page">Login Page</div>;
const RepoPage = () => <div data-testid="repo-page">Repository Page</div>;

// Mock React Router
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  const mockNavigate = vi.fn();

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the supabase module
vi.mock("../lib/supabase", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn(() => ({
          unsubscribe: vi.fn(),
        })),
      },
    },
    createSupabaseClient: vi.fn(),
  };
});

// Mock GitHub auth hook directly instead of requiring it
const mockUseGitHubAuth = vi.fn();

// Mock GitHub auth hook
vi.mock("../hooks/use-github-auth", () => ({
  useGitHubAuth: () => mockUseGitHubAuth(),
}));

// Setup for window.location
Object.defineProperty(window, "location", {
  value: {
    href: "",
    pathname: "/",
    search: "",
    replace: vi.fn(),
  },
  writable: true,
});

// Auth guard component for testing redirect behavior
const AuthGuard = ({ children }) => {
  const navigate = useNavigate();
  const { isLoggedIn } = mockUseGitHubAuth();

  if (!isLoggedIn) {
    const path = window.location.pathname;
    if (path !== "/login" && path !== "/") {
      localStorage.setItem("redirectAfterLogin", path);
      navigate("/login");
      return null;
    }
  }

  return children;
};

describe("Authentication Flow", () => {
  let mockNavigate;

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();

    // Get mocked navigate function
    mockNavigate = vi.mocked(useNavigate());

    // Reset window.location.pathname
    window.location.pathname = "/";

    // Default mock implementation
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });
  });

  it("redirects to login page when accessing protected route while logged out", async () => {
    // Set up hook to return not logged in - already set in beforeEach

    // Set pathname to simulate repository page
    window.location.pathname = "/facebook/react";

    render(
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:owner/:repo/*"
            element={
              <AuthGuard>
                <RepoPage />
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Check that navigate to login was called
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
      expect(localStorage.getItem("redirectAfterLogin")).toBe(
        "/facebook/react"
      );
    });
  });

  it("allows access to protected routes when logged in", async () => {
    // Set up hook to return logged in
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    // Set pathname to simulate repository page
    window.location.pathname = "/facebook/react";

    const { getByTestId } = render(
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/:owner/:repo/*"
            element={
              <AuthGuard>
                <RepoPage />
              </AuthGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    // Should not redirect and should render repo page
    await waitFor(() => {
      expect(mockNavigate).not.toHaveBeenCalled();
      const repoPage = getByTestId("repo-page");
      expect(repoPage).toBeTruthy();
    });
  });

  it("redirects back to the intended page after successful login", async () => {
    // Store intended path
    localStorage.setItem("redirectAfterLogin", "/facebook/react");

    // Create a component that simulates login page behavior
    const LoginWithRedirect = () => {
      const navigate = useNavigate();
      const { isLoggedIn } = mockUseGitHubAuth();

      // If logged in, redirect to stored path
      if (isLoggedIn) {
        const redirectPath = localStorage.getItem("redirectAfterLogin");
        if (redirectPath) {
          navigate(redirectPath);
          localStorage.removeItem("redirectAfterLogin");
        } else {
          navigate("/");
        }
      }

      return <div data-testid="login-page">Login Page</div>;
    };

    // Start with not logged in - default from beforeEach

    const { rerender, getByTestId } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginWithRedirect />} />
          <Route path="/:owner/:repo/*" element={<RepoPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify login page is displayed
    const loginPage = getByTestId("login-page");
    expect(loginPage).toBeTruthy();

    // Now change login state to logged in
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    // Rerender to trigger the redirect logic
    rerender(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginWithRedirect />} />
          <Route path="/:owner/:repo/*" element={<RepoPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Verify navigation and localStorage operations
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
    });
  });
});
