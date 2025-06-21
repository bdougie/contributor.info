import type { Meta, StoryObj } from '@storybook/react';
import { OptimizedAvatar } from './optimized-avatar';

const meta = {
  title: 'UI/OptimizedAvatar',
  component: OptimizedAvatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: [32, 40, 48, 64, 80, 96, 128],
    },
    lazy: {
      control: { type: 'boolean' },
    },
    priority: {
      control: { type: 'boolean' },
    },
  },
} satisfies Meta<typeof OptimizedAvatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    src: 'https://avatars.githubusercontent.com/u/5713670?v=4',
    alt: 'Brian Douglas',
    size: 40,
  },
};

export const Large: Story = {
  args: {
    src: 'https://avatars.githubusercontent.com/u/5713670?v=4',
    alt: 'Brian Douglas',
    size: 96,
  },
};

export const Small: Story = {
  args: {
    src: 'https://avatars.githubusercontent.com/u/5713670?v=4',
    alt: 'Brian Douglas',
    size: 32,
  },
};

export const WithFallback: Story = {
  args: {
    src: 'https://invalid-url.com/image.jpg',
    alt: 'John Doe',
    fallback: 'JD',
    size: 64,
  },
};

export const LazyLoading: Story = {
  args: {
    src: 'https://avatars.githubusercontent.com/u/5713670?v=4',
    alt: 'Brian Douglas',
    size: 64,
    lazy: true,
  },
};

export const Priority: Story = {
  args: {
    src: 'https://avatars.githubusercontent.com/u/5713670?v=4',
    alt: 'Brian Douglas',
    size: 64,
    priority: true,
  },
};

export const Sizes: Story = {
  args: {
    src: "https://avatars.githubusercontent.com/u/5713670?v=4",
    alt: "Sample Avatar",
  },
  render: (args) => (
    <div className="flex items-center gap-4">
      <OptimizedAvatar 
        {...args}
        alt="32px" 
        size={32} 
      />
      <OptimizedAvatar 
        {...args}
        alt="40px" 
        size={40} 
      />
      <OptimizedAvatar 
        src="https://avatars.githubusercontent.com/u/5713670?v=4" 
        alt="48px" 
        size={48} 
      />
      <OptimizedAvatar 
        src="https://avatars.githubusercontent.com/u/5713670?v=4" 
        alt="64px" 
        size={64} 
      />
      <OptimizedAvatar 
        src="https://avatars.githubusercontent.com/u/5713670?v=4" 
        alt="80px" 
        size={80} 
      />
      <OptimizedAvatar 
        src="https://avatars.githubusercontent.com/u/5713670?v=4" 
        alt="96px" 
        size={96} 
      />
    </div>
  ),
};

export const GitHubAvatarOptimization: Story = {
  args: {
    src: "https://avatars.githubusercontent.com/u/5713670?v=4",
    alt: "GitHub Avatar Optimization",
  },
  render: (args) => (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Original GitHub URL:</h3>
        <OptimizedAvatar 
          {...args}
          alt="Original" 
          size={64} 
        />
        <p className="text-xs text-muted-foreground mt-1">
          URL will be optimized to: ...?s=64&v=4
        </p>
      </div>
      <div>
        <h3 className="text-sm font-medium mb-2">Different sizes (auto-optimized):</h3>
        <div className="flex items-center gap-2">
          <OptimizedAvatar 
            src="https://avatars.githubusercontent.com/u/5713670?v=4" 
            alt="32px" 
            size={32} 
          />
          <OptimizedAvatar 
            src="https://avatars.githubusercontent.com/u/5713670?v=4" 
            alt="64px" 
            size={64} 
          />
          <OptimizedAvatar 
            src="https://avatars.githubusercontent.com/u/5713670?v=4" 
            alt="96px" 
            size={96} 
          />
        </div>
      </div>
    </div>
  ),
};