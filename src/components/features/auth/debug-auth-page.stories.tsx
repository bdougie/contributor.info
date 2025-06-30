import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import DebugAuthPage from "./debug-auth-page";
import { MemoryRouter } from "react-router-dom";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getSession: fn(),
    signInWithOAuth: fn(),
    signOut: fn(),
    refreshSession: fn(),
    onAuthStateChange: fn(() => ({
      data: { subscription: { unsubscribe: fn() } }
    }))
  }
};

// TODO: Mock @/lib/supabase using Storybook's approach
// Original fnmock replaced - needs manual review;

// Mock the GitHub auth hook
const mockUseGitHubAuth = fn();
// TODO: Mock @/hooks/use-github-auth using Storybook's approach
// Original fnmock replaced - needs manual review;

// Mock react-router-dom hooks
const mockNavigate = fn();
fnmock("react-router-dom", async () => {
  const actual = await fnimportActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock environment variables
const mockEnv = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
};

Object.defineProperty(import.meta, 'env', {
  value: mockEnv,
  writable: true,
});

const meta = {
  title: "Features/Auth/DebugAuthPage",
  component: DebugAuthPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A comprehensive debugging page for authentication flows with session management, error logging, and environment information. Used for testing and troubleshooting authentication issues."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/debug-auth"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof DebugAuthPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotAuthenticated: Story = {
  render: () => {
    // Mock unauthenticated state
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockResolvedValue(false),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Debug page showing unauthenticated state with sign-in options."
      }
    }
  }
};

export const Authenticated: Story = {
  render: () => {
    const mockUser = {
      id: "12345",
      email: "test@example.com",
      app_metadata: {
        provider: "github"
      },
      created_at: "2024-01-15T10:30:00Z"
    };

    const mockSession = {
      user: mockUser,
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_at: Date.now() + 3600000,
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockResolvedValue(true),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Debug page showing authenticated state with user information and logout options."
      }
    }
  }
};

export const AuthenticationError: Story = {
  render: () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Failed to retrieve session" }
    });

    mockSupabase.auth.signInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: "OAuth authentication failed" }
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockRejectedValue(new Error("Hook check session failed")),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Debug page showing various authentication error states."
      }
    }
  }
};

export const SessionExpired: Story = {
  render: () => {
    const expiredSession = {
      user: {
        id: "12345",
        email: "test@example.com",
        app_metadata: { provider: "github" },
        created_at: "2024-01-15T10:30:00Z"
      },
      access_token: "expired-token",
      refresh_token: "expired-refresh-token",
      expires_at: Date.now() - 3600000, // Expired 1 hour ago
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: expiredSession },
      error: null
    });

    mockSupabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Refresh token expired" }
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockResolvedValue(false),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Debug page showing expired session state with refresh token errors."
      }
    }
  }
};

export const EnvironmentIssues: Story = {
  render: () => {
    // Mock missing environment variables
    Object.defineProperty(import.meta, 'env', {
      value: {
        VITE_SUPABASE_URL: undefined,
        VITE_SUPABASE_ANON_KEY: undefined,
      },
      writable: true,
    });

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockResolvedValue(false),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Debug page showing environment configuration issues (missing env vars)."
      }
    }
  }
};

export const WithDebugLogs: Story = {
  render: () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    // Simulate auth state changes
    let authCallback: ((event: string, session: any) => void) | null = null;
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      
      // Simulate some auth events after component mounts
      setTimeout(() => {
        if (authCallback) {
          authCallback("SIGNED_IN", {
            user: { id: "123", email: "test@example.com" }
          });
        }
      }, 1000);
      
      setTimeout(() => {
        if (authCallback) {
          authCallback("TOKEN_REFRESHED", {
            user: { id: "123", email: "test@example.com" }
          });
        }
      }, 2000);

      return {
        data: { subscription: { unsubscribe: fn() } }
      };
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockResolvedValue(true),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Debug page with simulated authentication events to show debug logging functionality."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });

    mockUseGitHubAuth.mockReturnValue({
      checkSession: fn().mockResolvedValue(false),
    });

    return <DebugAuthPage />;
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Debug page appearance on mobile devices."
      }
    }
  }
};