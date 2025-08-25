import type { Meta, StoryObj } from '@storybook/react';
import { CommandPalette } from './CommandPalette';
import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';

const meta = {
  title: 'Navigation/CommandPalette',
  component: CommandPalette,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A command palette for quick navigation between workspaces, repositories, and actions. Accessible via Cmd+K or Ctrl+K.',
      },
    },
  },
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="min-h-screen bg-background p-8">
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

// Mock data for stories
const mockWorkspaces = [
  {
    id: 'ws-1',
    name: 'Open Source Projects',
    description: 'My favorite open source projects',
    repositories: ['microsoft/vscode', 'facebook/react'],
    repository_count: 2,
    tier: 'pro',
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ws-2',
    name: 'AI/ML Tools',
    description: 'Machine learning and AI projects',
    repositories: ['ollama/ollama', 'langchain-ai/langchain'],
    repository_count: 2,
    tier: 'free',
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'ws-3',
    name: 'DevOps & Infrastructure',
    description: 'Infrastructure and deployment tools',
    repositories: ['kubernetes/kubernetes', 'docker/docker'],
    repository_count: 2,
    tier: 'enterprise',
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
];

const mockRepositories = [
  { owner: 'microsoft', name: 'vscode', full_name: 'microsoft/vscode', stars: 173000, language: 'TypeScript', description: 'Visual Studio Code' },
  { owner: 'facebook', name: 'react', full_name: 'facebook/react', stars: 227000, language: 'JavaScript', description: 'A declarative, efficient, and flexible JavaScript library' },
  { owner: 'vercel', name: 'next.js', full_name: 'vercel/next.js', stars: 127000, language: 'TypeScript', description: 'The React Framework' },
  { owner: 'ollama', name: 'ollama', full_name: 'ollama/ollama', stars: 149000, language: 'Go', description: 'Get up and running with Llama 3.3, Mistral, Gemini 2.0' },
  { owner: 'kubernetes', name: 'kubernetes', full_name: 'kubernetes/kubernetes', stars: 115000, language: 'Go', description: 'Production-Grade Container Scheduling and Management' },
];

const mockRecentItems = [
  { type: 'repository', id: 'microsoft/vscode', name: 'microsoft/vscode', icon: '📦' },
  { type: 'workspace', id: 'ws-1', name: 'Open Source Projects', icon: '🏢' },
  { type: 'action', id: 'create-workspace', name: 'Create New Workspace', icon: '➕' },
];

// Component wrapper for controlled story
function CommandPaletteWrapper() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <div className="text-center">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open Command Palette
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </div>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        workspaces={mockWorkspaces}
        repositories={mockRepositories}
        recentItems={mockRecentItems}
      />
    </>
  );
}

export const Default: Story = {
  render: () => <CommandPaletteWrapper />,
};

export const EmptyState: Story = {
  args: {
    open: true,
    workspaces: [],
    repositories: [],
    recentItems: [],
  },
};

export const WithSearchQuery: Story = {
  args: {
    open: true,
    workspaces: mockWorkspaces,
    repositories: mockRepositories,
    recentItems: mockRecentItems,
    defaultSearchQuery: 'react',
  },
};

export const WorkspacesOnly: Story = {
  args: {
    open: true,
    workspaces: mockWorkspaces,
    repositories: [],
    recentItems: mockRecentItems.filter(item => item.type === 'workspace'),
  },
};

export const RepositoriesOnly: Story = {
  args: {
    open: true,
    workspaces: [],
    repositories: mockRepositories,
    recentItems: mockRecentItems.filter(item => item.type === 'repository'),
  },
};

export const WithKeyboardNavigation: Story = {
  render: () => <CommandPaletteWrapper />,
  parameters: {
    docs: {
      description: {
        story: 'Use arrow keys to navigate, Enter to select, and Escape to close. Try typing "workspace:" or "repo:" to filter by type.',
      },
    },
  },
};

export const MobileView: Story = {
  render: () => <CommandPaletteWrapper />,
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Command palette optimized for mobile devices with touch-friendly spacing.',
      },
    },
  },
};

export const DarkMode: Story = {
  render: () => <CommandPaletteWrapper />,
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="dark min-h-screen bg-background p-8">
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
};