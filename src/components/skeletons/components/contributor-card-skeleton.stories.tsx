import type { Meta, StoryObj } from '@storybook/react';
import { ContributorCardSkeleton } from './contributor-card-skeleton';

const meta = {
  title: 'Skeletons/ContributorCardSkeleton',
  component: ContributorCardSkeleton,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Loading skeleton component that mimics the structure of the ContributorCard while content is being loaded.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[350px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    isWinner: {
      control: 'boolean',
      description: 'Whether this skeleton represents a winner card',
    },
    showRank: {
      control: 'boolean',
      description: 'Whether to show the rank badge skeleton',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof ContributorCardSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    showRank: true,
    isWinner: false,
  },
};

export const Winner: Story = {
  args: {
    showRank: true,
    isWinner: true,
  },
};

export const WithoutRank: Story = {
  args: {
    showRank: false,
    isWinner: false,
  },
};

export const WinnerWithoutRank: Story = {
  args: {
    showRank: false,
    isWinner: true,
  },
};

export const Multiple: Story = {
  render: () => (
    <div className="space-y-4">
      <ContributorCardSkeleton showRank={true} isWinner={true} />
      <ContributorCardSkeleton showRank={true} isWinner={false} />
      <ContributorCardSkeleton showRank={true} isWinner={false} />
      <ContributorCardSkeleton showRank={true} isWinner={false} />
    </div>
  ),
};
