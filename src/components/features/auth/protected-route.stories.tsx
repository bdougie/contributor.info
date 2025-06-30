import type { Meta, StoryObj } from "@storybook/react";
import { ProtectedRoute } from "./protected-route";
import { MemoryRouter } from "react-router-dom";

// Mock the GitHub auth hook
const mockUseGitHubAuth = vi.fn();
vi.mock("@/hooks/use-github-auth", () => ({
  useGitHubAuth: mockUseGitHubAuth,
}));

// Mock react-router-dom hooks
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: mockUseLocation,
  };
});

const SampleProtectedContent = () => (
  <div className="p-8 text-center">
    <h2 className="text-2xl font-bold mb-4">Protected Content</h2>
    <p className="text-muted-foreground mb-4">
      This content is only visible to authenticated users.
    </p>
    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
      <p className="text-green-800">✅ You are successfully authenticated!</p>
    </div>
  </div>
);

const meta = {
  title: "Features/Auth/ProtectedRoute",
  component: ProtectedRoute,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A route protection component that redirects unauthenticated users to login and shows loading states during authentication checks."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/protected"]}>
        <div className="w-[600px] h-[400px] border border-gray-200 rounded-lg">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof ProtectedRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AuthenticatedUser: Story = {
  render: () => {
    // Mock authenticated state
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      user: {
        login: "test-user",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
      },
    });

    mockUseLocation.mockReturnValue({
      pathname: "/protected",
      search: "",
    });

    return (
      <ProtectedRoute>
        <SampleProtectedContent />
      </ProtectedRoute>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the protected content when user is authenticated."
      }
    }
  }
};

export const LoadingState: Story = {
  render: () => {
    // Mock loading state
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: true,
      user: null,
    });

    mockUseLocation.mockReturnValue({
      pathname: "/protected",
      search: "",
    });

    return (
      <ProtectedRoute>
        <SampleProtectedContent />
      </ProtectedRoute>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows loading spinner while checking authentication status."
      }
    }
  }
};

export const UnauthenticatedUser: Story = {
  render: () => {
    // Mock unauthenticated state
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      user: null,
    });

    mockUseLocation.mockReturnValue({
      pathname: "/protected",
      search: "?tab=insights",
    });

    // Reset navigate mock
    mockNavigate.mockClear();

    return (
      <div>
        <ProtectedRoute>
          <SampleProtectedContent />
        </ProtectedRoute>
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800 text-sm">
            User is not authenticated. Component would redirect to /login.
            <br />
            Navigate function called: {mockNavigate.mock.calls.length > 0 ? "Yes" : "No"}
          </p>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows behavior when user is not authenticated (renders nothing and redirects)."
      }
    }
  }
};

export const WithComplexContent: Story = {
  render: () => {
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      user: {
        login: "test-user",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
      },
    });

    mockUseLocation.mockReturnValue({
      pathname: "/admin/dashboard",
      search: "",
    });

    const ComplexContent = () => (
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
          <p className="text-muted-foreground">
            Complex protected content with multiple sections
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">User Management</h3>
            <p className="text-blue-700 text-sm">Manage user accounts and permissions</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Analytics</h3>
            <p className="text-green-700 text-sm">View system analytics and reports</p>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Recent Activity</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• User login: alice@example.com</li>
            <li>• New repository added: facebook/react</li>
            <li>• System backup completed</li>
          </ul>
        </div>
      </div>
    );

    return (
      <ProtectedRoute>
        <ComplexContent />
      </ProtectedRoute>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Protected route with complex nested content to test layout and functionality."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => {
    mockUseGitHubAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      user: {
        login: "test-user",
        avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
      },
    });

    return (
      <ProtectedRoute>
        <SampleProtectedContent />
      </ProtectedRoute>
    );
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Protected route on mobile devices."
      }
    }
  }
};