import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";
import { getVariantValue } from '@/lib/utils/performance-helpers';

// Create a simple mock insights sidebar component for Storybook
const MockInsightsSidebar = ({ variant = "default" }: { 
  variant?: "default" | "collapsed" | "mobile" | "high-activity" | "low-activity";
}) => {
  const isCollapsed = variant === "collapsed";
  const isMobile = variant === "mobile";
  const criticalCount = getVariantValue(variant, 0, 8, 3);

  if (isMobile) {
    return (
      <div className="md:hidden">
        <button className="p-2 border rounded-lg bg-card">
          <span className="text-sm font-medium">Insights</span>
          {criticalCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
              {criticalCount}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className={`border-r bg-card transition-all duration-200 ${
      isCollapsed ? 'w-16' : 'w-80'
    } h-screen overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        {!isCollapsed && (
          <h2 className="font-semibold text-lg">Insights</h2>
        )}
        <button className="p-1 hover:bg-muted rounded">
          {isCollapsed ? '→' : '←'}
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Needs Attention */}
        <div className="space-y-2">
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm">Needs Attention</h3>
              {criticalCount > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                  {criticalCount}
                </span>
              )}
            </div>
          )}
          <div className={`${isCollapsed ? 'w-8 h-8' : 'h-20'} bg-muted rounded`}>
            {isCollapsed && criticalCount > 0 && (
              <div className="w-full h-full flex items-center justify-center">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              </div>
            )}
          </div>
        </div>

        {/* Repository Health */}
        <div className="space-y-2">
          {!isCollapsed && (
            <h3 className="font-medium text-sm">Repository Health</h3>
          )}
          <div className={`${isCollapsed ? 'w-8 h-8' : 'h-24'} bg-muted rounded`}>
            {!isCollapsed && (
              <div className="p-3">
                <div className="text-lg font-bold text-green-600">92/100</div>
                <div className="text-xs text-muted-foreground">Excellent</div>
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          {!isCollapsed && (
            <h3 className="font-medium text-sm">AI Recommendations</h3>
          )}
          <div className={`${isCollapsed ? 'w-8 h-8' : 'h-20'} bg-muted rounded`}>
            {!isCollapsed && (
              <div className="p-3">
                <div className="text-xs text-blue-600">3 recommendations</div>
                <div className="text-xs text-muted-foreground">85% confidence</div>
              </div>
            )}
          </div>
        </div>

        {/* Trends */}
        <div className="space-y-2">
          {!isCollapsed && (
            <h3 className="font-medium text-sm">Trends</h3>
          )}
          <div className={`${isCollapsed ? 'w-8 h-8' : 'h-16'} bg-muted rounded`}>
            {!isCollapsed && (
              <div className="p-3">
                <div className="text-xs text-green-600">↗ +15% velocity</div>
              </div>
            )}
          </div>
        </div>

        {/* PR Activity */}
        <div className="space-y-2">
          {!isCollapsed && (
            <h3 className="font-medium text-sm">PR Activity</h3>
          )}
          <div className={`${isCollapsed ? 'w-8 h-8' : 'h-16'} bg-muted rounded`}>
            {!isCollapsed && (
              <div className="p-3">
                <div className="text-xs">12 PRs this week</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const meta: Meta<typeof MockInsightsSidebar> = {
  title: "Components/Insights/InsightsSidebar",
  component: MockInsightsSidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: "Collapsible sidebar container that orchestrates all insight sections including health assessment, recommendations, trends, and critical PR alerts. Adapts to mobile with sheet overlay."
      }
    }
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "collapsed", "mobile", "high-activity", "low-activity"],
      description: "Sidebar state variant"
    }
  },
  args: {
    variant: "default"
  },
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default expanded sidebar
export const Default: Story = {
  render: () => (
    <div className="flex h-screen bg-background">
      <MockInsightsSidebar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Repository Dashboard</h1>
        <p className="text-muted-foreground">
          Main content area. The insights sidebar provides contextual information about repository health and recommendations.
        </p>
      </div>
    </div>
  )
};

// Collapsed sidebar state
export const Collapsed: Story = {
  render: () => (
    <div className="flex h-screen bg-background">
      <MockInsightsSidebar variant="collapsed" />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Repository Dashboard</h1>
        <p className="text-muted-foreground">
          Sidebar is collapsed to provide more space for the main content. Click the expand button to access insights.
        </p>
      </div>
    </div>
  )
};

// Mobile view
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile"
    }
  },
  render: () => (
    <div className="flex h-screen bg-background">
      <MockInsightsSidebar variant="mobile" />
      <div className="flex-1 p-4">
        <h1 className="text-xl font-bold mb-4">Repository Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          On mobile, insights are accessible through a slide-out sheet. Tap the insights button to view.
        </p>
      </div>
    </div>
  )
};

// High activity repository with critical alerts
export const HighActivity: Story = {
  render: () => (
    <div className="flex h-screen bg-background">
      <MockInsightsSidebar variant="high-activity" />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">High Activity Repository</h1>
        <p className="text-muted-foreground">
          This repository has high activity with 8 PRs needing immediate attention. Notice the alert indicators in the sidebar.
        </p>
      </div>
    </div>
  )
};

// Repository with no critical issues
export const LowActivity: Story = {
  render: () => (
    <div className="flex h-screen bg-background">
      <MockInsightsSidebar variant="low-activity" />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Low Activity Repository</h1>
        <p className="text-muted-foreground">
          This repository has minimal activity with no critical issues requiring attention.
        </p>
      </div>
    </div>
  )
};

// Interactive behavior testing
export const Interactive: Story = {
  render: () => (
    <div className="flex h-screen bg-background">
      <MockInsightsSidebar />
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-4">Interactive Sidebar Test</h1>
        <p className="text-muted-foreground">
          Test the interactive features of the insights sidebar.
        </p>
      </div>
    </div>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify sidebar is visible
    expect(canvas.getByText("Insights")).toBeInTheDocument();
    
    // Check for insight sections
    expect(canvas.getByText("Repository Health")).toBeInTheDocument();
    expect(canvas.getByText("AI Recommendations")).toBeInTheDocument();
    expect(canvas.getByText("Needs Attention")).toBeInTheDocument();
  }
};

// Responsive design showcase
export const ResponsiveDesign: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Desktop Layout</h3>
        <div className="w-full max-w-6xl h-96 border rounded-lg bg-background relative overflow-hidden">
          <div className="flex h-full">
            <MockInsightsSidebar />
            <div className="flex-1 p-6">
              <h2 className="text-xl font-bold">Desktop Layout</h2>
              <p className="text-muted-foreground">Full sidebar with all sections visible</p>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Collapsed Layout</h3>
        <div className="w-full max-w-6xl h-96 border rounded-lg bg-background relative overflow-hidden">
          <div className="flex h-full">
            <MockInsightsSidebar variant="collapsed" />
            <div className="flex-1 p-6">
              <h2 className="text-xl font-bold">Collapsed Layout</h2>
              <p className="text-muted-foreground">Minimized sidebar with icon indicators</p>
            </div>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">Mobile Layout</h3>
        <div className="w-full max-w-sm h-96 border rounded-lg bg-background relative overflow-hidden">
          <div className="flex h-full">
            <MockInsightsSidebar variant="mobile" />
            <div className="flex-1 p-3">
              <h2 className="text-base font-bold">Mobile Layout</h2>
              <p className="text-xs text-muted-foreground">Button trigger for sheet overlay</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
};