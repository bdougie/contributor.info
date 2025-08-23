import type { Meta, StoryObj } from '@storybook/react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { fn } from '@storybook/test';
import Home from './home';
import { setMockAuthState } from '../../../../.storybook/mocks/use-auth';
import { setMockWorkspaceState } from '../../../../.storybook/mocks/use-user-workspaces';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';

// Mock workspace data
const mockWorkspaceData: WorkspacePreviewData = {
  id: 'workspace-1',
  name: "bdougie's Projects",
  slug: 'bdougie-projects',
  description: 'A curated collection of open source projects I contribute to and maintain.',
  owner: {
    id: 'bdougie',
    avatar_url: 'https://github.com/bdougie.png',
    display_name: 'Brian Douglas',
  },
  repository_count: 12,
  member_count: 3,
  repositories: [
    {
      id: 'repo-1',
      full_name: 'continuedev/continue',
      name: 'continue',
      owner: 'continuedev',
      description: 'The open-source autopilot for software development',
      language: 'TypeScript',
      activity_score: 42,
      last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      avatar_url: 'https://github.com/continuedev.png',
      html_url: 'https://github.com/continuedev/continue',
    },
    {
      id: 'repo-2',
      full_name: 'vitejs/vite',
      name: 'vite',
      owner: 'vitejs',
      description: 'Next generation frontend tooling. It\'s fast!',
      language: 'JavaScript',
      activity_score: 28,
      last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      avatar_url: 'https://github.com/vitejs.png',
      html_url: 'https://github.com/vitejs/vite',
    },
    {
      id: 'repo-3',
      full_name: 'vercel/ai',
      name: 'ai',
      owner: 'vercel',
      description: 'Build AI-powered applications with React, Svelte, Vue, and Solid',
      language: 'TypeScript',
      activity_score: 15,
      last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      avatar_url: 'https://github.com/vercel.png',
      html_url: 'https://github.com/vercel/ai',
    },
  ],
  created_at: '2024-01-15T10:00:00Z',
};

const meta = {
  title: 'Pages/Home',
  component: Home,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'The main homepage component with different states based on user authentication and workspace presence.',
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

// Stories for different states
export const LoggedOut: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing only search box for logged out users (no workspace card).',
      },
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for logged out user
      setMockAuthState({
        isLoggedIn: false,
        loading: false,
        user: null,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      return <Story />;
    },
  ],
};

export const LoggedInNoWorkspace: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing only search box for authenticated user without workspace.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for logged in user without workspace
      setMockAuthState({
        isLoggedIn: true,
        loading: false,
        user: { id: 'user-1', email: 'user@example.com' } as any,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      setMockWorkspaceState({
        workspace: null,
        hasWorkspace: false,
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const LoggedInWithWorkspace: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing workspace preview card for authenticated user with workspace.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for logged in user with workspace
      setMockAuthState({
        isLoggedIn: true,
        loading: false,
        user: { id: 'user-1', email: 'user@example.com' } as any,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      setMockWorkspaceState({
        workspace: mockWorkspaceData,
        hasWorkspace: true,
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const WorkspaceLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing loading state while workspace data is being fetched.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for workspace loading
      setMockAuthState({
        isLoggedIn: true,
        loading: false,
        user: { id: 'user-1', email: 'user@example.com' } as any,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      setMockWorkspaceState({
        workspace: null,
        hasWorkspace: false,
        loading: true,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const WorkspaceError: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing error state when workspace data fails to load.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for workspace error
      setMockAuthState({
        isLoggedIn: true,
        loading: false,
        user: { id: 'user-1', email: 'user@example.com' } as any,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      setMockWorkspaceState({
        workspace: null,
        hasWorkspace: false,
        loading: false,
        error: new Error('Failed to load workspace'),
      });
      return <Story />;
    },
  ],
};

export const AuthLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing loading state while checking authentication status.',
      },
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for auth loading
      setMockAuthState({
        isLoggedIn: false,
        loading: true,
        user: null,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      return <Story />;
    },
  ],
};

// Mobile responsive stories
export const LoggedInWithWorkspaceMobile: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile view of homepage showing workspace preview card for authenticated user with workspace.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for logged in user with workspace
      setMockAuthState({
        isLoggedIn: true,
        loading: false,
        user: { id: 'user-1', email: 'user@example.com' } as any,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      setMockWorkspaceState({
        workspace: mockWorkspaceData,
        hasWorkspace: true,
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};

export const LoggedOutMobile: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile view of homepage showing only search box for logged out users (no workspace card).',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for logged out user
      setMockAuthState({
        isLoggedIn: false,
        loading: false,
        user: null,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      return <Story />;
    },
  ],
};

export const LoggedInNoWorkspaceMobile: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Mobile view of homepage showing only search box for authenticated user without workspace.',
      },
    },
    viewport: {
      defaultViewport: 'mobile2',
    },
  },
  decorators: [
    (Story) => {
      // Set mock state for logged in user without workspace
      setMockAuthState({
        isLoggedIn: true,
        loading: false,
        user: { id: 'user-1', email: 'user@example.com' } as any,
        signInWithGitHub: fn(),
        signOut: fn(),
      });
      setMockWorkspaceState({
        workspace: null,
        hasWorkspace: false,
        loading: false,
        error: null,
      });
      return <Story />;
    },
  ],
};