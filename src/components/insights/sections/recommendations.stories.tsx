import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';

// Create a simple mock recommendations component for Storybook
const MockRecommendations = ({
  owner,
  repo,
  timeRange,
  variant = 'default',
}: {
  owner: string;
  repo: string;
  timeRange: string;
  variant?: 'default' | 'loading' | 'error' | 'unavailable' | 'low-confidence' | 'high-priority';
}) => {
  if (variant === 'loading') {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-xl font-semibold mb-4">AI Recommendations</h3>
        <div className="space-y-4">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'error') {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-xl font-semibold mb-4">AI Recommendations</h3>
        <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            Failed to generate recommendations. Using fallback analysis.
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'unavailable') {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-xl font-semibold mb-4">Recommendations</h3>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            AI insights unavailable. Showing rule-based recommendations.
          </p>
          <ul className="mt-2 text-sm space-y-1">
            <li>• Monitor PR merge times and establish review SLAs</li>
            <li>• Consider breaking down large PRs to increase velocity</li>
          </ul>
        </div>
      </div>
    );
  }

  const confidence = variant === 'low-confidence' ? 40 : variant === 'high-priority' ? 95 : 85;
  const content =
    variant === 'low-confidence'
      ? 'Based on limited data, consider reviewing your PR workflow. More analysis may be needed for specific recommendations.'
      : variant === 'high-priority'
        ? '🚨 Critical: Your repository has security vulnerabilities in dependencies and review coverage below 50%. Immediate action required: 1) Update all dependencies with security patches 2) Implement mandatory code review policy 3) Add automated security scanning to CI/CD pipeline.'
        : 'Based on the repository metrics, I recommend focusing on reducing PR review time from 2.3 days to under 1 day. Consider implementing automated PR size limits and establishing reviewer assignment rules to improve workflow efficiency.';

  const bgColor =
    variant === 'high-priority' ? 'bg-red-50 dark:bg-red-950' : 'bg-blue-50 dark:bg-blue-950';
  const textColor =
    variant === 'high-priority'
      ? 'text-red-800 dark:text-red-200'
      : 'text-blue-800 dark:text-blue-200';
  const badgeColor =
    variant === 'high-priority'
      ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
      : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200';

  return (
    <div className="p-6 border rounded-lg bg-card">
      <h3 className="text-xl font-semibold mb-4">AI Recommendations</h3>
      <div className="space-y-4">
        <div className={`p-4 ${bgColor} rounded-lg`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${textColor}`}>
              {variant === 'high-priority' ? 'Critical Alert' : 'AI Insight'}
            </span>
            <span className={`text-xs ${badgeColor} px-2 py-1 rounded`}>
              {confidence}% confident
            </span>
          </div>
          <p className={`text-sm ${textColor}`}>{content}</p>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium">
            Repository: {owner}/{repo}
          </h4>
          <p className="text-sm text-muted-foreground">Time range: {timeRange}</p>
          <div className="space-y-2">
            <h4 className="font-medium">Recommended Actions:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              {variant === 'high-priority' ? (
                <>
                  <li>• Update all dependencies with security patches</li>
                  <li>• Implement mandatory code review policy</li>
                  <li>• Add automated security scanning</li>
                </>
              ) : (
                <>
                  <li>• Implement automated dependency updates</li>
                  <li>• Add PR size guidelines to improve review speed</li>
                  <li>• Set up review assignment automation</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof MockRecommendations> = {
  title: 'Components/Insights/Recommendations',
  component: MockRecommendations,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'AI-powered recommendations component that provides actionable insights for repository improvement based on health metrics, trends, and activity patterns.',
      },
    },
  },
  argTypes: {
    owner: {
      control: 'text',
      description: 'Repository owner username',
    },
    repo: {
      control: 'text',
      description: 'Repository name',
    },
    timeRange: {
      control: 'select',
      options: ['7d', '30d', '90d', '1y'],
      description: 'Time range for analysis',
    },
    variant: {
      control: 'select',
      options: ['default', 'loading', 'error', 'unavailable', 'low-confidence', 'high-priority'],
      description: 'Component state variant',
    },
  },
  args: {
    owner: 'facebook',
    repo: 'react',
    timeRange: '30d',
    variant: 'default',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with successful AI response
export const Default: Story = {};

// Story showing loading state
export const Loading: Story = {
  args: {
    variant: 'loading',
  },
};

// Story showing AI service unavailable (fallback mode)
export const LLMUnavailable: Story = {
  args: {
    variant: 'unavailable',
  },
};

// Story with low confidence AI recommendations
export const LowConfidence: Story = {
  args: {
    variant: 'low-confidence',
  },
};

// Story with high-priority recommendations
export const HighPriority: Story = {
  args: {
    variant: 'high-priority',
  },
};

// Story showing error state
export const Error: Story = {
  args: {
    variant: 'error',
  },
};

// Interactive test story
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Wait for component to load
    await expect(canvas.getByText('AI Recommendations')).toBeInTheDocument();

    // Check that AI insight is displayed
    await expect(canvas.getByText(/Based on the repository metrics/)).toBeInTheDocument();

    // Verify confidence badge is shown
    await expect(canvas.getByText('85% confident')).toBeInTheDocument();

    // Check repository info is displayed
    await expect(canvas.getByText(/facebook\/react/)).toBeInTheDocument();
  },
};

// Story with different time ranges to test variation
export const DifferentTimeRanges: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">7 Days</h3>
        <div className="max-w-2xl">
          <MockRecommendations owner="facebook" repo="react" timeRange="7d" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">30 Days</h3>
        <div className="max-w-2xl">
          <MockRecommendations owner="facebook" repo="react" timeRange="30d" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">1 Year</h3>
        <div className="max-w-2xl">
          <MockRecommendations owner="facebook" repo="react" timeRange="1y" />
        </div>
      </div>
    </div>
  ),
};
