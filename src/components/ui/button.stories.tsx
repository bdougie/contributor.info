import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { designTokens } from '../../../.storybook/design-tokens';
import { Button } from './button';

const meta = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A versatile button component that supports multiple variants, sizes, and states. Used throughout the application for user interactions.',
      },
    },
  },
  tags: ['autodocs', 'interaction', 'accessibility'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
    asChild: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Button',
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

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link',
  },
};

export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small',
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large',
  },
};

export const Icon: Story = {
  args: {
    size: 'icon',
    children: '⚡',
  },
};

export const WithInteraction: Story = {
  args: {
    children: 'Click me!',
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    // Check that the button is present - synchronous checks only
    expect(button).toBeInTheDocument();

    // Check that the button has the correct text
    expect(button).toHaveTextContent('Click me!');

    // Simple synchronous test only

    // Direct focus check without async waiting
    button.focus();
    expect(document.activeElement).toBe(button);
  },
  tags: ['interaction'],
};

export const DisabledInteraction: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    // Check that the button is disabled - synchronous
    expect(button).toBeDisabled();

    // Check that disabled button has pointer-events: none (preventing clicks)
    const computedStyle = getComputedStyle(button);
    expect(computedStyle.pointerEvents).toBe('none');

    // Verify button is not focusable when disabled - synchronous
    button.focus();
    expect(document.activeElement).not.toBe(button);
  },
  tags: ['interaction'],
};

export const KeyboardNavigation: Story = {
  args: {
    children: 'Keyboard Test',
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole('button');

    // Test direct focus - synchronous
    button.focus();
    expect(document.activeElement).toBe(button);

    // Simulate keyboard events synchronously
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
    button.dispatchEvent(enterEvent);

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
    button.dispatchEvent(spaceEvent);

    // Verify focus remains - synchronous
    expect(document.activeElement).toBe(button);
  },
  tags: ['interaction', 'accessibility'],
};

export const AllVariants: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: designTokens.spacing[4],
        padding: designTokens.spacing[4],
      }}
    >
      <div style={{ display: 'flex', gap: designTokens.spacing[2], alignItems: 'center' }}>
        <Button variant="default">Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Showcases all button variants in one view for easy comparison.',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: designTokens.spacing[4],
        alignItems: 'center',
        padding: designTokens.spacing[4],
      }}
    >
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon">⚡</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates all available button sizes.',
      },
    },
  },
};

export const States: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: designTokens.spacing[4],
        padding: designTokens.spacing[4],
      }}
    >
      <div>
        <p
          style={{
            marginBottom: designTokens.spacing[2],
            fontSize: designTokens.typography.fontSize.sm.size,
          }}
        >
          Normal
        </p>
        <Button>Click me</Button>
      </div>
      <div>
        <p
          style={{
            marginBottom: designTokens.spacing[2],
            fontSize: designTokens.typography.fontSize.sm.size,
          }}
        >
          Loading
        </p>
        <Button disabled>
          <span style={{ marginRight: designTokens.spacing[2] }}>⏳</span>
          Loading...
        </Button>
      </div>
      <div>
        <p
          style={{
            marginBottom: designTokens.spacing[2],
            fontSize: designTokens.typography.fontSize.sm.size,
          }}
        >
          Disabled
        </p>
        <Button disabled>Disabled</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows different button states including loading and disabled.',
      },
    },
  },
};
