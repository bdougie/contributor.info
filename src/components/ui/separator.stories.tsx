import type { Meta, StoryObj } from '@storybook/react';
import { Separator } from './separator';

const meta = {
  title: 'UI/Layout/Separator',
  component: Separator,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Visually or semantically separates content.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[300px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: () => (
    <div>
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">Radix Primitives</h4>
        <p className="text-sm text-muted-foreground">An open-source UI component library.</p>
      </div>
      <Separator className="my-4" />
      <div className="flex h-5 items-center space-x-4 text-sm">
        <div>Blog</div>
        <Separator orientation="vertical" />
        <div>Docs</div>
        <Separator orientation="vertical" />
        <div>Source</div>
      </div>
    </div>
  ),
};

export const Horizontal: Story = {
  args: {},
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Section 1</h3>
        <p className="text-sm text-muted-foreground">Content for the first section.</p>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold">Section 2</h3>
        <p className="text-sm text-muted-foreground">Content for the second section.</p>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold">Section 3</h3>
        <p className="text-sm text-muted-foreground">Content for the third section.</p>
      </div>
    </div>
  ),
};

export const Vertical: Story = {
  args: {},
  render: () => (
    <div className="flex h-20 items-center space-x-4">
      <div className="text-center">
        <div className="text-sm font-medium">Item 1</div>
        <div className="text-xs text-muted-foreground">Description</div>
      </div>
      <Separator orientation="vertical" />
      <div className="text-center">
        <div className="text-sm font-medium">Item 2</div>
        <div className="text-xs text-muted-foreground">Description</div>
      </div>
      <Separator orientation="vertical" />
      <div className="text-center">
        <div className="text-sm font-medium">Item 3</div>
        <div className="text-xs text-muted-foreground">Description</div>
      </div>
    </div>
  ),
};

export const Navigation: Story = {
  args: {},
  render: () => (
    <nav className="flex items-center space-x-4 text-sm">
      <a href="#" className="font-medium">
        Home
      </a>
      <Separator orientation="vertical" className="h-4" />
      <a href="#" className="text-muted-foreground hover:text-foreground">
        About
      </a>
      <Separator orientation="vertical" className="h-4" />
      <a href="#" className="text-muted-foreground hover:text-foreground">
        Services
      </a>
      <Separator orientation="vertical" className="h-4" />
      <a href="#" className="text-muted-foreground hover:text-foreground">
        Contact
      </a>
    </nav>
  ),
};
