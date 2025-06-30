import type { Meta, StoryObj } from "@storybook/react";
import { MetricsAndTrendsCard } from "./metrics-and-trends-card";

// Mock the insights modules to avoid API calls
vi.mock("@/lib/insights/trends-metrics", () => ({
  calculateTrendMetrics: vi.fn().mockResolvedValue([
    {
      metric: "Active Contributors",
      current: "12",
      change: 20,
      trend: "up" as const,
      insight: "3 new contributors this month",
      unit: "people"
    },
    {
      metric: "PR Velocity",
      current: "2.4",
      change: -10,
      trend: "down" as const,
      insight: "Slightly slower than last month",
      unit: "days"
    },
    {
      metric: "Review Coverage",
      current: "85",
      change: 5,
      trend: "up" as const,
      insight: "More PRs getting reviewed",
      unit: "%"
    },
    {
      metric: "Merge Rate",
      current: "92",
      change: 0,
      trend: "stable" as const,
      insight: "Consistent merge rate",
      unit: "%"
    }
  ])
}));

vi.mock("@/lib/insights/pr-activity-metrics", () => ({
  calculatePrActivityMetrics: vi.fn().mockResolvedValue({
    openPRs: 8,
    totalPRs: 45,
    averageMergeTime: 2.5,
    averageMergeTimeTrend: -15,
    velocity: {
      current: 2.4,
      previous: 2.8,
      change: -14
    }
  })
}));

const meta = {
  title: "Features/Activity/MetricsAndTrendsCard",
  component: MetricsAndTrendsCard,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A comprehensive card that displays key metrics and trends for repository activity, including PR counts, merge times, velocity, and trend analysis."
      }
    }
  },
  tags: ["autodocs"],
  argTypes: {
    owner: {
      control: "text",
      description: "Repository owner/organization name"
    },
    repo: {
      control: "text", 
      description: "Repository name"
    },
    timeRange: {
      control: "select",
      options: ["30d", "90d", "6m", "1y"],
      description: "Time range for metrics calculation"
    }
  }
} satisfies Meta<typeof MetricsAndTrendsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    owner: "facebook",
    repo: "react",
    timeRange: "30d"
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  )
};

export const LargeRepository: Story = {
  args: {
    owner: "microsoft",
    repo: "vscode",
    timeRange: "30d"
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  )
};

export const LongerTimeRange: Story = {
  args: {
    owner: "vercel",
    repo: "next.js",
    timeRange: "90d"
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  )
};

export const YearlyView: Story = {
  args: {
    owner: "nodejs",
    repo: "node",
    timeRange: "1y"
  },
  render: (args) => (
    <div className="w-[800px] p-4">
      <MetricsAndTrendsCard {...args} />
    </div>
  )
};

export const Loading: Story = {
  args: {
    owner: "loading",
    repo: "repo",
    timeRange: "30d"
  },
  parameters: {
    msw: {
      handlers: []
    }
  },
  render: (args) => {
    // Override the mocks to simulate loading state
    vi.mock("@/lib/insights/trends-metrics", () => ({
      calculateTrendMetrics: vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      )
    }));
    
    vi.mock("@/lib/insights/pr-activity-metrics", () => ({
      calculatePrActivityMetrics: vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 10000))
      )
    }));

    return (
      <div className="w-[800px] p-4">
        <MetricsAndTrendsCard {...args} />
      </div>
    );
  }
};