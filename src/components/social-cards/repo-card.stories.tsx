import type { Meta, StoryObj } from '@storybook/react';
import RepoSocialCard from './repo-card';
import { mockRepositories } from '@/lib/mocks/socialCardData';

const meta = {
  title: 'Social Cards/Repository Card',
  component: RepoSocialCard,
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
# Repository Social Card

Dynamic social cards for individual repositories that display contributor data, statistics, and activity.

## Specifications
- **Dimensions**: 1200x630px (optimized for Open Graph)
- **Format**: PNG with repository-specific data
- **Purpose**: Social media preview for repository pages
- **Platforms**: Twitter, Facebook, LinkedIn, Discord, Slack

## Design Elements
- Repository name and owner
- Top contributor avatars (up to 5)
- PR and merge statistics
- Activity indicators
- Contribution chart visualization

## Data Sources
- GitHub API for repository metadata
- Supabase database for processed contributor data
- Real-time activity calculations

## CDN Distribution
Repository cards are generated for popular repos and cached:
\`https://egcxzonpmmcirmgqdrla.supabase.co/storage/v1/object/public/social-cards/repo-{owner}-{repo}.png\`
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    owner: {
      control: 'text',
      description: 'Repository owner/organization name',
    },
    repo: {
      control: 'text',
      description: 'Repository name',
    },
    stats: {
      control: 'object',
      description: 'Repository statistics and contributor data',
    },
  },
} satisfies Meta<typeof RepoSocialCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Popular repository card (React) with comprehensive statistics.
 * Shows how the card renders for high-activity repositories.
 */
export const PopularRepository: Story = {
  args: {
    owner: mockRepositories.react.owner,
    repo: mockRepositories.react.repo,
    stats: mockRepositories.react.stats,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Card for a popular repository like React with many contributors and high activity levels.',
      },
    },
  },
};

/**
 * Growing repository with moderate activity levels.
 * Represents mid-tier open source projects.
 */
export const GrowingRepository: Story = {
  args: {
    owner: mockRepositories.vue.owner,
    repo: mockRepositories.vue.repo,
    stats: mockRepositories.vue.stats,
  },
  parameters: {
    docs: {
      description: {
        story: 'Card for a growing repository with moderate contributor activity and engagement.',
      },
    },
  },
};

/**
 * Small repository with minimal activity.
 * Tests layout with fewer contributors and statistics.
 */
export const MinimalRepository: Story = {
  args: {
    owner: mockRepositories['awesome-project'].owner,
    repo: mockRepositories['awesome-project'].repo,
    stats: mockRepositories['awesome-project'].stats,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Card for a smaller repository with minimal contributor activity and fewer statistics.',
      },
    },
  },
};

/**
 * Enterprise repository with extensive activity.
 * Shows how the card handles very large numbers.
 */
export const EnterpriseRepository: Story = {
  args: {
    owner: mockRepositories['enterprise-platform'].owner,
    repo: mockRepositories['enterprise-platform'].repo,
    stats: mockRepositories['enterprise-platform'].stats,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Card for an enterprise repository with extensive contributor activity and large-scale statistics.',
      },
    },
  },
};

/**
 * Repository with very long names to test layout constraints.
 * Ensures text truncation and responsive design work correctly.
 */
export const LongRepositoryName: Story = {
  args: {
    owner: mockRepositories['super-long-repository-name-that-might-overflow'].owner,
    repo: mockRepositories['super-long-repository-name-that-might-overflow'].repo,
    stats: mockRepositories['super-long-repository-name-that-might-overflow'].stats,
  },
  parameters: {
    docs: {
      description: {
        story: 'Tests layout stability with extremely long repository and organization names.',
      },
    },
  },
};

/**
 * Repository without statistics data.
 * Shows fallback design when data is unavailable.
 */
export const NoStats: Story = {
  args: {
    owner: 'example',
    repo: 'repository',
    stats: undefined,
  },
  parameters: {
    docs: {
      description: {
        story: 'Card rendering when repository statistics are unavailable or still loading.',
      },
    },
  },
};

/**
 * Single contributor repository.
 * Tests minimal contributor display scenarios.
 */
export const SingleContributor: Story = {
  args: {
    owner: 'solo-dev',
    repo: 'personal-project',
    stats: {
      totalContributors: 1,
      totalPRs: 5,
      mergedPRs: 4,
      topContributors: [
        {
          login: 'solo-dev',
          avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
          contributions: 42,
        },
      ],
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Card for repositories with a single contributor, common for personal projects.',
      },
    },
  },
};

/**
 * Repository optimized for Twitter Card validation.
 * Ensures compatibility with Twitter's image requirements.
 */
export const TwitterCard: Story = {
  args: {
    owner: mockRepositories.react.owner,
    repo: mockRepositories.react.repo,
    stats: mockRepositories.react.stats,
  },
  parameters: {
    chromatic: {
      viewports: [1200],
      delay: 500,
    },
    docs: {
      description: {
        story: 'Repository card optimized for Twitter Card requirements and validation.',
      },
    },
  },
};

/**
 * Repository card optimized for Facebook Open Graph.
 * Meets Facebook's sharing image specifications.
 */
export const FacebookCard: Story = {
  args: {
    owner: mockRepositories.vue.owner,
    repo: mockRepositories.vue.repo,
    stats: mockRepositories.vue.stats,
  },
  parameters: {
    chromatic: {
      viewports: [1200],
      delay: 500,
    },
    docs: {
      description: {
        story: 'Repository card optimized for Facebook Open Graph sharing requirements.',
      },
    },
  },
};
