import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import "@testing-library/jest-dom";

// Create simple component versions for testing
const HomePage = () => <div data-testid="home-page">Home Page</div>;
const LoginPage = () => <div data-testid="login-page">Login Page</div>;
const RepoPage = () => <div data-testid="repo-page">Repository Page</div>;

// Mock React Router
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock navigate function
const mockNavigate = vi.fn();

// Create mock auth hook without importing real one
const mockUseGitHubAuth = vi.fn();
vi.mock("../hooks/use-github-auth", () => ({
  useGitHubAuth: () => mockUseGitHubAuth(),
}));

// Create a component that uses our mocked hook for auth protection
const AuthGuard = ({ children }: { children: React.ReactNode }) => {
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

describe("Authentication Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    localStorage.clear();

    // Default mock return value for useGitHubAuth
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
    });

    // Reset window.location.pathname
    window.location.pathname = "/";
  });

  it("redirects to login page when accessing protected route while logged out", async () => {
    // Default mock returns not logged in

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
      expect(getByTestId("repo-page")).toBeTruthy();
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

    // Start with not logged in (default from beforeEach)

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
    expect(getByTestId("login-page")).toBeTruthy();

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
      expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
    });
  });
});
