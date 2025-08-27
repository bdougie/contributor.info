import type { Meta, StoryObj } from '@storybook/react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';
import { Switch } from './switch';
import { Separator } from './separator';

const meta = {
  title: 'UI/Overlay/Popover',
  component: Popover,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays rich content in a portal, triggered by a button.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center min-h-[300px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">Open popover</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Dimensions</h4>
            <p className="text-sm text-muted-foreground">Set the dimensions for the layer.</p>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="width">Width</Label>
              <Input id="width" defaultValue="100%" className="col-span-2 h-8" />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="maxWidth">Max. width</Label>
              <Input id="maxWidth" defaultValue="300px" className="col-span-2 h-8" />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="height">Height</Label>
              <Input id="height" defaultValue="25px" className="col-span-2 h-8" />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor="maxHeight">Max. height</Label>
              <Input id="maxHeight" defaultValue="none" className="col-span-2 h-8" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const Settings: Story = {
  args: {},
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6m0 10v6m11-7h-6m-10 0H1m15.5-3.5L19 5.5m-14 0 2.5 2.5m12 12L19 18.5m-14 0 2.5-2.5" />
          </svg>
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Settings</h4>
            <p className="text-sm text-muted-foreground">Configure your preferences.</p>
          </div>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications" className="font-normal">
                Email notifications
              </Label>
              <Switch id="notifications" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="marketing" className="font-normal">
                Marketing emails
              </Label>
              <Switch id="marketing" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="social" className="font-normal">
                Social media updates
              </Label>
              <Switch id="social" defaultChecked />
            </div>
            <Separator />
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="@username" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const ContactForm: Story = {
  args: {},
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button>Contact Us</Button>
      </PopoverTrigger>
      <PopoverContent className="w-96">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Get in touch</h4>
            <p className="text-sm text-muted-foreground">
              Send us a message and we'll get back to you.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="your@email.com" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" placeholder="Your message here..." rows={3} />
            </div>
            <Button size="sm" className="w-full">
              Send Message
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const QuickActions: Story = {
  args: {},
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="grid gap-1">
          <Button variant="ghost" className="justify-start">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
            Create Document
          </Button>
          <Button variant="ghost" className="justify-start">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M5 12V7a5 5 0 1 1 10 0v5" />
              <rect width="13" height="11" x="1" y="11" rx="2" ry="2" />
            </svg>
            Upload File
          </Button>
          <Button variant="ghost" className="justify-start">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            </svg>
            Copy Link
          </Button>
          <Separator className="my-1" />
          <Button variant="ghost" className="justify-start text-destructive">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c-1 0 2 1 2 2v2" />
            </svg>
            Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const UserInfo: Story = {
  args: {},
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-sm">Welcome back,</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="link" className="p-0 h-auto font-semibold">
            John Doe
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="grid gap-3">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Account Info</h4>
              <p className="text-sm text-muted-foreground">Manage your account settings</p>
            </div>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>john@example.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role:</span>
                <span>Administrator</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last login:</span>
                <span>2 hours ago</span>
              </div>
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                Settings
              </Button>
              <Button size="sm" variant="outline" className="flex-1">
                Sign Out
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  ),
};

export const ColorPicker: Story = {
  args: {},
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-16 h-8 p-0 border-2">
          <div className="w-full h-full bg-blue-500 rounded-sm"></div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="grid gap-3">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Color Picker</h4>
            <p className="text-sm text-muted-foreground">Choose a color for your theme</p>
          </div>
          <div className="grid grid-cols-8 gap-1">
            {[
              'bg-red-500',
              'bg-orange-500',
              'bg-yellow-500',
              'bg-green-500',
              'bg-blue-500',
              'bg-purple-500',
              'bg-pink-500',
              'bg-gray-500',
              'bg-red-600',
              'bg-orange-600',
              'bg-yellow-600',
              'bg-green-600',
              'bg-blue-600',
              'bg-purple-600',
              'bg-pink-600',
              'bg-gray-600',
              'bg-red-300',
              'bg-orange-300',
              'bg-yellow-300',
              'bg-green-300',
              'bg-blue-300',
              'bg-purple-300',
              'bg-pink-300',
              'bg-gray-300',
            ].map((color, i) => (
              <button
                key={i}
                className={`w-6 h-6 rounded border hover:scale-110 transition-transform ${color}`}
              />
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="hex">Custom HEX</Label>
            <Input id="hex" placeholder="#3b82f6" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};

export const DateRange: Story = {
  args: {},
  render: () => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2"
          >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
          Dec 01 - Dec 31, 2023
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Select Date Range</h4>
            <p className="text-sm text-muted-foreground">
              Choose start and end dates for your report
            </p>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input id="start-date" type="date" defaultValue="2023-12-01" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input id="end-date" type="date" defaultValue="2023-12-31" />
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button size="sm" className="flex-1">
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  ),
};
