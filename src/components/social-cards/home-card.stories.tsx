import type { Meta, StoryObj } from '@storybook/react';
import HomeSocialCard from './home-card';

const meta = {
  title: 'Social Cards/Home Card',
  component: HomeSocialCard,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'socialCard' },
    chromatic: {
      viewports: [1200],
      delay: 500,
    },
    docs: {
      description: {
        component: `
# Home Social Card

The main social card for contributor.info that appears when the homepage is shared on social platforms.

## Specifications
- **Dimensions**: 1200x630px (optimized for Open Graph)
- **Format**: PNG with transparent background
- **Purpose**: Social media preview for homepage links
- **Platforms**: Twitter, Facebook, LinkedIn, Discord, Slack

## Design Elements
- Site logo with "CI" monogram
- Main site title and tagline
- Key platform statistics
- Gradient background with subtle pattern overlay

## CDN Distribution
Cards are generated at build time and distributed via Supabase global CDN:
\`https://egcxzonpmmcirmgqdrla.supabase.co/storage/v1/object/public/social-cards/home-card.png\`
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HomeSocialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default home social card with standard branding and layout.
 * This is the primary variant used for social media sharing.
 */
export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The standard home social card with site branding and tagline. Used when the homepage is shared on social platforms.',
      },
    },
  },
};

/**
 * Home card with custom statistics displayed.
 * Shows how the card would look with real platform data.
 */
export const WithStats: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Home card featuring key platform statistics like repository count and contributor numbers.',
      },
    },
  },
};

/**
 * Card optimized for Twitter's specific image requirements.
 * Ensures compatibility with Twitter Card validation.
 */
export const TwitterOptimized: Story = {
  parameters: {
    chromatic: {
      viewports: [1200],
      delay: 500,
    },
    docs: {
      description: {
        story: 'Optimized for Twitter Card requirements (minimum 300x157, recommended 1200x630).',
      },
    },
  },
};

/**
 * Card optimized for Facebook Open Graph sharing.
 * Meets Facebook's image dimension and quality requirements.
 */
export const FacebookOptimized: Story = {
  parameters: {
    chromatic: {
      viewports: [1200],
      delay: 500,
    },
    docs: {
      description: {
        story: 'Optimized for Facebook Open Graph sharing (minimum 200x200, recommended 1200x630).',
      },
    },
  },
};

/**
 * High contrast version for better accessibility.
 * Ensures readability across different devices and platforms.
 */
export const HighContrast: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'High contrast version ensuring optimal readability on various social platforms and devices.',
      },
    },
  },
};

/**
 * Test version with longer text content to verify layout stability.
 * Ensures the design handles edge cases gracefully.
 */
export const LongContent: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Tests layout stability with longer text content and multiple statistics.',
      },
    },
  },
};
