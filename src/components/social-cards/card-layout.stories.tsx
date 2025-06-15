import type { Meta, StoryObj } from '@storybook/react';
import CardLayout from './card-layout';
import HomeSocialCard from './home-card';
import RepoSocialCard from './repo-card';
import { mockRepositories } from '@/lib/mocks/socialCardData';

const meta = {
  title: 'Social Cards/Card Layout',
  component: CardLayout,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'socialCard' },
    chromatic: { 
      viewports: [1200],
      delay: 500
    },
    docs: {
      description: {
        component: `
# Card Layout Component

The wrapper component used for social card rendering that provides the base layout structure and meta tag injection.

## Purpose
- Provides consistent layout structure for all social cards
- Handles meta tag injection for social platforms
- Ensures proper viewport and styling for card generation
- Used by the social card generation script for screenshots

## Features
- **Meta Tag Management**: Injects Open Graph and Twitter Card meta tags
- **Responsive Layout**: Ensures cards render correctly at 1200x630
- **Background Handling**: Provides consistent background treatment
- **Screenshot Optimization**: Optimized for Playwright screenshot generation

## Usage in Routes
This component wraps social card content in the dedicated social card routes:
- \`/social-cards/home\` - Home page social card
- \`/social-cards/{owner}/{repo}\` - Repository social cards

## Build Integration
Used by the build process to generate static social card images:
1. Routes render cards using this layout
2. Playwright takes screenshots at 1200x630
3. Images are uploaded to Supabase Storage
4. CDN distributes globally with 1-year cache

## Meta Tag Injection
Automatically injects appropriate meta tags based on card content:
- \`og:title\`, \`og:description\`, \`og:image\`
- \`twitter:card\`, \`twitter:title\`, \`twitter:description\`, \`twitter:image\`
- Proper Open Graph type and site metadata
        `
      }
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CardLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Card layout wrapping the home social card.
 * Shows the complete layout structure for homepage cards.
 */
export const WithHomeCard: Story = {
  args: {
    children: <HomeSocialCard />
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout wrapping the home social card component, showing the complete structure used for homepage social previews.'
      }
    }
  }
};

/**
 * Card layout wrapping a repository social card.
 * Demonstrates layout with repository-specific content.
 */
export const WithRepoCard: Story = {
  args: {
    children: (
      <RepoSocialCard 
        owner={mockRepositories.react.owner}
        repo={mockRepositories.react.repo}
        stats={mockRepositories.react.stats}
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout wrapping a repository social card, showing how repository data is presented within the layout structure.'
      }
    }
  }
};

/**
 * Empty card layout for testing base structure.
 * Shows the minimal layout without any card content.
 */
export const EmptyLayout: Story = {
  args: {
    children: (
      <div className="w-[1200px] h-[630px] bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Empty Card Layout</h1>
          <p className="text-muted-foreground">Base layout structure for social cards</p>
        </div>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Empty card layout showing the base structure and styling used as a foundation for all social cards.'
      }
    }
  }
};

/**
 * Layout with custom background for testing.
 * Demonstrates how custom backgrounds work within the layout.
 */
export const CustomBackground: Story = {
  args: {
    children: (
      <div className="w-[1200px] h-[630px] bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-4">Custom Background</h1>
          <p className="text-xl opacity-90">Testing layout with custom styling</p>
        </div>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Card layout with custom background styling to test layout flexibility and color scheme compatibility.'
      }
    }
  }
};

/**
 * Layout stress test with maximum content.
 * Tests layout stability with dense content and many elements.
 */
export const StressTest: Story = {
  args: {
    children: (
      <div className="w-[1200px] h-[630px] bg-gradient-to-br from-background to-muted p-8 flex flex-col">
        <div className="flex-1 grid grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4">
            <h3 className="font-bold mb-2">Section 1</h3>
            <p className="text-sm text-muted-foreground">Dense content with multiple elements to test layout stability.</p>
          </div>
          <div className="bg-card rounded-lg p-4">
            <h3 className="font-bold mb-2">Section 2</h3>
            <p className="text-sm text-muted-foreground">More content to fill space and test responsive behavior.</p>
          </div>
          <div className="bg-card rounded-lg p-4">
            <h3 className="font-bold mb-2">Section 3</h3>
            <p className="text-sm text-muted-foreground">Additional content for layout stress testing.</p>
          </div>
        </div>
        <div className="mt-4 text-center">
          <h1 className="text-3xl font-bold">Layout Stress Test</h1>
          <p className="text-muted-foreground">Testing maximum content density</p>
        </div>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Stress test with maximum content density to ensure layout stability under various content scenarios.'
      }
    }
  }
};