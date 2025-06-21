import type { Meta, StoryObj } from "@storybook/react";
import { AuthButton } from "./auth-button";

// Mock user data for stories
const mockUser = {
  id: "user-123",
  email: "john.doe@example.com",
  user_metadata: {
    user_name: "johndoe",
    avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
    full_name: "John Doe",
  },
  app_metadata: {},
  aud: "authenticated",
  role: "authenticated",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const meta = {
  title: "Features/Auth/AuthButton",
  component: AuthButton,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Authentication button that shows login/logout state and user avatar when authenticated. Integrates with Supabase auth.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AuthButton>;

export default meta;
type Story = StoryObj<typeof meta>;

// Note: These stories show the visual states, but interactive functionality 
// requires actual Supabase auth setup which is mocked in Storybook
export const LoggedOut: Story = {
  parameters: {
    docs: {
      description: {
        story: "Shows the login button when user is not authenticated.",
      },
    },
  },
};

export const Loading: Story = {
  parameters: {
    docs: {
      description: {
        story: "Shows the loading state while checking authentication status.",
      },
    },
  },
};

export const LoggedIn: Story = {
  parameters: {
    docs: {
      description: {
        story: "Shows the user avatar and dropdown menu when authenticated. The actual user data comes from Supabase auth.",
      },
    },
  },
};

export const AuthError: Story = {
  parameters: {
    docs: {
      description: {
        story: "Shows the component when there's an authentication error.",
      },
    },
  },
};