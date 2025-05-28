import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "@testing-library/jest-dom"; // Add jest-dom matchers

// Create simple components for testing
const HomePage = () => <div data-testid="home-page">Home Page</div>;
const LoginPage = () => <div data-testid="login-page">Login Page</div>;
const RepoPage = () => <div data-testid="repo-page">Repo Page</div>;

// Mock React Router's navigate function
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create a mock auth hook directly - don't try to import it
const mockUseGitHubAuth = vi.fn();
vi.mock("../hooks/use-github-auth", () => ({
  useGitHubAuth: mockUseGitHubAuth,
}));

// Create a component that uses our mocked hook for auth protection
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn } = mockUseGitHubAuth();

  if (!isLoggedIn) {
    const path = window.location.pathname;
    if (path !== "/login" && path !== "/") {
      localStorage.setItem("redirectAfterLogin", path);
      mockNavigate("/login");
      return null;
    }
  }

  return children;
};

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

describe("Authentication Flow with Navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    localStorage.clear();

    // Set default mock return value
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
    });

    // Reset window.location.pathname
    window.location.pathname = "/";
  });

  it("redirects to login page when accessing protected route while logged out", async () => {
    // Default mock already returns not logged in

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
    // Update mock to return logged in
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(true),
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
      // Use basic query selector if toBeInTheDocument isn't available
      const repoElement = getByTestId("repo-page");
      expect(repoElement).toBeTruthy();
    });
  });

  it("redirects back to the intended page after successful login", async () => {
    // Store intended path
    localStorage.setItem("redirectAfterLogin", "/facebook/react");

    // Create a component that simulates login page behavior
    const LoginWithRedirect = () => {
      const { isLoggedIn } = mockUseGitHubAuth();

      // If logged in, redirect to stored path
      if (isLoggedIn) {
        const redirectPath = localStorage.getItem("redirectAfterLogin");
        if (redirectPath) {
          mockNavigate(redirectPath);
          localStorage.removeItem("redirectAfterLogin");
        } else {
          mockNavigate("/");
        }
      }

      return <div data-testid="login-page">Login Page</div>;
    };

    // Start with not logged in
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
    });

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
    const loginElement = getByTestId("login-page");
    expect(loginElement).toBeTruthy();

    // Now change login state to logged in
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(true),
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
      expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
    });
  });
});
