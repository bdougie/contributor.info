import type { Meta, StoryObj } from '@storybook/react';
import { WorkspaceDashboard, WorkspaceDashboardSkeleton, type WorkspaceMetrics, type WorkspaceTrendData } from './WorkspaceDashboard';
import type { Repository } from './RepositoryList';
import type { ActivityDataPoint } from './ActivityChart';
import { toast } from 'sonner';

// Generate sample trend data
const generateTrendData = (days: number): WorkspaceTrendData => {
  const labels = [];
  const prs = [];
  const issues = [];
  const commits = [];
  
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    
    prs.push(Math.floor(Math.random() * 30) + 10);
    issues.push(Math.floor(Math.random() * 20) + 5);
    commits.push(Math.floor(Math.random() * 60) + 20);
  }
  
  return {
    labels,
    datasets: [
      {
        label: 'Pull Requests',
        data: prs,
        color: '#10b981',
      },
      {
        label: 'Issues',
        data: issues,
        color: '#f97316',
      },
      {
        label: 'Commits',
        data: commits,
        color: '#8b5cf6',
      },
    ],
  };
};

// Generate sample activity data for candlestick chart
const generateActivityData = (days: number): ActivityDataPoint[] => {
  const data: ActivityDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Generate varying patterns of additions and deletions
    const baseAdditions = Math.floor(Math.random() * 500) + 100;
    const baseDeletions = Math.floor(Math.random() * 300) + 50;
    
    // Sometimes have heavy deletions (refactoring days)
    const isRefactoringDay = Math.random() > 0.8;
    
    data.push({
      date: date.toISOString(),
      additions: isRefactoringDay ? baseAdditions * 0.3 : baseAdditions,
      deletions: isRefactoringDay ? baseDeletions * 2 : baseDeletions,
      commits: Math.floor(Math.random() * 20) + 5,
      files_changed: Math.floor(Math.random() * 30) + 10,
    });
  }
  
  return data;
};

// Sample metrics
const sampleMetrics: WorkspaceMetrics = {
  totalStars: 45230,
  totalPRs: 342,
  totalContributors: 89,
  totalCommits: 12453,
  starsTrend: 12.5,
  prsTrend: -5.2,
  contributorsTrend: 8.7,
  commitsTrend: 15.3,
};

// Sample repositories
const sampleRepositories: Repository[] = [
  {
    id: 'repo-1',
    full_name: 'facebook/react',
    owner: 'facebook',
    name: 'react',
    description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces',
    language: 'JavaScript',
    stars: 215000,
    forks: 45000,
    open_prs: 142,
    open_issues: 892,
    contributors: 1523,
    last_activity: new Date().toISOString(),
    is_pinned: true,
    avatar_url: 'https://github.com/facebook.png',
    html_url: 'https://github.com/facebook/react',
  },
  {
    id: 'repo-2',
    full_name: 'vercel/next.js',
    owner: 'vercel',
    name: 'next.js',
    description: 'The React Framework for the Web',
    language: 'TypeScript',
    stars: 112000,
    forks: 24000,
    open_prs: 89,
    open_issues: 456,
    contributors: 892,
    last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    is_pinned: true,
    avatar_url: 'https://github.com/vercel.png',
    html_url: 'https://github.com/vercel/next.js',
  },
  {
    id: 'repo-3',
    full_name: 'microsoft/typescript',
    owner: 'microsoft',
    name: 'typescript',
    description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output',
    language: 'TypeScript',
    stars: 93000,
    forks: 12000,
    open_prs: 234,
    open_issues: 5234,
    contributors: 678,
    last_activity: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    is_pinned: false,
    avatar_url: 'https://github.com/microsoft.png',
    html_url: 'https://github.com/microsoft/typescript',
  },
  {
    id: 'repo-4',
    full_name: 'tailwindlabs/tailwindcss',
    owner: 'tailwindlabs',
    name: 'tailwindcss',
    description: 'A utility-first CSS framework for rapid UI development',
    language: 'CSS',
    stars: 72000,
    forks: 3700,
    open_prs: 12,
    open_issues: 89,
    contributors: 234,
    last_activity: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    is_pinned: false,
    avatar_url: 'https://github.com/tailwindlabs.png',
    html_url: 'https://github.com/tailwindlabs/tailwindcss',
  },
  {
    id: 'repo-5',
    full_name: 'openai/gpt-3',
    owner: 'openai',
    name: 'gpt-3',
    description: 'GPT-3: Language Models are Few-Shot Learners',
    language: 'Python',
    stars: 45000,
    forks: 8900,
    open_prs: 34,
    open_issues: 123,
    contributors: 89,
    last_activity: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    is_pinned: false,
    avatar_url: 'https://github.com/openai.png',
    html_url: 'https://github.com/openai/gpt-3',
  },
];

const meta = {
  title: 'Features/Workspace/WorkspaceDashboard',
  component: WorkspaceDashboard,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Complete workspace dashboard with metrics, trends, and repository management.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    workspaceName: {
      control: 'text',
      description: 'Name of the workspace',
    },
    tier: {
      control: 'select',
      options: ['free', 'pro', 'enterprise'],
      description: 'User subscription tier',
    },
    loading: {
      control: 'boolean',
      description: 'Show loading state',
    },
  },
  decorators: [
    (Story) => (
      <div className="p-6 bg-background min-h-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkspaceDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    workspaceId: 'workspace-1',
    workspaceName: 'My Workspace',
    metrics: sampleMetrics,
    trendData: generateTrendData(30),
    activityData: generateActivityData(30),
    repositories: sampleRepositories,
    tier: 'free',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
    onUpgradeClick: () => toast.info('Upgrade to Pro clicked'),
  },
};

export const ProTier: Story = {
  args: {
    workspaceId: 'workspace-2',
    workspaceName: 'Pro Team Workspace',
    metrics: {
      ...sampleMetrics,
      totalStars: 125000,
      totalPRs: 892,
      totalContributors: 234,
      totalCommits: 45678,
    },
    trendData: generateTrendData(90),
    activityData: generateActivityData(90),
    repositories: [...sampleRepositories, ...sampleRepositories.map(r => ({
      ...r,
      id: `${r.id}-2`,
      full_name: `${r.owner}/${r.name}-v2`,
    }))],
    tier: 'pro',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Pro tier workspace with access to 90-day data and no upgrade prompt',
      },
    },
  },
};

export const EnterpriseTier: Story = {
  args: {
    workspaceId: 'workspace-3',
    workspaceName: 'Enterprise Organization',
    metrics: {
      totalStars: 450000,
      totalPRs: 3421,
      totalContributors: 892,
      totalCommits: 156789,
      starsTrend: 25.3,
      prsTrend: 18.9,
      contributorsTrend: 32.1,
      commitsTrend: 28.7,
    },
    trendData: generateTrendData(365),
    activityData: generateActivityData(365),
    repositories: [
      ...sampleRepositories,
      ...sampleRepositories.map(r => ({
        ...r,
        id: `${r.id}-ent`,
        full_name: `enterprise/${r.name}`,
        stars: r.stars * 2,
        contributors: r.contributors * 3,
      })),
    ],
    tier: 'enterprise',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Enterprise workspace with full access to all features and historical data',
      },
    },
  },
};

export const EmptyWorkspace: Story = {
  args: {
    workspaceId: 'workspace-empty',
    workspaceName: 'New Workspace',
    metrics: {
      totalStars: 0,
      totalPRs: 0,
      totalContributors: 0,
      totalCommits: 0,
      starsTrend: 0,
      prsTrend: 0,
      contributorsTrend: 0,
      commitsTrend: 0,
    },
    trendData: { labels: [], datasets: [] },
    repositories: [],
    tier: 'free',
    onAddRepository: () => toast.info('Add your first repository!'),
    onSettingsClick: () => toast.info('Settings clicked'),
    onUpgradeClick: () => toast.info('Upgrade to Pro clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty workspace state for new users',
      },
    },
  },
};

export const Loading: Story = {
  args: {
    workspaceId: 'workspace-loading',
    workspaceName: 'Loading Workspace',
    metrics: sampleMetrics,
    trendData: generateTrendData(30),
    repositories: sampleRepositories,
    loading: true,
    tier: 'free',
  },
};

export const SmallWorkspace: Story = {
  args: {
    workspaceId: 'workspace-small',
    workspaceName: 'Personal Projects',
    metrics: {
      totalStars: 234,
      totalPRs: 12,
      totalContributors: 3,
      totalCommits: 456,
      starsTrend: 5.2,
      prsTrend: 0,
      contributorsTrend: 0,
      commitsTrend: -2.3,
    },
    trendData: generateTrendData(7),
    activityData: generateActivityData(7),
    repositories: sampleRepositories.slice(0, 2),
    tier: 'free',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
    onUpgradeClick: () => toast.info('Upgrade to Pro clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Small personal workspace with minimal activity',
      },
    },
  },
};

export const NegativeTrends: Story = {
  args: {
    workspaceId: 'workspace-declining',
    workspaceName: 'Declining Activity Workspace',
    metrics: {
      totalStars: 12000,
      totalPRs: 89,
      totalContributors: 45,
      totalCommits: 2345,
      starsTrend: -15.7,
      prsTrend: -23.4,
      contributorsTrend: -8.9,
      commitsTrend: -31.2,
    },
    trendData: generateTrendData(30),
    repositories: sampleRepositories.slice(0, 3),
    tier: 'pro',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Workspace showing declining activity trends',
      },
    },
  },
};

export const LoadingSkeleton: Story = {
  render: () => <WorkspaceDashboardSkeleton />,
  parameters: {
    docs: {
      description: {
        story: 'Loading skeleton for the entire dashboard',
      },
    },
  },
};

export const Mobile: Story = {
  args: {
    workspaceId: 'workspace-mobile',
    workspaceName: 'Mobile Workspace',
    metrics: sampleMetrics,
    trendData: generateTrendData(7),
    repositories: sampleRepositories.slice(0, 3),
    tier: 'free',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
    onUpgradeClick: () => toast.info('Upgrade to Pro clicked'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Dashboard layout on mobile devices',
      },
    },
  },
};

export const Tablet: Story = {
  args: {
    workspaceId: 'workspace-tablet',
    workspaceName: 'Tablet Workspace',
    metrics: sampleMetrics,
    trendData: generateTrendData(30),
    repositories: sampleRepositories,
    tier: 'pro',
    onAddRepository: () => toast.info('Add repository clicked'),
    onRepositoryClick: (repo) => {
      toast.info(`Navigate to /${repo.owner}/${repo.name}`);
      console.log(`Would navigate to: /${repo.owner}/${repo.name}`);
    },
    onSettingsClick: () => toast.info('Settings clicked'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
    docs: {
      description: {
        story: 'Dashboard layout on tablet devices',
      },
    },
  },
};