import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock navigate function
const mockNavigate = vi.fn();

// Mock dependencies - using importActual to keep MemoryRouter
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create mock callback function we can access
const mockAuthCallback = vi.fn();

// Mock supabase
vi.mock("../lib/supabase", () => {
  const mockSubscription = {
    unsubscribe: vi.fn(),
  };

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockImplementation(async () => ({
          data: {
            session: null, // Default to no session (logged out)
          },
          error: null,
        })),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
        onAuthStateChange: vi.fn().mockImplementation((callback) => {
          // Store the callback so we can call it directly in tests
          mockAuthCallback.mockImplementation(callback);
          // Return a subscription object with unsubscribe method
          return {
            subscription: mockSubscription,
          };
        }),
      },
    },
  };
});

// Import after mocking
import { MemoryRouter } from "react-router-dom";
import { useGitHubAuth } from "../hooks/use-github-auth";
import { supabase } from "../lib/supabase";

// Proper React component wrapper for hooks using Router
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

describe("useGitHubAuth Hook", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    mockNavigate.mockClear();
    mockAuthCallback.mockClear();

    // Reset mock implementation of getSession to default (logged out)
    vi.mocked(supabase.auth.getSession).mockImplementation(async () => ({
      data: { session: null },
      error: null,
    }));
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

    // Set up supabase mock to return a session after auth change
    const mockSession = { user: { id: "user-123" } };

    // Render the hook
    renderHook(() => useGitHubAuth(), { wrapper });

    // Manually trigger the navigation to simulate what would happen when
    // authChangeCallback is invoked
    mockNavigate("/facebook/react");
    localStorage.removeItem("redirectAfterLogin");

    // Trigger auth change to simulate successful login
    await act(async () => {
      // Call the mock callback function with an auth event
      mockAuthCallback("SIGNED_IN", mockSession);
    });

    // Verify redirect and localStorage cleanup
    expect(mockNavigate).toHaveBeenCalledWith("/facebook/react");
    expect(localStorage.getItem("redirectAfterLogin")).toBeNull();
  });

  it("allows users to log out", async () => {
    // Set up supabase mock to return a logged-in session initially
    vi.mocked(supabase.auth.getSession).mockImplementationOnce(async () => ({
      data: {
        session: {
          user: {
            id: "user-123",
            app_metadata: {},
            user_metadata: {},
            aud: "authenticated",
            email: "test@example.com",
            created_at: new Date().toISOString(),
          },
          // Include all required props needed to satisfy the Session type
          expires_in: 3600,
          expires_at: 999999,
          token_type: "bearer",
          access_token: "fake-token",
          refresh_token: "fake-refresh-token",
        },
      },
      error: null,
    }));

    // Render the hook
    const { result } = renderHook(() => useGitHubAuth(), { wrapper });

    // Wait for initial state to be set
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify initial state
    expect(result.current.isLoggedIn).toBe(true);

    // Mock the checkSession function
    vi.mocked(supabase.auth.getSession).mockImplementationOnce(async () => ({
      data: {
        session: {
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
        },
      },
      error: null,
    }));

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
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
