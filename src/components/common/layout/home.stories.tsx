import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { BrowserRouter } from 'react-router-dom';
import Home from './home';
import type { WorkspacePreviewData } from '@/components/features/workspace/WorkspacePreviewCard';
import * as useAuthMock from '../../../../.storybook/mocks/use-auth';
import * as useUserWorkspacesMock from '../../../../.storybook/mocks/use-user-workspaces';

const mockWorkspaceData: WorkspacePreviewData = {
  id: '811b5a77-ba90-4057-bc5c-18bc323d0482',
  name: "bdougie's Projects",
  slug: 'bdougie-projects',
  description: 'A curated collection of open source projects I contribute to and maintain.',
  owner: {
    id: 'f5b6f433-97f8-4c82-81c6-59bd67f7e98d',
    avatar_url: 'https://github.com/bdougie.png',
    display_name: 'Brian Douglas',
  },
  repository_count: 3,
  member_count: 1,
  repositories: [
    {
      id: '98b0e461-ea5c-4916-99c0-402fbff5950a',
      full_name: 'continuedev/continue',
      name: 'continue',
      owner: 'continuedev',
      description: 'AI-powered coding assistant',
      language: 'TypeScript',
      activity_score: 42,
      last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      avatar_url: 'https://github.com/continuedev.png',
      html_url: 'https://github.com/continuedev/continue',
    },
    {
      id: '4789fa82-3db4-4931-a945-f48f7bd67111',
      full_name: 'vitejs/vite',
      name: 'vite',
      owner: 'vitejs',
      description: 'Next generation frontend build tool',
      language: 'TypeScript',
      activity_score: 28,
      last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      avatar_url: 'https://github.com/vitejs.png',
      html_url: 'https://github.com/vitejs/vite',
    },
    {
      id: 'e68d00d5-2e47-4f41-8cd9-e5f8077bdd86',
      full_name: 'vercel/ai',
      name: 'ai',
      owner: 'vercel',
      description: 'AI SDK for building AI-powered applications',
      language: 'TypeScript',
      activity_score: 15,
      last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
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
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock the hooks for different states
export const LoggedOut: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing only search box for logged out users (no workspace card).',
      },
    },
  },
  render: () => {
    // Mock logged out state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock no workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: null,
      hasWorkspace: false,
      loading: false,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
  },
};

export const LoggedInNoWorkspace: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing only search box for authenticated user without workspace (no workspace card).',
      },
    },
  },
  render: () => {
    // Mock logged in state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock no workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: null,
      hasWorkspace: false,
      loading: false,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
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
  render: () => {
    // Mock logged in state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: mockWorkspaceData,
      hasWorkspace: true,
      loading: false,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
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
  render: () => {
    // Mock logged in state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock loading workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: null,
      hasWorkspace: false,
      loading: true,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
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
  render: () => {
    // Mock logged in state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock error workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: null,
      hasWorkspace: false,
      loading: false,
      error: new Error('Failed to load workspace data'),
      refetch: fn(),
    });
    
    return <Home />;
  },
};

export const AuthLoading: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Homepage showing loading state while authentication status is being checked.',
      },
    },
  },
  render: () => {
    // Mock auth loading state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: false,
      loading: true,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock default workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: null,
      hasWorkspace: false,
      loading: false,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
  },
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
  render: () => {
    // Mock logged in state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: true,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: mockWorkspaceData,
      hasWorkspace: true,
      loading: false,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
  },
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
    mockData: [
      {
        url: /.*\/auth\/getUser/,
        method: 'GET',
        status: 401,
        response: { error: 'Not authenticated' },
      },
    ],
  },
  render: () => {
    // Mock logged out state
    useAuthMock.useAuth.mockReturnValue({
      isLoggedIn: false,
      loading: false,
      login: fn(),
      logout: fn(),
      checkSession: fn(),
      showLoginDialog: false,
      setShowLoginDialog: fn(),
    });
    
    // Mock no workspace state  
    useUserWorkspacesMock.usePrimaryWorkspace.mockReturnValue({
      workspace: null,
      hasWorkspace: false,
      loading: false,
      error: null,
      refetch: fn(),
    });
    
    return <Home />;
  },
};