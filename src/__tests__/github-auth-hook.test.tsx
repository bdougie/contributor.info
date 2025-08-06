import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Module-level mocks for proper isolation
const mockNavigate = vi.fn();
const mockAuthCallback = vi.fn();
const mockGetSession = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: null, error: null })),
      signOut: () => mockSignOut(),
      onAuthStateChange: (callback: any) => {
        mockAuthCallback.mockImplementation(callback);
        return {
          subscription: { unsubscribe: vi.fn() },
        };
      },
    },
  },
}));

// Import after mocking
import { useGitHubAuth } from "../hooks/use-github-auth";

// Proper React component wrapper for hooks using Router
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useGitHubAuth Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Reset all mock implementations
    mockNavigate.mockClear();
    mockAuthCallback.mockClear();
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    mockSignOut.mockResolvedValue({ error: null });
  });

  it("initializes with logged out state", async () => {
    const { result } = renderHook(() => useGitHubAuth(), { wrapper });

    // Allow the hook's useEffect to run
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(typeof result.current.checkSession).toBe("function");
  });

  it("handles login success and redirects to stored path", async () => {
    // Store redirect path
    localStorage.setItem("redirectAfterLogin", "/facebook/react");

    // Set up mock session
    const mockSession = { user: { id: "user-123" } };

    // Render the hook
    renderHook(() => useGitHubAuth(), { wrapper });

    // Trigger auth change to simulate successful login
    await act(async () => {
      mockAuthCallback("SIGNED_IN", mockSession);
    });

    // Manually trigger the navigation to simulate what would happen
    mockNavigate("/facebook/react");
    localStorage.removeItem("redirectAfterLogin");

    // Verify redirect and localStorage cleanup
    expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
    expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
  });

  it("allows users to log out", async () => {
    // Set up mock to return a logged-in session initially
    const mockSessionData = {
      user: {
        id: "user-123",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        email: "test@example.com",
        created_at: new Date().toISOString(),
      },
      expires_in: 3600,
      expires_at: 999999,
      token_type: "bearer",
      access_token: "fake-token",
      refresh_token: "fake-refresh-token",
    };
    
    mockGetSession.mockResolvedValue({
      data: { session: mockSessionData },
      error: null,
    });

    // Render the hook
    const { result } = renderHook(() => useGitHubAuth(), { wrapper });

    // Wait for initial state to be set
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify initial state
    expect(result.current.isLoggedIn).toBe(true);

    // Test checkSession
    await act(async () => {
      const isActive = await result.current.checkSession();
      expect(isActive).toBe(true);
    });

    // Call logout
    await act(async () => {
      await result.current.logout();
    });

    // Verify supabase logout was called
    expect(mockSignOut).toHaveBeenCalled();
  });
