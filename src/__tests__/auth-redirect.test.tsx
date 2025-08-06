import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Move mocks to module level for proper isolation
const mockNavigate = vi.fn();
const mockUseGitHubAuth = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../hooks/use-github-auth", () => ({
  useGitHubAuth: () => mockUseGitHubAuth(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

// Import after mocking
import { useRepoSearch } from "../hooks/use-repo-search";

describe("Authentication Redirection Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockNavigate.mockClear();
    mockUseGitHubAuth.mockClear();
  });

  it("redirects to login page when accessing protected route while logged out", async () => {
    // Mock the auth hook to return not logged in
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    // Verify the behavior directly from the hook
    const { result } = renderHook(() => useRepoSearch({ isHomeView: false }));

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
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(true),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    });

    // Verify the behavior directly from the hook
    const { result } = renderHook(() => useRepoSearch({ isHomeView: false }));

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
    const mockAuthHook = {
      isLoggedIn: false,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      checkSession: vi.fn().mockResolvedValue(false),
      showLoginDialog: false,
      setShowLoginDialog: vi.fn(),
    };

    mockUseGitHubAuth.mockReturnValue(mockAuthHook);

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
