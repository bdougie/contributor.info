import type { Meta, StoryObj } from '@storybook/react';
import { ActivityItemSkeleton } from './activity-item-skeleton';

const meta = {
  title: 'Skeletons/ActivityItemSkeleton',
  component: ActivityItemSkeleton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Loading skeleton component that mimics the structure of an ActivityItem while content is being loaded.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[600px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof ActivityItemSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Multiple: Story = {
  render: () => (
    <div className="space-y-1">
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
    </div>
  ),
};

export const WithCustomClass: Story = {
  args: {
    className: 'bg-gray-50 dark:bg-gray-800',
  },
};

export const InActivityFeed: Story = {
  render: () => (
    <div className="border rounded-lg p-4 space-y-1">
      <h3 className="font-semibold mb-3">Recent Activity</h3>
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton />
    </div>
  ),
};
