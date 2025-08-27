import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Home from './home';

const meta = {
  title: 'Pages/Home',
  component: Home,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The main homepage component with different states based on user authentication and workspace presence.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <HelmetProvider>
        <BrowserRouter>
          <Story />
        </BrowserRouter>
      </HelmetProvider>
    ),
  ],
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoggedOut: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing only search box for logged out users (no workspace card).',
      },
    },
  },
};

export const LoggedInNoWorkspace: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing only search box for authenticated user without workspace.',
      },
    },
  },
};

export const LoggedInWithWorkspace: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing workspace preview card for authenticated user with workspace.',
      },
    },
  },
};

export const WorkspaceLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing loading state while workspace data is being fetched.',
      },
    },
  },
};

export const WorkspaceError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing error state when workspace data fails to load.',
      },
    },
  },
};

export const AuthLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing loading state while checking authentication status.',
      },
    },
  },
};

export const LoggedInWithWorkspaceMobile: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Mobile view of homepage showing workspace preview card for authenticated user with workspace.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const LoggedOutMobile: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Mobile view of homepage showing only search box for logged out users (no workspace card).',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const LoggedInNoWorkspaceMobile: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Mobile view of homepage showing only search box for authenticated user without workspace.',
      },
    },
    viewport: {
      defaultViewport: 'mobile2',
    },
  },
};
