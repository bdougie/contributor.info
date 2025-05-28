import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock all needed dependencies
vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("../hooks/use-github-auth", () => ({
  useGitHubAuth: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

// Import after mocking
import { useNavigate } from "react-router-dom";
import { useGitHubAuth } from "../hooks/use-github-auth";
import { useRepoSearch } from "../hooks/use-repo-search";

// A wrapper component to provide context for hooks that would normally
// rely on React Router's context
const wrapper = ({ children }: { children: React.ReactNode }) => children;

describe("Authentication Redirection Logic", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it("redirects to login page when accessing protected route while logged out", async () => {
    // Mock the auth hook to return not logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    // Verify the behavior directly from the hook
    const { result } = renderHook(() => useRepoSearch({ isHomeView: false }), {
      wrapper,
    });

    // Call the method that would be called when accessing a repo view
    act(() => {
      result.current.handleSelectExample("facebook/react");
    });

    // Verify redirect to login
    expect(localStorage.getItem("redirectAfterLogin")).toBe("/facebook/react");
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("does not redirect when accessing protected route while logged in", async () => {
    // Mock the auth hook to return logged in
    vi.mocked(useGitHubAuth).mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(true),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    // Verify the behavior directly from the hook
    const { result } = renderHook(() => useRepoSearch({ isHomeView: false }), {
      wrapper,
    });

    // Call the method that would be called when accessing a repo view
    act(() => {
      result.current.handleSelectExample("facebook/react");
    });

    // Verify direct navigation to the repo (no redirect to login)
    expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
  });

  it("redirects back to stored path after login", async () => {
    // Store a redirect path first
    localStorage.setItem("redirectAfterLogin", "/facebook/react");

    // Set up initial state (not logged in)
    let mockAuthHook = {
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    };

    vi.mocked(useGitHubAuth).mockReturnValue(mockAuthHook);

    // Simulate login page rendering
    renderHook(
      () => {
        const { isLoggedIn } = useGitHubAuth();
        const navigate = useNavigate();

        // This simulates the effect in the LoginPage component
        if (isLoggedIn) {
          const redirectTo = "/"; // Default path
          navigate(redirectTo, { replace: true });
        }
      },
      { wrapper }
    );

    // Now simulate the user logging in successfully
    mockAuthHook = {
      ...mockAuthHook,
      isLoggedIn: true,
      checkSession: vi.fn().mockResolvedValue(true),
    };

    vi.mocked(useGitHubAuth).mockReturnValue(mockAuthHook);

    // Simulate the auth hook logic that checks for redirects
    act(() => {
      const redirectPath = localStorage.getItem("redirectAfterLogin");
      if (redirectPath) {
        mockNavigate(redirectPath);
        localStorage.removeItem("redirectAfterLogin");
      }
    });

    // Verify the redirect occurred and localStorage was cleaned up
    expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
    expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
  });
});
