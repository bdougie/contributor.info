import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, UserCheck, TrendingUp, TrendingDown } from '@/components/ui/icon';

// Mock data for different scenarios
const mockStatsData = {
  highExternal: {
    external_contribution_rate: 75.5,
    internal_contribution_rate: 24.5,
    external_contributors: 45,
    internal_contributors: 8,
    total_contributors: 53,
    external_prs: 151,
    internal_prs: 49,
    total_prs: 200,
    analysis_period_days: 30,
  },
  balanced: {
    external_contribution_rate: 52.3,
    internal_contribution_rate: 47.7,
    external_contributors: 28,
    internal_contributors: 12,
    total_contributors: 40,
    external_prs: 89,
    internal_prs: 81,
    total_prs: 170,
    analysis_period_days: 30,
  },
  lowExternal: {
    external_contribution_rate: 18.2,
    internal_contribution_rate: 81.8,
    external_contributors: 6,
    internal_contributors: 15,
    total_contributors: 21,
    external_prs: 22,
    internal_prs: 99,
    total_prs: 121,
    analysis_period_days: 30,
  },
  smallProject: {
    external_contribution_rate: 33.3,
    internal_contribution_rate: 66.7,
    external_contributors: 2,
    internal_contributors: 3,
    total_contributors: 5,
    external_prs: 4,
    internal_prs: 8,
    total_prs: 12,
    analysis_period_days: 30,
  },
  noActivity: {
    external_contribution_rate: 0,
    internal_contribution_rate: 0,
    external_contributors: 0,
    internal_contributors: 0,
    total_contributors: 0,
    external_prs: 0,
    internal_prs: 0,
    total_prs: 0,
    analysis_period_days: 30,
  },
};

// Simplified story component that accepts mock data as props
const SelfSelectionRateStory = ({
  mockStats = mockStatsData.highExternal,
  mockTrend = null,
  loading = false,
  error = null,
  className,
}: unknown) => {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-20 w-full bg-muted animate-pulse rounded" />
          <div className="h-20 w-full bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (_error || !mockStats) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Self-Selection Rate</CardTitle>
          <CardDescription>{error || 'Unable to calculate statistics'}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Self-Selection Rate
          {mockTrend !== null && (
            <span className="flex items-center text-sm font-normal">
              {mockTrend > 0
? (
                <>
                  <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                  <span className="text-green-600">+{mockTrend.toFixed(1)}%</span>
                </>
              )
: (
                <>
                  <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                  <span className="text-red-600">{mockTrend.toFixed(1)}%</span>
                </>
              )}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          External vs internal contributions over the last {mockStats.analysis_period_days} days
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main metric */}
        <div className="text-center">
          <div className="text-4xl font-bold">
            {mockStats.external_contribution_rate.toFixed(1)}%
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            of contributions from external contributors
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>External</span>
            <span>Internal</span>
          </div>
          <Progress value={mockStats.external_contribution_rate} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{mockStats.external_prs} PRs</span>
            <span>{mockStats.internal_prs} PRs</span>
          </div>
        </div>

        {/* Contributor breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">External</span>
            </div>
            <div className="text-2xl font-semibold">{mockStats.external_contributors}</div>
            <p className="text-xs text-muted-foreground">contributors</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Internal</span>
            </div>
            <div className="text-2xl font-semibold">{mockStats.internal_contributors}</div>
            <p className="text-xs text-muted-foreground">maintainers/owners</p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="pt-4 border-t">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total PRs</span>
            <span className="font-medium">{mockStats.total_prs}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted-foreground">Total Contributors</span>
            <span className="font-medium">{mockStats.total_contributors}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const meta: Meta<typeof SelfSelectionRateStory> = {
  title: 'Components/SelfSelectionRate',
  component: SelfSelectionRateStory,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Displays the self-selection rate showing the percentage of contributions from external vs internal contributors with trend analysis.',
      },
    },
  },
  argTypes: {
    mockStats: { control: 'object' },
    mockTrend: { control: 'number' },
    loading: { control: 'boolean' },
    error: { control: 'text' },
    className: { control: 'text' },
  },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SelfSelectionRateStory>;

export const HighExternalContributions: Story = {
  args: {
    mockStats: mockStatsData.highExternal,
    mockTrend: 7.2,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A healthy open source project with 75.5% external contributions, showing strong community engagement.',
      },
    },
  },
};

export const BalancedContributions: Story = {
  args: {
    mockStats: mockStatsData.balanced,
    mockTrend: -1.5,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A balanced project with roughly equal external (52.3%) and internal (47.7%) contributions.',
      },
    },
  },
};

export const LowExternalContributions: Story = {
  args: {
    mockStats: mockStatsData.lowExternal,
    mockTrend: null,
  },
  parameters: {
    docs: {
      description: {
        story:
          'A project with mostly internal contributions (81.8%), typical of company-internal or specialized projects.',
      },
    },
  },
};

export const SmallProject: Story = {
  args: {
    mockStats: mockStatsData.smallProject,
    mockTrend: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'A small project with low activity - only 12 total PRs from 5 contributors.',
      },
    },
  },
};

export const NoActivity: Story = {
  args: {
    mockStats: mockStatsData.noActivity,
    mockTrend: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'A project with no recent activity - 0 contributions in the last 30 days.',
      },
    },
  },
};

export const WithUpwardTrend: Story = {
  args: {
    mockStats: mockStatsData.highExternal,
    mockTrend: 12.4,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows a positive trend with external contributions increasing significantly (+12.4%).',
      },
    },
  },
};

export const WithDownwardTrend: Story = {
  args: {
    mockStats: mockStatsData.balanced,
    mockTrend: -8.7,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows a negative trend with external contributions decreasing (-8.7%).',
      },
    },
  },
};

export const LoadingState: Story = {
  args: {
    loading: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the loading state with skeleton placeholders while data is being fetched.',
      },
    },
  },
};

export const ErrorState: Story = {
  args: {
    error: 'Failed to calculate self-selection rate',
    mockStats: null,
  },
  parameters: {
    docs: {
      description: {
        story: 'Shows the error state when data cannot be loaded.',
      },
    },
  },
};

export const ComparisonGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-6 w-[800px]">
      <SelfSelectionRateStory mockStats={mockStatsData.highExternal} mockTrend={5.2} />
      <SelfSelectionRateStory mockStats={mockStatsData.lowExternal} mockTrend={-2.1} />
      <SelfSelectionRateStory mockStats={mockStatsData.balanced} mockTrend={null} />
      <SelfSelectionRateStory mockStats={mockStatsData.smallProject} mockTrend={null} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison showing different self-selection rates across various project types.',
      },
    },
  },
};
