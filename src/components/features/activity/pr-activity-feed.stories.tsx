import type { Meta, StoryObj } from '@storybook/react';
import { PullRequestActivityFeed } from './pr-activity-feed';
import { PullRequestActivity, ActivityType } from '@/lib/types';

// Mock data for PR activities
const createMockActivity = (
  id: string,
  type: ActivityType,
  actor: string,
  timestamp: string,
  prNumber?: number,
  repositoryName?: string,
): PullRequestActivity => ({
  id,
  type,
  user: {
    id: `user-${id}`,
    name: actor,
    avatar: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 1000)}?v=4`,
    isBot: false,
  },
  pullRequest: {
    id: `pr-${prNumber || id}`,
    number: prNumber || parseInt(id),
    title: `Example PR #${prNumber || id}`,
    url: `https://github.com/${repositoryName || 'example/repo'}/pull/${prNumber || id}`,
    state: Math.random() > 0.5 ? 'open' : 'closed',
  },
  repository: {
    id: `repo-${repositoryName?.replace('/', '-') || 'example-repo'}`,
    name: repositoryName?.split('/')[1] || 'repo',
    owner: repositoryName?.split('/')[0] || 'example',
    url: `https://github.com/${repositoryName || 'example/repo'}`,
    fullName: repositoryName || 'example/repo',
  },
  timestamp,
});

const mixedActivities: PullRequestActivity[] = [
  createMockActivity('1', 'opened', 'alice-dev', '2024-01-15T10:30:00Z', 123, 'facebook/react'),
  createMockActivity(
    '2',
    'reviewed',
    'bob-reviewer',
    '2024-01-15T11:45:00Z',
    123,
    'facebook/react',
  ),
  createMockActivity(
    '3',
    'merged',
    'carol-maintainer',
    '2024-01-15T12:00:00Z',
    122,
    'facebook/react',
  ),
  createMockActivity(
    '4',
    'commented',
    'dave-contributor',
    '2024-01-15T12:30:00Z',
    124,
    'facebook/react',
  ),
  createMockActivity(
    '5',
    'closed',
    'eve-maintainer',
    '2024-01-15T13:00:00Z',
    121,
    'facebook/react',
  ),
];

const highVolumeActivities: PullRequestActivity[] = Array.from({ length: 20 }, (_, i) => {
  const types: ActivityType[] = ['opened', 'merged', 'reviewed', 'commented', 'closed'];
  const contributors = ['alice', 'bob', 'carol', 'dave', 'eve', 'frank', 'grace'];
  const type = types[i % types.length];
  const actor = contributors[i % contributors.length];

  return createMockActivity(
    `activity-${i}`,
    type,
    actor,
    new Date(Date.now() - i * 3600000).toISOString(), // Each activity 1 hour apart
    i + 100,
    'microsoft/vscode',
  );
});

const meta = {
  title: 'Features/Activity/PullRequestActivityFeed',
  component: PullRequestActivityFeed,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A feed component that displays a chronological list of pull request activities including opening, merging, reviewing, commenting, and closing events.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    activities: {
      control: false,
      description: 'Array of pull request activities to display',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the feed is in a loading state',
    },
    error: {
      control: false,
      description: 'Error object if there was an error loading activities',
    },
    selectedTypes: {
      control: 'check',
      options: ['opened', 'merged', 'reviewed', 'commented', 'closed'],
      description: 'Filter activities by selected types',
    },
  },
} satisfies Meta<typeof PullRequestActivityFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activities: mixedActivities,
    loading: false,
    error: null,
    selectedTypes: [],
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const HighVolume: Story = {
  args: {
    activities: highVolumeActivities,
    loading: false,
    error: null,
    selectedTypes: [],
  },
  render: (args) => (
    <div className="w-[600px] h-[500px] overflow-y-auto p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const FilteredByType: Story = {
  args: {
    activities: mixedActivities,
    loading: false,
    error: null,
    selectedTypes: ['opened', 'merged'],
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const Loading: Story = {
  args: {
    activities: [],
    loading: true,
    error: null,
    selectedTypes: [],
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const LoadingWithExistingData: Story = {
  args: {
    activities: mixedActivities.slice(0, 3),
    loading: true,
    error: null,
    selectedTypes: [],
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const ErrorState: Story = {
  args: {
    activities: [],
    loading: false,
    error: new globalThis.Error('Failed to load PR activity _data'),
    selectedTypes: [],
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const EmptyData: Story = {
  args: {
    activities: [],
    loading: false,
    error: null,
    selectedTypes: [],
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};

export const EmptyAfterFilter: Story = {
  args: {
    activities: mixedActivities,
    loading: false,
    error: null,
    selectedTypes: ['opened'], // Filter to show only opened PRs (but our _data has mixed types)
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  ),
};
