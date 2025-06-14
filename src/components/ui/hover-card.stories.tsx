import type { Meta, StoryObj } from '@storybook/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from './hover-card';
import { Button } from './button';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Badge } from './badge';

const meta = {
  title: 'UI/Overlay/HoverCard',
  component: HoverCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'For sighted users to preview content available behind a link.',
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
} satisfies Meta<typeof HoverCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link">@nextjs</Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <Avatar>
            <AvatarImage src="https://github.com/vercel.png" />
            <AvatarFallback>VC</AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold">@nextjs</h4>
            <p className="text-sm">
              The React Framework – created and maintained by @vercel.
            </p>
            <div className="flex items-center pt-2">
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
                className="mr-2 h-4 w-4 opacity-70"
              >
                <rect width="20" height="14" x="2" y="3" rx="2" ry="2" />
                <path d="m22 3-10 9L2 3" />
              </svg>
              <span className="text-xs text-muted-foreground">
                Joined December 2021
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const UserProfile: Story = {
  args: {},
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-normal">
          John Doe
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex space-x-4">
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          <div className="space-y-2 flex-1">
            <div>
              <h4 className="text-sm font-semibold">John Doe</h4>
              <p className="text-sm text-muted-foreground">Product Manager</p>
            </div>
            <p className="text-sm">
              Passionate about building great products that solve real problems.
              Currently working on improving user experience.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">React</Badge>
              <Badge variant="secondary" className="text-xs">TypeScript</Badge>
              <Badge variant="secondary" className="text-xs">Design</Badge>
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
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
                className="mr-1"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              San Francisco, CA
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const Repository: Story = {
  args: {},
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-mono">
          shadcn/ui
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-96">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">shadcn/ui</h4>
              <p className="text-sm text-muted-foreground">
                Beautifully designed components built with Radix UI and Tailwind CSS.
              </p>
            </div>
            <Badge className="bg-green-500">Public</Badge>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              TypeScript
            </div>
            <div className="flex items-center gap-1">
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
                <polygon points="12,2 22,8.5 22,15.5 12,22 2,15.5 2,8.5" />
                <line x1="12" x2="12" y1="22" y2="15.5" />
                <polyline points="22,8.5 12,15.5 2,8.5" />
              </svg>
              1.2k
            </div>
            <div className="flex items-center gap-1">
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
                <path d="m15 14 5-5-5-5" />
                <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
              </svg>
              256
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Updated 2 hours ago</span>
            <span>MIT License</span>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const Product: Story = {
  args: {},
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="cursor-pointer p-2 border rounded-lg hover:bg-accent">
          <img 
            src="https://via.placeholder.com/100x100?text=Product" 
            alt="Product" 
            className="w-16 h-16 object-cover rounded"
          />
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-3">
          <div className="flex space-x-3">
            <img 
              src="https://via.placeholder.com/80x80?text=Product" 
              alt="Product" 
              className="w-20 h-20 object-cover rounded"
            />
            <div className="space-y-1 flex-1">
              <h4 className="text-sm font-semibold">Wireless Headphones</h4>
              <p className="text-lg font-bold">$199.99</p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill={i < 4 ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={i < 4 ? "text-yellow-400" : "text-gray-300"}
                  >
                    <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
                  </svg>
                ))}
                <span className="text-xs text-muted-foreground ml-1">(128 reviews)</span>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Premium wireless headphones with noise cancellation and 30-hour battery life.
            Perfect for music lovers and professionals.
          </p>
          
          <div className="flex items-center justify-between">
            <Badge className="bg-green-500">In Stock</Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">Add to Cart</Button>
              <Button size="sm">Buy Now</Button>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const DocumentPreview: Story = {
  args: {},
  render: () => (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Button variant="link" className="p-0 h-auto font-normal">
          quarterly-report.pdf
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center">
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
                className="text-red-600"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" x2="8" y1="13" y2="13" />
                <line x1="16" x2="8" y1="17" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold">Q4 2023 Report</h4>
              <p className="text-xs text-muted-foreground">PDF • 2.4 MB</p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Comprehensive quarterly financial report including revenue analysis, 
            market insights, and strategic recommendations for Q1 2024.
          </p>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Modified Dec 15, 2023</span>
            <span>12 pages</span>
          </div>
          
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1">Preview</Button>
            <Button size="sm" className="flex-1">Download</Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  ),
};

export const Contact: Story = {
  args: {},
  render: () => (
    <div className="p-4">
      <p className="text-sm mb-2">
        For more information, contact{" "}
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link" className="p-0 h-auto font-normal text-blue-600">
              sarah@company.com
            </Button>
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <div className="flex space-x-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>SC</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Sarah Chen</h4>
                <p className="text-sm text-muted-foreground">Sales Manager</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
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
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-10 5L2 7" />
                    </svg>
                    sarah@company.com
                  </div>
                  <div className="flex items-center gap-1">
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
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    (555) 123-4567
                  </div>
                </div>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
        {" "}for pricing details.
      </p>
    </div>
  ),
};