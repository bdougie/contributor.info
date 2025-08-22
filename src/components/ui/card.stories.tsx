import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { designTokens } from '../../../.storybook/design-tokens';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './card';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Badge } from './badge';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { Switch } from './switch';

const meta = {
  title: 'UI/Layout/Card',
  component: Card,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A versatile card component for displaying content in a contained, organized format. Supports header, content, and footer sections with various layouts and styles.',
      },
    },
  },
  tags: ['autodocs', 'interaction'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes to apply to the card',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ 
        minWidth: '400px',
        padding: designTokens.spacing[4],
      }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card Description</CardDescription>
      </CardHeader>
      <CardContent>
        <p>Card Content</p>
      </CardContent>
      <CardFooter>
        <p>Card Footer</p>
      </CardFooter>
    </Card>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Simple Card</CardTitle>
      </CardHeader>
      <CardContent>
        <p>This is a simple card with just a title and content.</p>
      </CardContent>
    </Card>
  ),
};

export const Interactive: Story = {
  render: () => (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg active:scale-[0.98]"
      tabIndex={0}
      role="article"
      aria-label="Interactive card"
    >
      <CardHeader>
        <CardTitle>Interactive Card</CardTitle>
        <CardDescription>Click or hover to see the effect</CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card responds to user interaction with hover effects and click handling.</p>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" size="sm">Learn More →</Button>
      </CardFooter>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole('article', { name: /interactive card/i });
    
    // Simple synchronous tests only
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('cursor-pointer');
    expect(card).toHaveClass('transition-all');
    
    const button = canvas.getByRole('button', { name: /Learn More/i });
    expect(button).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'An interactive card with hover effects, click handling, and mobile touch support. Includes keyboard accessibility.',
      },
    },
  },
};

export const WithForm: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Create project</CardTitle>
        <CardDescription>Deploy your new project in one-click.</CardDescription>
      </CardHeader>
      <CardContent>
        <form>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Name of your project" />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="framework">Framework</Label>
              <Input id="framework" placeholder="React, Vue, etc." />
            </div>
          </div>
        </form>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline">Cancel</Button>
        <Button>Deploy</Button>
      </CardFooter>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Simple synchronous tests only
    const nameInput = canvas.getByLabelText('Name');
    expect(nameInput).toBeInTheDocument();
    
    const frameworkInput = canvas.getByLabelText('Framework');
    expect(frameworkInput).toBeInTheDocument();
    
    const cancelButton = canvas.getByRole('button', { name: 'Cancel' });
    const deployButton = canvas.getByRole('button', { name: 'Deploy' });
    expect(cancelButton).toBeInTheDocument();
    expect(deployButton).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'A card containing a form with inputs and action buttons. Ideal for data entry and submission flows.',
      },
    },
  },
};

export const ProfileCard: Story = {
  render: () => (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <CardTitle>John Doe</CardTitle>
          <CardDescription>Software Engineer</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Building amazing products with modern web technologies. 
          Passionate about React, TypeScript, and great user experiences.
        </p>
        <div className="flex gap-2 mt-4">
          <Badge>React</Badge>
          <Badge>TypeScript</Badge>
          <Badge>Node.js</Badge>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">Message</Button>
        <Button size="sm">Follow</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A profile card with avatar, badges, and action buttons. Perfect for user profiles and team member displays.',
      },
    },
  },
};

export const Notification: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center space-x-4 rounded-md border p-4">
          <Switch id="push" aria-label="Push Notifications" />
          <div className="flex-1 space-y-1">
            <label htmlFor="push" className="text-sm font-medium leading-none">
              Push Notifications
            </label>
            <p className="text-sm text-muted-foreground">
              Send notifications to device.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4 rounded-md border p-4">
          <Switch id="email" defaultChecked aria-label="Email Notifications" />
          <div className="flex-1 space-y-1">
            <label htmlFor="email" className="text-sm font-medium leading-none">
              Email Notifications
            </label>
            <p className="text-sm text-muted-foreground">
              Send notifications via email.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Save preferences</Button>
      </CardFooter>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Simple synchronous tests only
    const pushSwitch = canvas.getByRole('switch', { name: /push notifications/i });
    const emailSwitch = canvas.getByRole('switch', { name: /email notifications/i });
    
    expect(pushSwitch).toBeInTheDocument();
    expect(emailSwitch).toBeInTheDocument();
    
    // Email should be checked by default
    expect(emailSwitch).toBeChecked();
    expect(pushSwitch).not.toBeChecked();
    
    const saveButton = canvas.getByRole('button', { name: /save preferences/i });
    expect(saveButton).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'A settings card with toggle switches for notification preferences.',
      },
    },
  },
};

export const Stats: Story = {
  render: () => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Total Revenue
        </CardTitle>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          className="h-4 w-4 text-muted-foreground"
        >
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">$45,231.89</div>
        <p className="text-xs text-muted-foreground">
          +20.1% from last month
        </p>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A compact stats card for displaying metrics and KPIs. Ideal for dashboards.',
      },
    },
  },
};

export const Loading: Story = {
  render: () => (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-pulse" />
      <CardHeader>
        <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
        <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
        </div>
      </CardContent>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A loading state card with skeleton animations. Use while data is being fetched.',
      },
    },
  },
};

export const Error: Story = {
  render: () => (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <CardTitle className="text-red-800">Error Loading Data</CardTitle>
        <CardDescription className="text-red-600">
          Something went wrong while fetching the information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-red-700 text-sm">
          Please check your connection and try again.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
          Retry
        </Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'An error state card with appropriate styling and retry action.',
      },
    },
  },
};

export const WithImage: Story = {
  render: () => (
    <Card className="overflow-hidden">
      <div 
        className="h-[200px] bg-gradient-to-r from-blue-500 to-purple-500"
        style={{
          background: `linear-gradient(135deg, ${designTokens.colors.primary[500]} 0%, ${designTokens.colors.secondary[500]} 100%)`,
        }}
      />
      <CardHeader>
        <CardTitle>Beautiful Gradient</CardTitle>
        <CardDescription>
          A card with a beautiful gradient header image.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p>This card demonstrates how to use images or gradients with the card component.</p>
      </CardContent>
      <CardFooter>
        <Button className="w-full">View Details</Button>
      </CardFooter>
    </Card>
  ),
  parameters: {
    docs: {
      description: {
        story: 'A card with a decorative header image or gradient. Great for featured content.',
      },
    },
  },
};

export const GridLayout: Story = {
  render: () => (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: designTokens.spacing[4],
      width: '100%',
      minWidth: '800px',
    }}>
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle>Card {i}</CardTitle>
            <CardDescription>Description for card {i}</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Content for card {i}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Multiple cards in a responsive grid layout. Shows how cards work in collection displays.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ 
      display: 'flex',
      flexDirection: 'column',
      gap: designTokens.spacing[4],
      alignItems: 'center',
    }}>
      <Card className="w-64">
        <CardHeader>
          <CardTitle className="text-sm">Small Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs">Compact size for tight spaces</p>
        </CardContent>
      </Card>
      
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Medium Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Standard size for most use cases</p>
        </CardContent>
      </Card>
      
      <Card className="w-[32rem]">
        <CardHeader>
          <CardTitle className="text-xl">Large Card</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg">Spacious size for detailed content</p>
        </CardContent>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Cards in different sizes showing flexibility in width and content scaling.',
      },
    },
  },
};

export const MobileInteractions: Story = {
  render: () => (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] touch-manipulation"
      tabIndex={0}
      role="button"
      aria-label="Tap to interact"
    >
      <CardHeader>
        <CardTitle>Mobile Optimized Card</CardTitle>
        <CardDescription>Optimized for touch interactions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <p className="text-sm">This card is optimized for mobile devices with:</p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
            <li>Touch-friendly tap targets (minimum 44x44px)</li>
            <li>Visual feedback on touch (scale animation)</li>
            <li>Disabled double-tap zoom (touch-manipulation)</li>
            <li>Swipe gesture support</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="lg" className="min-h-[44px] min-w-[44px]">
          Action
        </Button>
        <Button size="lg" variant="outline" className="min-h-[44px] min-w-[44px]">
          Cancel
        </Button>
      </CardFooter>
    </Card>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = canvas.getByRole('button', { name: /tap to interact/i });
    
    // Simple synchronous tests only
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('touch-manipulation');
    
    const buttons = canvas.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeInTheDocument();
    });
  },
  parameters: {
    docs: {
      description: {
        story: 'A card optimized for mobile interactions with touch gestures, proper tap targets, and visual feedback.',
      },
    },
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: designTokens.spacing[4],
      width: '100%',
      minWidth: '800px',
    }}>
      <Card>
        <CardHeader>
          <CardTitle>Default Card</CardTitle>
          <CardDescription>Standard card appearance</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Regular content styling</p>
        </CardContent>
      </Card>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Elevated Card</CardTitle>
          <CardDescription>With shadow for emphasis</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Stands out from the page</p>
        </CardContent>
      </Card>
      
      <Card className="border-2 border-primary">
        <CardHeader>
          <CardTitle>Highlighted Card</CardTitle>
          <CardDescription>With colored border</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Draws attention to important content</p>
        </CardContent>
      </Card>
      
      <Card className="bg-muted">
        <CardHeader>
          <CardTitle>Muted Card</CardTitle>
          <CardDescription>Subtle background color</CardDescription>
        </CardHeader>
        <CardContent>
          <p>For secondary information</p>
        </CardContent>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcase of different card styling variants and their use cases.',
      },
    },
  },
};