import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect } from "@storybook/test";
import { AuthButton } from "./auth-button";
import { designTokens } from "../../../../.storybook/design-tokens";
import React from "react";

// Mock user data for different scenarios
const mockUsers = {
  standard: {
    id: "123",
    email: "john.doe@example.com",
    user_metadata: {
      full_name: "John Doe",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    },
  },
  longName: {
    id: "456",
    email: "alexander.maximilian.smithson@corporate-enterprise.com",
    user_metadata: {
      full_name: "Alexander Maximilian Smithson III",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
    },
  },
  noAvatar: {
    id: "789",
    email: "jane.smith@example.com",
    user_metadata: {
      full_name: "Jane Smith",
      avatar_url: null,
    },
  },
  noMetadata: {
    id: "101",
    email: "user@example.com",
    user_metadata: {},
  },
  githubUser: {
    id: "202",
    email: "developer@github.com",
    user_metadata: {
      full_name: "GitHub Developer",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
      preferred_username: "octocat",
      provider: "github",
    },
  },
};

const meta = {
  title: "Features/Auth/AuthButton",
  component: AuthButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Authentication button that manages login/logout states, displays user information, and provides a dropdown menu with user actions. Integrates with Supabase auth and supports GitHub OAuth.",
      },
    },
    test: {
      disableSnapshots: true,
      skip: false,
    },
  },
  argTypes: {
    variant: {
      control: { type: "radio" },
      options: ["default", "compact", "expanded"],
      description: "Visual variant of the auth button",
      defaultValue: "default",
    },
    showDropdown: {
      control: "boolean",
      description: "Whether to show dropdown menu on click",
      defaultValue: true,
    },
    size: {
      control: { type: "radio" },
      options: ["sm", "md", "lg"],
      description: "Size of the auth button",
      defaultValue: "md",
    },
  },
  tags: ["autodocs", "auth", "authentication"],
  decorators: [
    (Story) => (
      <div className="p-8 min-h-[400px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AuthButton />,
  parameters: {
    docs: {
      description: {
        story: "Default auth button showing login state.",
      },
    },
  },
};

export const LoggedOut: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <AuthButton />
        <span className="text-sm text-gray-600">Standard login button</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
          Sign in with GitHub
        </button>
        <span className="text-sm text-gray-600">GitHub OAuth variant</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows various login button states when user is not authenticated.",
      },
    },
  },
};

export const LoggedInWithAvatar: Story = {
  render: () => {
    // Simulating logged-in state with avatar
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
          <img
            src={mockUsers.standard.user_metadata.avatar_url}
            alt={mockUsers.standard.user_metadata.full_name}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium">
            {mockUsers.standard.user_metadata.full_name}
          </span>
          <svg
            className="w-4 h-4 ml-1 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows authenticated state with user avatar and name.",
      },
    },
  },
};

export const LoggedInNoAvatar: Story = {
  render: () => {
    // Simulating logged-in state without avatar
    return (
      <div className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
          JS
        </div>
        <span className="text-sm font-medium">Jane Smith</span>
        <svg
          className="w-4 h-4 ml-1 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows authenticated state with initials when avatar is not available.",
      },
    },
  },
};

export const DropdownMenu: Story = {
  render: () => {
    const [isOpen, setIsOpen] = React.useState(true);

    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50"
          aria-label="User menu"
        >
          <img
            src={mockUsers.githubUser.user_metadata.avatar_url}
            alt={mockUsers.githubUser.user_metadata.full_name}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium">
            {mockUsers.githubUser.user_metadata.full_name}
          </span>
          <svg
            className={`w-4 h-4 ml-1 text-gray-500 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-medium text-gray-900">
                {mockUsers.githubUser.user_metadata.full_name}
              </p>
              <p className="text-xs text-gray-500">
                @{mockUsers.githubUser.user_metadata.preferred_username}
              </p>
              <p className="text-xs text-gray-500">{mockUsers.githubUser.email}</p>
            </div>
            
            <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Profile
              </span>
            </a>
            
            <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Settings
              </span>
            </a>
            
            <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Help & Support
              </span>
            </a>
            
            <div className="border-t border-gray-200 mt-1">
              <button className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test dropdown toggle
    const button = canvas.getByRole("button", { name: /user menu/i });
    await userEvent.click(button);
    
    // Verify dropdown items are visible
    await expect(canvas.getByText("Profile")).toBeInTheDocument();
    await expect(canvas.getByText("Settings")).toBeInTheDocument();
    await expect(canvas.getByText("Sign Out")).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: "Shows the dropdown menu with user information and actions.",
      },
    },
  },
};

export const LoadingState: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
      <p className="text-sm text-gray-500">Checking authentication...</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows loading skeleton while checking authentication status.",
      },
    },
  },
};

export const ErrorState: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
        <svg
          className="w-5 h-5 text-red-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-800">Authentication Error</p>
          <p className="text-xs text-red-600">Unable to verify session. Please try again.</p>
        </div>
      </div>
      <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
        Retry Login
      </button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows error state when authentication fails.",
      },
    },
  },
};

export const CompactVariant: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button className="p-1.5 border rounded-md hover:bg-gray-50" aria-label="Sign in">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>
        <span className="text-sm text-gray-600">Compact login (icon only)</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="p-1.5 border rounded-md hover:bg-gray-50" aria-label="User menu">
          <img
            src={mockUsers.standard.user_metadata.avatar_url}
            alt="User"
            className="w-5 h-5 rounded-full"
          />
        </button>
        <span className="text-sm text-gray-600">Compact logged-in (avatar only)</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Compact variant showing only icons/avatars without text.",
      },
    },
  },
};

export const SizeVariations: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
          Sign in
        </button>
        <span className="text-sm text-gray-600">Small size</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
          Sign in
        </button>
        <span className="text-sm text-gray-600">Medium size (default)</span>
      </div>
      
      <div className="flex items-center gap-4">
        <button className="px-6 py-3 text-lg bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          Sign in
        </button>
        <span className="text-sm text-gray-600">Large size</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Different size variations of the auth button.",
      },
    },
  },
};

export const MobileView: Story = {
  render: () => (
    <div className="w-full max-w-[375px] mx-auto space-y-4">
      <div className="p-4 bg-white border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Mobile App</h1>
          <button className="p-2 touch-manipulation" aria-label="User menu">
            <img
              src={mockUsers.standard.user_metadata.avatar_url}
              alt="User"
              className="w-8 h-8 rounded-full"
            />
          </button>
        </div>
      </div>
      
      <div className="px-4">
        <button className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-manipulation">
          Sign in with GitHub
        </button>
      </div>
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    docs: {
      description: {
        story: "Mobile-optimized auth button with appropriate touch targets.",
      },
    },
  },
};

export const DarkMode: Story = {
  render: () => (
    <div className="dark bg-gray-900 p-6 rounded-lg">
      <div className="space-y-4">
        <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
          Sign in with GitHub
        </button>
        
        <div className="flex items-center gap-2 p-2 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 cursor-pointer">
          <img
            src={mockUsers.standard.user_metadata.avatar_url}
            alt={mockUsers.standard.user_metadata.full_name}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-sm font-medium text-gray-100">
            {mockUsers.standard.user_metadata.full_name}
          </span>
          <svg
            className="w-4 h-4 ml-1 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    </div>
  ),
  parameters: {
    backgrounds: { default: "dark" },
    docs: {
      description: {
        story: "Auth button styled for dark mode.",
      },
    },
  },
};

export const LongUserName: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer max-w-xs">
        <img
          src={mockUsers.longName.user_metadata.avatar_url}
          alt={mockUsers.longName.user_metadata.full_name}
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
        <span className="text-sm font-medium truncate">
          {mockUsers.longName.user_metadata.full_name}
        </span>
        <svg
          className="w-4 h-4 ml-1 text-gray-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      <p className="text-xs text-gray-500">Handles long names with truncation</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows how long user names are handled with text truncation.",
      },
    },
  },
};

export const SessionExpired: Story = {
  render: () => (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-yellow-600 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-yellow-800">Session Expired</h3>
          <p className="text-sm text-yellow-700 mt-1">
            Your session has expired. Please sign in again to continue.
          </p>
          <button className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors text-sm">
            Sign in Again
          </button>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows the session expired state requiring re-authentication.",
      },
    },
  },
};

export const MultipleProviders: Story = {
  render: () => (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Choose your sign-in method:</h3>
      
      <button className="w-full px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        Sign in with GitHub
      </button>
      
      <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.545,10.239v3.821h5.445c-0.219,1.359-1.01,2.535-2.137,3.292l3.479,2.695c2.021-1.87,3.189-4.615,3.189-7.875c0-0.758-0.067-1.49-0.193-2.19H12.545V10.239z"/>
          <path d="M5.705,13.895c-0.258-0.758-0.403-1.57-0.403-2.395s0.145-1.637,0.403-2.395V5.707H1.995C0.726,8.199,0,10.999,0,11.995s0.726,3.796,1.995,6.288L5.705,13.895z"/>
        </svg>
        Sign in with Google
      </button>
      
      <button className="w-full px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        Sign in with Email
      </button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows multiple authentication provider options.",
      },
    },
  },
};

export const AccessibilityFocus: Story = {
  render: () => (
    <div className="space-y-4">
      <button 
        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all"
        aria-label="Sign in to your account"
      >
        Sign in
      </button>
      
      <div 
        className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
        tabIndex={0}
        role="button"
        aria-label="Open user menu for John Doe"
        aria-expanded="false"
        aria-haspopup="true"
      >
        <img
          src={mockUsers.standard.user_metadata.avatar_url}
          alt=""
          className="w-8 h-8 rounded-full"
        />
        <span className="text-sm font-medium">
          {mockUsers.standard.user_metadata.full_name}
        </span>
        <svg
          className="w-4 h-4 ml-1 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
      
      <p className="text-xs text-gray-500">Tab through to see focus states</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Demonstrates proper keyboard focus states and ARIA attributes for accessibility.",
      },
    },
  },
};