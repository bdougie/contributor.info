import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import LoginPage from "./login-page";
import { MemoryRouter } from "react-router-dom";

// Mock the GitHub auth hook
const mockUseGitHubAuth = fn();

// Mock react-router-dom hooks
const mockNavigate = fn();

// Mock SocialMetaTags to avoid issues in Storybook
// TODO: Mock @/components/common/layout using Storybook's approach
// Original fnmock replaced - needs manual review;

// Mock window.location for URL parameter tests
const mockLocation = {
  origin: 'https://contributor.info',
  search: '',
};

Object.defineProperty(global, 'window', {
  value: {
    location: mockLocation,
  },
  writable: true,
});

const meta = {
  title: "Features/Auth/LoginPage",
  component: LoginPage,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A full-page login interface with GitHub authentication, redirect handling, and security validation to prevent open redirect attacks."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/login"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof LoginPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    // Mock unauthenticated state
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockResolvedValue(undefined),
      isLoggedIn: false,
      user: null,
      logout: fn(),
    });

    mockLocation.search = '';

    return <LoginPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Default login page appearance for unauthenticated users."
      }
    }
  }
};

export const WithRedirectParameter: Story = {
  render: () => {
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockResolvedValue(undefined),
      isLoggedIn: false,
      user: null,
      logout: fn(),
    });

    // Mock URL with redirect parameter
    mockLocation.search = '?redirectTo=/admin/dashboard';

    return (
      <div>
        <LoginPage />
        <div className="fixed bottom-4 left-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="text-blue-800">
            💡 Redirect parameter: <code>/admin/dashboard</code>
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Login page with redirect parameter that will redirect user after successful login."
      }
    }
  }
};

export const WithError: Story = {
  render: () => {
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockRejectedValue(new Error("Authentication failed. Please try again.")),
      isLoggedIn: false,
      user: null,
      logout: fn(),
    });

    mockLocation.search = '';

    return <LoginPage />;
  },
  parameters: {
    docs: {
      description: {
        story: "Login page showing error state when authentication fails."
      }
    }
  }
};

export const AlreadyLoggedIn: Story = {
  render: () => {
    // Mock authenticated state
    mockUseGitHubAuth.mockReturnValue({
      login: fn(),
      isLoggedIn: true,
      user: {
        login: "test-user",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
      },
      logout: fn(),
    });

    mockLocation.search = '';
    mockNavigate.mockClear();

    return (
      <div>
        <LoginPage />
        <div className="fixed bottom-4 left-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
          <p className="text-green-800">
            ✅ User is already logged in - would redirect to home page
            <br />
            Navigate called: {mockNavigate.mock.calls.length > 0 ? "Yes" : "No"}
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Login page behavior when user is already authenticated (should redirect)."
      }
    }
  }
};

export const LoadingState: Story = {
  render: () => {
    // Mock login function that takes time
    const mockLogin = fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 5000))
    );

    mockUseGitHubAuth.mockReturnValue({
      login: mockLogin,
      isLoggedIn: false,
      user: null,
      logout: fn(),
    });

    mockLocation.search = '';

    return (
      <div>
        <LoginPage />
        <div className="fixed bottom-4 left-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
          <p className="text-yellow-800">
            ⏳ Click login button to simulate loading state
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Click the login button to see loading state during authentication."
      }
    }
  }
};

export const SecurityTest: Story = {
  render: () => {
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockResolvedValue(undefined),
      isLoggedIn: false,
      user: null,
      logout: fn(),
    });

    // Mock malicious redirect URL
    mockLocation.search = '?redirectTo=https://malicious-site.com/steal-data';

    return (
      <div>
        <LoginPage />
        <div className="fixed bottom-4 left-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <p className="text-red-800">
            🔒 Malicious redirect URL should be rejected
            <br />
            Input: <code>https://malicious-site.com/steal-data</code>
            <br />
            Should redirect to: <code>/</code> (safe default)
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Tests security validation - malicious external redirect URLs should be rejected."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => {
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockResolvedValue(undefined),
      isLoggedIn: false,
      user: null,
      logout: fn(),
    });

    return <LoginPage />;
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Login page appearance on mobile devices."
      }
    }
  }
};