import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta = {
  title: 'UI/Feedback/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays a badge or a component that looks like a badge.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style variant of the badge',
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Badge',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Destructive',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Outline',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span>Active</span>
        <Badge className="bg-green-500 hover:bg-green-600">Online</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>Pending</span>
        <Badge className="bg-yellow-500 hover:bg-yellow-600">Waiting</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>Error</span>
        <Badge variant="destructive">Failed</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>Inactive</span>
        <Badge variant="secondary">Offline</Badge>
      </div>
    </div>
  ),
};

export const WithNumbers: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <div className="flex items-center gap-2">
        <span>Notifications</span>
        <Badge>3</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>Messages</span>
        <Badge variant="destructive">12</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>Downloads</span>
        <Badge variant="secondary">1.2k</Badge>
      </div>
      <div className="flex items-center gap-2">
        <span>Updates</span>
        <Badge variant="outline">2</Badge>
      </div>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="gap-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        Verified
      </Badge>
      <Badge variant="destructive" className="gap-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m15 9-6 6" />
          <path d="m9 9 6 6" />
        </svg>
        Error
      </Badge>
      <Badge variant="secondary" className="gap-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
          <path d="M12 8v4" />
          <path d="m12 16 .01 0" />
        </svg>
        Info
      </Badge>
    </div>
  ),
};

export const SizesExample: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <Badge className="text-xs px-1.5 py-0.5">Small</Badge>
      <Badge>Regular</Badge>
      <Badge className="text-sm px-3 py-1.5">Large</Badge>
    </div>
  ),
};

export const RoundedVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="rounded-none">Square</Badge>
      <Badge className="rounded-sm">Small Radius</Badge>
      <Badge>Default</Badge>
      <Badge className="rounded-full">Round</Badge>
    </div>
  ),
};

export const InteractiveBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="cursor-pointer hover:bg-primary/80 transition-colors">
        Clickable
      </Badge>
      <Badge variant="outline" className="cursor-pointer hover:bg-accent transition-colors">
        Hover me
      </Badge>
      <Badge 
        variant="destructive" 
        className="cursor-pointer hover:bg-destructive/80 transition-colors gap-1"
      >
        Remove
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 6-12 12" />
          <path d="m6 6 12 12" />
        </svg>
      </Badge>
    </div>
  ),
};

export const ColorfulBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge className="bg-blue-500 hover:bg-blue-600">Blue</Badge>
      <Badge className="bg-green-500 hover:bg-green-600">Green</Badge>
      <Badge className="bg-purple-500 hover:bg-purple-600">Purple</Badge>
      <Badge className="bg-pink-500 hover:bg-pink-600">Pink</Badge>
      <Badge className="bg-orange-500 hover:bg-orange-600">Orange</Badge>
      <Badge className="bg-teal-500 hover:bg-teal-600">Teal</Badge>
    </div>
  ),
};

export const DotIndicator: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <span>Online</span>
        <Badge variant="outline" className="ml-auto">Active</Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
        <span>Away</span>
        <Badge variant="secondary" className="ml-auto">Idle</Badge>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
        <span>Offline</span>
        <Badge variant="outline" className="ml-auto">Inactive</Badge>
      </div>
    </div>
  ),
};