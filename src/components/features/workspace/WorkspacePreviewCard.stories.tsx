import type { Meta, StoryObj } from '@storybook/react';
import { WorkspacePreviewCard } from './WorkspacePreviewCard';
import type { WorkspacePreviewData } from './WorkspacePreviewCard';

const meta = {
  title: 'Features/Workspace/WorkspacePreviewCard',
  component: WorkspacePreviewCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A preview card component for displaying workspace information on the homepage. Shows workspace details and top repositories.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    loading: {
      control: 'boolean',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof WorkspacePreviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

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
      last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
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
      last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
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
      last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      avatar_url: 'https://github.com/vercel.png',
      html_url: 'https://github.com/vercel/ai',
    },
  ],
  created_at: '2024-01-15T10:00:00Z',
};

export const Default: Story = {
  args: {
    workspace: mockWorkspaceData,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    workspace: mockWorkspaceData,
    loading: true,
  },
};

export const SingleRepository: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      repository_count: 1,
      repositories: [mockWorkspaceData.repositories[0]],
    },
    loading: false,
  },
};

export const NoRepositories: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      repository_count: 0,
      repositories: [],
    },
    loading: false,
  },
};

export const NoDescription: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      description: undefined,
    },
    loading: false,
  },
};

export const LongWorkspaceName: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      name: 'My Really Really Long Workspace Name That Should Truncate',
      description: 'This workspace has a very long name to test how the component handles text overflow and truncation behavior.',
    },
    loading: false,
  },
};

export const ManyRepositories: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      repository_count: 25,
      repositories: [
        ...mockWorkspaceData.repositories,
        {
          id: 'repo-4',
          full_name: 'facebook/react',
          name: 'react',
          owner: 'facebook',
          description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
          language: 'JavaScript',
          activity_score: 87,
          last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
          avatar_url: 'https://github.com/facebook.png',
          html_url: 'https://github.com/facebook/react',
        },
        {
          id: 'repo-5',
          full_name: 'microsoft/typescript',
          name: 'typescript',
          owner: 'microsoft',
          description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.',
          language: 'TypeScript',
          activity_score: 56,
          last_activity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
          avatar_url: 'https://github.com/microsoft.png',
          html_url: 'https://github.com/microsoft/typescript',
        },
      ],
    },
    loading: false,
  },
};

export const SmallTeam: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      member_count: 1,
      repository_count: 3,
    },
    loading: false,
  },
};

export const LargeTeam: Story = {
  args: {
    workspace: {
      ...mockWorkspaceData,
      member_count: 47,
      repository_count: 156,
    },
    loading: false,
  },
};

// Responsive stories
export const Mobile: Story = {
  args: {
    workspace: mockWorkspaceData,
    loading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const Tablet: Story = {
  args: {
    workspace: mockWorkspaceData,
    loading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};