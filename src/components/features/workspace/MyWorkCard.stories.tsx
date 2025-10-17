import type { Meta, StoryObj } from '@storybook/react';
import { MyWorkCard, type MyWorkItem } from './MyWorkCard';

const meta: Meta<typeof MyWorkCard> = {
  title: 'Features/Workspace/MyWorkCard',
  component: MyWorkCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MyWorkCard>;

const mockItems: MyWorkItem[] = [
  {
    id: '1',
    type: 'pr',
    itemType: 'review_requested',
    title: 'Add new feature: user authentication flow',
    repository: 'acme/web-app',
    status: 'open',
    url: 'https://github.com/acme/web-app/pull/123',
    updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    needsAttention: true,
    number: 123,
    user: {
      username: 'letanloc1998',
      avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
    },
  },
  {
    id: '2',
    type: 'issue',
    itemType: 'assigned',
    title: 'Bug: Login button not responsive on mobile',
    repository: 'acme/mobile-app',
    status: 'open',
    url: 'https://github.com/acme/mobile-app/issues/456',
    updated_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
    needsAttention: false,
    number: 456,
    user: {
      username: 'letanloc1998',
      avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
    },
  },
  {
    id: '3',
    type: 'discussion',
    itemType: 'participant',
    title: 'Discussion: API rate limiting strategy',
    repository: 'acme/api-server',
    status: 'open',
    url: 'https://github.com/acme/api-server/discussions/789',
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    needsAttention: false,
    number: 789,
    user: {
      username: 'letanloc1998',
      avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
    },
  },
  {
    id: '4',
    type: 'pr',
    itemType: 'review_requested',
    title: 'Fix: Resolve memory leak in worker process',
    repository: 'acme/backend',
    status: 'merged',
    url: 'https://github.com/acme/backend/pull/321',
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
    needsAttention: false,
    number: 321,
    user: {
      username: 'letanloc1998',
      avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
    },
  },
  {
    id: '5',
    type: 'pr',
    itemType: 'authored',
    title: 'Update dependencies to latest versions',
    repository: 'acme/web-app',
    status: 'closed',
    url: 'https://github.com/acme/web-app/pull/789',
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
    needsAttention: false,
    number: 789,
    user: {
      username: 'letanloc1998',
      avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
    },
  },
  {
    id: '6',
    type: 'issue',
    itemType: 'assigned',
    title: 'Feature request: Dark mode support',
    repository: 'acme/design-system',
    status: 'open',
    url: 'https://github.com/acme/design-system/issues/100',
    updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
    needsAttention: true,
    number: 100,
    user: {
      username: 'letanloc1998',
      avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
    },
  },
];

export const Default: Story = {
  args: {
    items: mockItems,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    loading: false,
  },
};

export const WithAttentionItems: Story = {
  args: {
    items: mockItems.filter((item) => item.needsAttention),
    loading: false,
  },
};

export const OnlyPRs: Story = {
  args: {
    items: mockItems.filter((item) => item.type === 'pr'),
    loading: false,
  },
};

export const OnlyIssues: Story = {
  args: {
    items: mockItems.filter((item) => item.type === 'issue'),
    loading: false,
  },
};

export const SingleItem: Story = {
  args: {
    items: [mockItems[0]],
    loading: false,
  },
};

export const ManyItems: Story = {
  args: {
    items: [
      ...mockItems,
      {
        id: '7',
        type: 'pr',
        title: 'Refactor: Improve code structure',
        repository: 'acme/core',
        status: 'open',
        url: 'https://github.com/acme/core/pull/999',
        updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        needsAttention: false,
      },
    ],
    loading: false,
  },
};

export const WithClickHandler: Story = {
  args: {
    items: mockItems.slice(0, 3),
    loading: false,
    onItemClick: (item) => {
      alert(`Clicked: ${item.title}`);
      console.log('Clicked item:', item);
    },
  },
};

export const WithFollowUps: Story = {
  args: {
    items: [
      ...mockItems,
      {
        id: '7',
        type: 'issue',
        itemType: 'follow_up',
        title: 'Bug fix: Performance issue on dashboard',
        repository: 'acme/web-app',
        status: 'open',
        url: 'https://github.com/acme/web-app/issues/234',
        updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
        responded_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // responded 3 hours ago
        needsAttention: true,
        number: 234,
        user: {
          username: 'letanloc1998',
          avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
        },
      },
      {
        id: '8',
        type: 'pr',
        itemType: 'follow_up',
        title: 'Feature: Add user profile settings',
        repository: 'acme/backend',
        status: 'open',
        url: 'https://github.com/acme/backend/pull/445',
        updated_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        responded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // responded 2 days ago
        needsAttention: true,
        number: 445,
        user: {
          username: 'letanloc1998',
          avatar_url: 'https://avatars.githubusercontent.com/u/25937103?v=4',
        },
      },
    ],
    loading: false,
  },
};
