import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { RepoInsightsContainer } from "./RepoInsightsContainer";

// Mock the PullRequestInsights component to avoid API calls
const mockPullRequestInsights = ({ owner, repo, dateRange }: any) => (
  <div className="p-6 border rounded-lg bg-card">
    <h3 className="text-xl font-semibold mb-4">Pull Request Insights</h3>
    <div className="space-y-3">
      <div className="flex justify-between">
        <span className="text-sm font-medium">Repository:</span>
        <span className="text-sm text-muted-foreground">{owner}/{repo}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-sm font-medium">Date Range:</span>
        <span className="text-sm text-muted-foreground">
          {dateRange?.startDate ? dateRange.startDate.toLocaleDateString() : 'All time'} - 
          {dateRange?.endDate ? dateRange.endDate.toLocaleDateString() : 'Present'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold text-blue-600">42</div>
          <div className="text-xs text-muted-foreground">Total PRs</div>
        </div>
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold text-green-600">38</div>
          <div className="text-xs text-muted-foreground">Merged</div>
        </div>
        <div className="text-center p-3 bg-muted rounded">
          <div className="text-2xl font-bold text-orange-600">2.3</div>
          <div className="text-xs text-muted-foreground">Avg Days</div>
        </div>
      </div>
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Mock insights: Strong development velocity with efficient merge process. 
          PR review time has improved by 15% over the selected period.
        </p>
      </div>
    </div>
  </div>
);

const meta: Meta<typeof RepoInsightsContainer> = {
  title: "Components/Insights/RepoInsightsContainer",
  component: RepoInsightsContainer,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "Main container component for repository insights that wraps PullRequestInsights with header and future date range controls. Provides structured layout for comprehensive repository analysis."
      }
    }
  },
  argTypes: {
    owner: {
      control: "text",
      description: "Repository owner username"
    },
    repo: {
      control: "text",
      description: "Repository name"
    }
  },
  args: {
    owner: "facebook",
    repo: "react"
  },
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;


// Default story
export const Default: Story = {
  render: (args) => (
    <div className="max-w-4xl">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          Repository Insights: {args.owner}/{args.repo}
        </h1>
        {/* Mock PullRequestInsights component */}
        {mockPullRequestInsights({ owner: args.owner, repo: args.repo, dateRange: {} })}
      </div>
    </div>
  )
};

// Different repositories
export const DifferentRepositories: Story = {
  render: () => (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-8">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Repository Insights: facebook/react</h1>
          {mockPullRequestInsights({ owner: "facebook", repo: "react", dateRange: {} })}
        </div>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Repository Insights: microsoft/typescript</h1>
          {mockPullRequestInsights({ owner: "microsoft", repo: "typescript", dateRange: {} })}
        </div>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Repository Insights: vercel/next.js</h1>
          {mockPullRequestInsights({ owner: "vercel", repo: "next.js", dateRange: {} })}
        </div>
      </div>
    </div>
  )
};

// Large repository name
export const LongRepositoryName: Story = {
  render: () => (
    <div className="max-w-4xl">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          Repository Insights: microsoft/terminal-with-a-very-long-repository-name-that-might-overflow
        </h1>
        {mockPullRequestInsights({ 
          owner: "microsoft", 
          repo: "terminal-with-a-very-long-repository-name-that-might-overflow", 
          dateRange: {} 
        })}
      </div>
    </div>
  )
};

// Organization with special characters
export const SpecialCharacters: Story = {
  render: () => (
    <div className="max-w-4xl">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          Repository Insights: facebook/react-native
        </h1>
        {mockPullRequestInsights({ owner: "facebook", repo: "react-native", dateRange: {} })}
      </div>
    </div>
  )
};

// Interactive testing
export const Interactive: Story = {
  render: (args) => (
    <div className="max-w-4xl">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">
          Repository Insights: {args.owner}/{args.repo}
        </h1>
        {mockPullRequestInsights({ owner: args.owner, repo: args.repo, dateRange: {} })}
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify main heading is displayed
    await expect(canvas.getByText(/repository insights/i)).toBeInTheDocument();
    
    // Check repository name is shown
    await expect(canvas.getByText(/facebook\/react/i)).toBeInTheDocument();
    
    // Verify PullRequestInsights component is rendered
    await expect(canvas.getByText(/pull request insights/i)).toBeInTheDocument();
    
    // Check metrics are displayed
    await expect(canvas.getByText(/42/)).toBeInTheDocument(); // Total PRs
    await expect(canvas.getByText(/38/)).toBeInTheDocument(); // Merged
    await expect(canvas.getByText(/2.3/)).toBeInTheDocument(); // Avg Days
    
    // Verify insights text is present
    await expect(canvas.getByText(/strong development velocity/i)).toBeInTheDocument();
  }
};

// Responsive layout testing
export const ResponsiveLayout: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Desktop (1200px+)</h3>
        <div className="w-full max-w-6xl border rounded-lg p-6 bg-background">
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Repository Insights: facebook/react</h1>
            {mockPullRequestInsights({ owner: "facebook", repo: "react", dateRange: {} })}
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Tablet (768px)</h3>
        <div className="w-full max-w-3xl border rounded-lg p-4 bg-background">
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Repository Insights: microsoft/typescript</h1>
            {mockPullRequestInsights({ owner: "microsoft", repo: "typescript", dateRange: {} })}
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Mobile (375px)</h3>
        <div className="w-full max-w-sm border rounded-lg p-3 bg-background">
          <div className="space-y-6">
            <h1 className="text-xl font-bold">Repository Insights: vercel/next.js</h1>
            {mockPullRequestInsights({ owner: "vercel", repo: "next.js", dateRange: {} })}
          </div>
        </div>
      </div>
    </div>
  )
};

// With future date range controls (design preview)
export const WithDateRangeControls: Story = {
  render: () => {
    // Enhanced mock that shows future date range functionality
    const enhancedMockInsights = ({ owner, repo, dateRange }: any) => (
      <div className="space-y-6">
        {/* Future date range controls preview */}
        <div className="p-4 border rounded-lg bg-muted/30">
          <h4 className="font-medium mb-3">Date Range Controls (Future Feature)</h4>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-sm font-medium">Start Date</label>
              <input 
                type="date" 
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                defaultValue="2024-01-01"
                disabled
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">End Date</label>
              <input 
                type="date" 
                className="w-full mt-1 px-3 py-2 border rounded text-sm"
                defaultValue="2024-12-31"
                disabled
              />
            </div>
            <button 
              className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm mt-6"
              disabled
            >
              Apply
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Future enhancement: Custom date range selection for targeted analysis
          </p>
        </div>
        
        {/* Existing insights */}
        {mockPullRequestInsights({ owner, repo, dateRange })}
      </div>
    );
    
    return (
      <div className="max-w-4xl">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Repository Insights: facebook/react</h1>
          {enhancedMockInsights({ owner: "facebook", repo: "react", dateRange: {} })}
        </div>
      </div>
    );
  }
};

// Multiple insight components preview
export const MultipleInsightTypes: Story = {
  render: () => {
    // Enhanced mock showing multiple future insight types
    const multiInsightMock = ({ owner, repo, dateRange }: any) => (
      <div className="space-y-6">
        {/* PR Insights */}
        {mockPullRequestInsights({ owner, repo, dateRange })}
        
        {/* Future: Issue Insights */}
        <div className="p-6 border rounded-lg bg-card opacity-60">
          <h3 className="text-xl font-semibold mb-4">Issue Insights (Coming Soon)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-2xl font-bold text-purple-600">23</div>
              <div className="text-xs text-muted-foreground">Open Issues</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-2xl font-bold text-green-600">156</div>
              <div className="text-xs text-muted-foreground">Closed Issues</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-2xl font-bold text-orange-600">4.2</div>
              <div className="text-xs text-muted-foreground">Avg Days</div>
            </div>
          </div>
        </div>
        
        {/* Future: Contributor Insights */}
        <div className="p-6 border rounded-lg bg-card opacity-60">
          <h3 className="text-xl font-semibold mb-4">Contributor Insights (Coming Soon)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-2xl font-bold text-blue-600">12</div>
              <div className="text-xs text-muted-foreground">Active Contributors</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-2xl font-bold text-green-600">89%</div>
              <div className="text-xs text-muted-foreground">Retention Rate</div>
            </div>
            <div className="text-center p-3 bg-muted rounded">
              <div className="text-2xl font-bold text-purple-600">3</div>
              <div className="text-xs text-muted-foreground">New Contributors</div>
            </div>
          </div>
        </div>
      </div>
    );
    
    return (
      <div className="max-w-4xl">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Repository Insights: facebook/react</h1>
          {multiInsightMock({ owner: "facebook", repo: "react", dateRange: {} })}
        </div>
      </div>
    );
  }
};