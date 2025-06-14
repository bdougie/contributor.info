import type { Meta, StoryObj } from '@storybook/react';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

const meta = {
  title: 'UI/DataDisplay/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'An image element with a fallback for representing the user.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: () => (
    <Avatar>
      <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  ),
};

export const WithFallback: Story = {
  args: {},
  render: () => (
    <Avatar>
      <AvatarImage src="/broken-image.jpg" alt="@user" />
      <AvatarFallback>JD</AvatarFallback>
    </Avatar>
  ),
};

export const FallbackOnly: Story = {
  args: {},
  render: () => (
    <Avatar>
      <AvatarFallback>AB</AvatarFallback>
    </Avatar>
  ),
};

export const DifferentSizes: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-8 w-8">
        <AvatarImage src="https://github.com/shadcn.png" alt="Small" />
        <AvatarFallback className="text-xs">SM</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://github.com/shadcn.png" alt="Default" />
        <AvatarFallback>MD</AvatarFallback>
      </Avatar>
      <Avatar className="h-12 w-12">
        <AvatarImage src="https://github.com/shadcn.png" alt="Large" />
        <AvatarFallback>LG</AvatarFallback>
      </Avatar>
      <Avatar className="h-16 w-16">
        <AvatarImage src="https://github.com/shadcn.png" alt="Extra Large" />
        <AvatarFallback className="text-lg">XL</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const UserList: Story = {
  args: {},
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="John Doe" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">John Doe</p>
          <p className="text-xs text-muted-foreground">john@example.com</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarImage src="/broken-image.jpg" alt="Jane Smith" />
          <AvatarFallback>JS</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">Jane Smith</p>
          <p className="text-xs text-muted-foreground">jane@example.com</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">Alex Brown</p>
          <p className="text-xs text-muted-foreground">alex@example.com</p>
        </div>
      </div>
    </div>
  ),
};

export const GroupedAvatars: Story = {
  args: {},
  render: () => (
    <div className="flex -space-x-2">
      <Avatar className="border-2 border-background">
        <AvatarImage src="https://github.com/shadcn.png" alt="User 1" />
        <AvatarFallback>U1</AvatarFallback>
      </Avatar>
      <Avatar className="border-2 border-background">
        <AvatarImage src="/broken-image.jpg" alt="User 2" />
        <AvatarFallback>U2</AvatarFallback>
      </Avatar>
      <Avatar className="border-2 border-background">
        <AvatarFallback>U3</AvatarFallback>
      </Avatar>
      <Avatar className="border-2 border-background">
        <AvatarFallback>U4</AvatarFallback>
      </Avatar>
      <Avatar className="border-2 border-background">
        <AvatarFallback className="text-xs">+5</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const CustomColors: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarFallback className="bg-red-500 text-white">RD</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-green-500 text-white">GR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-blue-500 text-white">BL</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-purple-500 text-white">PR</AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="bg-yellow-500 text-black">YL</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithStatus: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="Online User" />
          <AvatarFallback>ON</AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 border-2 border-white rounded-full"></div>
      </div>
      <div className="relative">
        <Avatar>
          <AvatarImage src="/broken-image.jpg" alt="Away User" />
          <AvatarFallback>AW</AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0 h-3 w-3 bg-yellow-500 border-2 border-white rounded-full"></div>
      </div>
      <div className="relative">
        <Avatar>
          <AvatarFallback>OF</AvatarFallback>
        </Avatar>
        <div className="absolute bottom-0 right-0 h-3 w-3 bg-gray-400 border-2 border-white rounded-full"></div>
      </div>
    </div>
  ),
};

export const Loading: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarFallback className="animate-pulse bg-muted">
          <div className="h-4 w-4 bg-muted-foreground/20 rounded"></div>
        </AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="animate-pulse bg-muted">
          <div className="h-4 w-4 bg-muted-foreground/20 rounded"></div>
        </AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarFallback className="animate-pulse bg-muted">
          <div className="h-4 w-4 bg-muted-foreground/20 rounded"></div>
        </AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const TeamMembers: Story = {
  args: {},
  render: () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Team Members</h3>
      <div className="grid gap-3">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" alt="Sarah Johnson" />
            <AvatarFallback>SJ</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">Sarah Johnson</p>
            <p className="text-xs text-muted-foreground">Product Manager</p>
          </div>
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
          <Avatar>
            <AvatarImage src="/broken-image.jpg" alt="Mike Chen" />
            <AvatarFallback>MC</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">Mike Chen</p>
            <p className="text-xs text-muted-foreground">Lead Developer</p>
          </div>
          <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
        </div>
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
          <Avatar>
            <AvatarFallback>ER</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium">Emily Rodriguez</p>
            <p className="text-xs text-muted-foreground">UX Designer</p>
          </div>
          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  ),
};