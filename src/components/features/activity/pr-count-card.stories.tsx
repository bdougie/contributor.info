import type { Meta, StoryObj } from '@storybook/react';
import { PrCountCard } from './pr-count-card';

const meta = {
  title: 'Features/Activity/PrCountCard',
  component: PrCountCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A card component that displays the count of open pull requests versus total pull requests.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[200px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    openPRs: {
      control: 'number',
      description: 'Number of open pull requests',
    },
    totalPRs: {
      control: 'number',
      description: 'Total number of pull requests',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the card is in a loading state',
    },
  },
} satisfies Meta<typeof PrCountCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    openPRs: 5,
    totalPRs: 23,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    openPRs: 0,
    totalPRs: 0,
    loading: true,
  },
};

export const NoOpenPRs: Story = {
  args: {
    openPRs: 0,
    totalPRs: 15,
    loading: false,
  },
};

export const HighActivity: Story = {
  args: {
    openPRs: 42,
    totalPRs: 187,
    loading: false,
  },
};

export const AllOpen: Story = {
  args: {
    openPRs: 8,
    totalPRs: 8,
    loading: false,
  },
};

export const SinglePR: Story = {
  args: {
    openPRs: 1,
    totalPRs: 1,
    loading: false,
  },
};

export const ManyPRs: Story = {
  args: {
    openPRs: 127,
    totalPRs: 1456,
    loading: false,
  },
};
