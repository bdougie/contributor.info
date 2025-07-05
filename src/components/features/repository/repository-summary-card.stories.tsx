import type { Meta, StoryObj } from '@storybook/react';
import { RepositorySummaryCard } from './repository-summary-card';

const meta: Meta<typeof RepositorySummaryCard> = {
  title: 'Features/Repository/RepositorySummaryCard',
  component: RepositorySummaryCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'AI-powered repository summary card that displays intelligent insights about repository activity and focus areas.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    owner: {
      control: 'text',
      description: 'Repository owner',
    },
    repo: {
      control: 'text', 
      description: 'Repository name',
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Create mock implementations
const mockUseRepositorySummary = {
  loading: {
    summary: null,
    loading: true,
    error: null,
    refetch: () => {},
  },
  withSummary: {
    summary: 'React is a JavaScript library for building user interfaces, maintained by Meta and the React community. Recent development has focused on performance improvements through concurrent features and the new React Server Components architecture. Current open pull requests indicate ongoing work on accessibility enhancements, testing infrastructure, and developer experience improvements.',
    loading: false,
    error: null,
    refetch: () => {},
  },
  error: {
    summary: null,
    loading: false,
    error: 'OpenAI API rate limit exceeded. Please try again later.',
    refetch: () => {},
  },
  noSummary: {
    summary: null,
    loading: false,
    error: null,
    refetch: () => {},
  },
};

export const Loading: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state while the AI summary is being generated.',
      },
    },
    mockData: mockUseRepositorySummary.loading,
  },
};

export const WithSummary: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
  },
  parameters: {
    docs: {
      description: {
        story: 'Displays a generated AI summary with repository insights and recent activity analysis.',
      },
    },
    mockData: mockUseRepositorySummary.withSummary,
  },
};

export const Error: Story = {
  args: {
    owner: 'facebook',
    repo: 'react',
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows error state when AI summary generation fails, with retry option.',
      },
    },
    mockData: mockUseRepositorySummary.error,
  },
};

export const NoSummary: Story = {
  args: {
    owner: 'unknown',
    repo: 'repo',
  },
  parameters: {
    docs: {
      description: {
        story: 'Component does not render when no summary is available and not loading.',
      },
    },
    mockData: mockUseRepositorySummary.noSummary,
  },
};