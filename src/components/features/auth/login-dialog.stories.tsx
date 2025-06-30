import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { fn } from "@storybook/test";
import { vi } from "vitest";
import { LoginDialog } from "./login-dialog";

// Create mock functions
const mockLogin = fn();
const mockLogout = fn();
const mockCheckSession = fn();
const mockSetShowLoginDialog = fn();

// Mock the GitHub auth hook
const mockUseGitHubAuth = fn(() => ({
  login: mockLogin,
  isLoggedIn: false,
  loading: false,
  logout: mockLogout,
  checkSession: mockCheckSession,
  showLoginDialog: false,
  setShowLoginDialog: mockSetShowLoginDialog,
}));

vi.mock("@/hooks/use-github-auth", () => ({
  useGitHubAuth: mockUseGitHubAuth
}));

const meta = {
  title: "Features/Auth/LoginDialog",
  component: LoginDialog,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A modal dialog that prompts users to log in with GitHub. Includes login state management, error handling, and prevents closing when login is required."
      }
    }
  },
  tags: ["autodocs"],
  argTypes: {
    open: {
      control: "boolean",
      description: "Whether the dialog is open"
    },
    onOpenChange: {
      action: "onOpenChange",
      description: "Callback fired when dialog open state changes"
    }
  }
} satisfies Meta<typeof LoginDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  render: (args) => <LoginDialog {...args} />
};

export const Interactive: Story = {
  args: {
    open: false,
    onOpenChange: fn(),
  },
  render: () => {
    const InteractiveDialog = () => {
      const [open, setOpen] = useState(false);

      return (
        <div className="p-4">
          <button
            onClick={() => setOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Open Login Dialog
          </button>
          <LoginDialog open={open} onOpenChange={setOpen} />
        </div>
      );
    };

    return <InteractiveDialog />;
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive version where you can open and close the dialog using a button."
      }
    }
  }
};

export const LoggingInState: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  render: (args) => {
    // Mock the hook to return logging in state
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 5000))),
      isLoggedIn: false,
      loading: false,
      logout: mockLogout,
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });

    const LoggingInDialog = () => {
      const [isLoggingIn, setIsLoggingIn] = useState(false);

      const mockProps = {
        ...args,
        // We'll simulate the logging in state in the story
      };

      return (
        <div>
          <LoginDialog {...mockProps} />
          {!isLoggingIn && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLoggingIn(true)}
                className="text-sm text-blue-500 hover:underline"
              >
                Click login button in dialog to see loading state
              </button>
            </div>
          )}
        </div>
      );
    };

    return <LoggingInDialog />;
  },
  parameters: {
    docs: {
      description: {
        story: "Dialog showing the loading state when login is in progress."
      }
    }
  }
};

export const WithError: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  render: (args) => {
    // Mock the hook to simulate login error
    mockUseGitHubAuth.mockReturnValue({
      login: fn().mockRejectedValue(new Error("Authentication failed. Please try again.")),
      isLoggedIn: false,
      loading: false,
      logout: mockLogout,
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });

    return <LoginDialog {...args} />;
  },
  parameters: {
    docs: {
      description: {
        story: "Dialog showing error state when login fails."
      }
    }
  }
};

export const AlreadyLoggedIn: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  render: (args) => {
    // Mock the hook to return logged in state
    mockUseGitHubAuth.mockReturnValue({
      login: mockLogin,
      isLoggedIn: true,
      loading: false,
      logout: mockLogout,
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });

    return (
      <div>
        <LoginDialog {...args} />
        <div className="mt-4 text-center text-sm text-green-600">
          User is already logged in - dialog should be able to close
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Dialog behavior when user is already logged in (should allow closing)."
      }
    }
  }
};

export const MobileView: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Dialog appearance on mobile devices."
      }
    }
  },
  render: (args) => <LoginDialog {...args} />
};