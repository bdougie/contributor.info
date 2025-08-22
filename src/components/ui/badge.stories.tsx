import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { designTokens } from '../../../.storybook/design-tokens';
import { Badge } from './badge';

const meta = {
  title: 'UI/Feedback/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A compact label component for displaying status, counts, categories, or metadata. Supports multiple variants, sizes, and can include icons or indicators.',
      },
    },
  },
  tags: ['autodocs', 'interaction'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
      description: 'The visual style variant of the badge',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for custom styling',
    },
    children: {
      control: 'text',
      description: 'Badge content',
    },
  },
  decorators: [
    (Story) => (
      <div style={{
        padding: designTokens.spacing[8],
        minWidth: '300px',
      }}>
        <Story />
      </div>
    ),
  ],
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
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: designTokens.spacing[2],
    }}>
      <Badge>Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available badge variants displayed together for comparison.',
      },
    },
  },
};

export const Sizes: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: designTokens.spacing[3],
    }}>
      <Badge className="text-xs px-1.5 py-0">Tiny</Badge>
      <Badge className="text-xs px-2 py-0.5">Small</Badge>
      <Badge>Default</Badge>
      <Badge className="text-sm px-3 py-1">Medium</Badge>
      <Badge className="text-base px-4 py-1.5">Large</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different badge sizes for various use cases and hierarchies.',
      },
    },
  },
};

export const StatusBadges: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: designTokens.spacing[3],
    }}>
      <div className="flex items-center gap-2">
        <Badge className="bg-green-500 hover:bg-green-600 text-white">
          <span className="mr-1">●</span>
          Online
        </Badge>
        <span className="text-sm text-muted-foreground">Active users</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white">
          <span className="mr-1">●</span>
          Pending
        </Badge>
        <span className="text-sm text-muted-foreground">Awaiting review</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="destructive">
          <span className="mr-1">●</span>
          Error
        </Badge>
        <span className="text-sm text-muted-foreground">Failed processes</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          <span className="mr-1">●</span>
          Offline
        </Badge>
        <span className="text-sm text-muted-foreground">Inactive status</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Status badges with color coding for different states.',
      },
    },
  },
};

export const WithNumbers: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: designTokens.spacing[4],
    }}>
      <div className="flex items-center justify-between">
        <span>Notifications</span>
        <Badge>3</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span>Messages</span>
        <Badge variant="destructive">99+</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span>Downloads</span>
        <Badge variant="secondary">1.2k</Badge>
      </div>
      <div className="flex items-center justify-between">
        <span>Updates</span>
        <Badge variant="outline">2</Badge>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Numeric badges for displaying counts and quantities.',
      },
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: designTokens.spacing[2],
    }}>
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
          <polyline points="20 6 9 17 4 12" />
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
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
        Info
      </Badge>
      <Badge variant="outline" className="gap-1">
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
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        Warning
      </Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Badges with icons for enhanced visual communication.',
      },
    },
  },
};

export const Interactive: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: designTokens.spacing[2],
    }}>
      <Badge 
        className="cursor-pointer hover:bg-primary/80 transition-colors"
        tabIndex={0}
        role="button"
      >
        Clickable
      </Badge>
      <Badge 
        variant="outline" 
        className="cursor-pointer hover:bg-accent transition-colors"
        tabIndex={0}
        role="button"
      >
        Hover me
      </Badge>
      <Badge 
        variant="destructive" 
        className="cursor-pointer hover:bg-destructive/80 transition-colors gap-1"
        tabIndex={0}
        role="button"
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
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </Badge>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Simple synchronous tests only
    const clickableBadge = canvas.getByRole('button', { name: /Clickable/i });
    expect(clickableBadge).toBeInTheDocument();
    expect(clickableBadge).toHaveClass('cursor-pointer');
    
    const hoverBadge = canvas.getByRole('button', { name: /Hover me/i });
    expect(hoverBadge).toBeInTheDocument();
    
    const removeBadge = canvas.getByRole('button', { name: /Remove/i });
    expect(removeBadge).toBeInTheDocument();
  },
  parameters: {
    docs: {
      description: {
        story: 'Interactive badges that can be clicked or focused. Useful for filters, tags, or dismissible items.',
      },
    },
  },
};

export const Categories: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: designTokens.spacing[4],
    }}>
      <div>
        <h4 className="text-sm font-medium mb-2">Technologies</h4>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline">React</Badge>
          <Badge variant="outline">TypeScript</Badge>
          <Badge variant="outline">Node.js</Badge>
          <Badge variant="outline">GraphQL</Badge>
          <Badge variant="outline">PostgreSQL</Badge>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Priorities</h4>
        <div className="flex flex-wrap gap-1">
          <Badge className="bg-red-500 text-white">Critical</Badge>
          <Badge className="bg-orange-500 text-white">High</Badge>
          <Badge className="bg-yellow-500 text-white">Medium</Badge>
          <Badge className="bg-blue-500 text-white">Low</Badge>
        </div>
      </div>
      <div>
        <h4 className="text-sm font-medium mb-2">Labels</h4>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">bug</Badge>
          <Badge variant="secondary">enhancement</Badge>
          <Badge variant="secondary">documentation</Badge>
          <Badge variant="secondary">help wanted</Badge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Category badges for organizing and labeling content.',
      },
    },
  },
};

export const ColorfulBadges: Story = {
  render: () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: designTokens.spacing[2],
    }}>
      <Badge style={{ backgroundColor: designTokens.colors.primary[500], color: 'white' }}>
        Primary
      </Badge>
      <Badge style={{ backgroundColor: designTokens.colors.secondary[500], color: 'white' }}>
        Secondary
      </Badge>
      <Badge style={{ backgroundColor: designTokens.colors.success[500], color: 'white' }}>
        Success
      </Badge>
      <Badge style={{ backgroundColor: designTokens.colors.warning[500], color: 'white' }}>
        Warning
      </Badge>
      <Badge style={{ backgroundColor: designTokens.colors.error[500], color: 'white' }}>
        Error
      </Badge>
      <Badge style={{ backgroundColor: designTokens.colors.info[500], color: 'white' }}>
        Info
      </Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Badges using the design token color system for consistent theming.',
      },
    },
  },
};

export const RoundedVariants: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: designTokens.spacing[2],
      alignItems: 'center',
    }}>
      <Badge className="rounded-none">Square</Badge>
      <Badge style={{ borderRadius: designTokens.borderRadius.sm }}>Small</Badge>
      <Badge style={{ borderRadius: designTokens.borderRadius.DEFAULT }}>Default</Badge>
      <Badge style={{ borderRadius: designTokens.borderRadius.md }}>Medium</Badge>
      <Badge style={{ borderRadius: designTokens.borderRadius.lg }}>Large</Badge>
      <Badge style={{ borderRadius: designTokens.borderRadius.full }}>Pill</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Different border radius options using design tokens.',
      },
    },
  },
};

export const Loading: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      gap: designTokens.spacing[2],
    }}>
      <Badge className="animate-pulse bg-gray-200 text-transparent">
        Loading
      </Badge>
      <Badge variant="secondary" className="animate-pulse">
        <span className="inline-block w-12 h-3 bg-gray-300 rounded"></span>
      </Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Loading state badges with skeleton animation.',
      },
    },
  },
};

export const Composition: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: designTokens.spacing[4],
    }}>
      <div className="flex items-center gap-2">
        <img 
          src="https://github.com/shadcn.png" 
          alt="User" 
          className="w-8 h-8 rounded-full"
        />
        <span className="font-medium">John Doe</span>
        <Badge variant="secondary">Pro</Badge>
        <Badge className="bg-green-500 text-white">Active</Badge>
      </div>
      
      <div className="border rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              Issue Title
              <Badge variant="destructive">Bug</Badge>
              <Badge variant="outline">P1</Badge>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Created 2 hours ago • Updated 30 minutes ago
            </p>
          </div>
          <Badge variant="secondary">In Progress</Badge>
        </div>
      </div>
      
      <div className="flex items-center justify-between p-3 border rounded">
        <div className="flex items-center gap-2">
          <span className="text-sm">Repository:</span>
          <Badge variant="outline">shadcn/ui</Badge>
        </div>
        <div className="flex gap-1">
          <Badge>1.2k ⭐</Badge>
          <Badge>89 🍴</Badge>
          <Badge>12 👁</Badge>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Badges composed with other UI elements in real-world scenarios.',
      },
    },
  },
};

export const Accessibility: Story = {
  render: () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: designTokens.spacing[3],
    }}>
      <div className="flex items-center gap-2">
        <span id="notification-label">Notifications:</span>
        <Badge aria-labelledby="notification-label">5 unread</Badge>
      </div>
      
      <div className="flex items-center gap-2">
        <span>Status:</span>
        <Badge 
          role="status" 
          aria-live="polite"
          className="bg-green-500 text-white"
        >
          Connected
        </Badge>
      </div>
      
      <div className="flex items-center gap-2">
        <span>Priority:</span>
        <Badge 
          variant="destructive"
          aria-label="High priority issue"
        >
          High
        </Badge>
      </div>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Check ARIA attributes
    const statusBadge = canvas.getByRole('status');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveAttribute('aria-live', 'polite');
    
    // Check labeling
    const notificationBadge = canvas.getByText('5 unread');
    expect(notificationBadge).toBeInTheDocument();
    expect(notificationBadge).toHaveAttribute('aria-labelledby', 'notification-label');
  },
  parameters: {
    docs: {
      description: {
        story: 'Badges with proper ARIA attributes for screen reader accessibility.',
      },
    },
  },
};