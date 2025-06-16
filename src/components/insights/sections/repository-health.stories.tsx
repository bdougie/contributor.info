import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

// Create a simple mock repository health component for Storybook
const MockRepositoryHealth = ({ owner, repo, timeRange, variant = "excellent" }: { 
  owner: string; 
  repo: string; 
  timeRange: string;
  variant?: "excellent" | "poor" | "warning" | "loading" | "error" | "llm-unavailable" | "low-confidence";
}) => {
  if (variant === "loading") {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-xl font-semibold mb-4">Repository Health</h3>
        <div className="space-y-4">
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "error") {
    return (
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="text-xl font-semibold mb-4">Repository Health</h3>
        <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            Failed to fetch repository data. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  const healthData = {
    excellent: {
      score: 92,
      trend: "improving",
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
      textColor: "text-green-800 dark:text-green-200",
      factors: [
        { name: "Review Coverage", score: 95, status: "excellent" },
        { name: "Response Time", score: 88, status: "good" },
        { name: "Merge Success Rate", score: 96, status: "excellent" },
      ],
      insight: "Outstanding repository health! Your team maintains excellent development practices with 98% review coverage and rapid response times.",
      confidence: 92
    },
    poor: {
      score: 34,
      trend: "declining",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
      textColor: "text-red-800 dark:text-red-200",
      factors: [
        { name: "Review Coverage", score: 25, status: "critical" },
        { name: "Response Time", score: 15, status: "critical" },
        { name: "Merge Success Rate", score: 68, status: "warning" },
      ],
      insight: "⚠️ Critical attention needed: Your repository health is significantly below recommended levels. Immediate action required.",
      confidence: 89
    },
    warning: {
      score: 67,
      trend: "stable",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950", 
      textColor: "text-yellow-800 dark:text-yellow-200",
      factors: [
        { name: "Review Coverage", score: 75, status: "good" },
        { name: "Response Time", score: 45, status: "warning" },
        { name: "Merge Success Rate", score: 82, status: "good" },
      ],
      insight: "Your repository health shows room for improvement. Focus on streamlining the review process.",
      confidence: 76
    }
  };

  const data = variant === "low-confidence" 
    ? { ...healthData.warning, confidence: 35, insight: "Based on limited data, your repository appears to have mixed health indicators." }
    : variant === "llm-unavailable" ? healthData.excellent
    : healthData[variant as keyof typeof healthData] || healthData.excellent;

  const showLLM = variant !== "llm-unavailable";

  return (
    <div className="p-6 border rounded-lg bg-card">
      <h3 className="text-xl font-semibold mb-4">Repository Health</h3>
      
      {/* Health Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-2xl font-bold">{data.score}/100</span>
          <span className={`text-sm font-medium ${data.color}`}>
            {data.trend}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${data.score >= 80 ? 'bg-green-500' : data.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${data.score}%` }}
          />
        </div>
      </div>

      {/* Health Factors */}
      <div className="space-y-3 mb-6">
        <h4 className="font-medium">Health Factors</h4>
        {data.factors.map((factor: any, index: number) => (
          <div key={index} className="flex items-center justify-between">
            <span className="text-sm">{factor.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{factor.score}/100</span>
              <span className={`text-xs px-2 py-1 rounded ${
                factor.status === 'excellent' ? 'bg-green-100 text-green-800' :
                factor.status === 'good' ? 'bg-blue-100 text-blue-800' :
                factor.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {factor.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insight */}
      {showLLM && (
        <div className={`p-4 ${data.bgColor} rounded-lg`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-medium ${data.textColor}`}>AI Health Assessment</span>
            <span className={`text-xs px-2 py-1 rounded ${
              data.confidence >= 80 ? 'bg-green-200 text-green-800' : 
              data.confidence >= 60 ? 'bg-yellow-200 text-yellow-800' : 
              'bg-red-200 text-red-800'
            }`}>
              {data.confidence}% confident
            </span>
          </div>
          <p className={`text-sm ${data.textColor}`}>
            {data.insight}
          </p>
        </div>
      )}

      {/* Repository Info */}
      <div className="mt-4 text-sm text-muted-foreground">
        <p>Repository: {owner}/{repo} • Time range: {timeRange}</p>
      </div>
    </div>
  );
};

const meta: Meta<typeof MockRepositoryHealth> = {
  title: "Components/Insights/RepositoryHealth", 
  component: MockRepositoryHealth,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: "AI-powered repository health assessment component that analyzes multiple health factors and provides intelligent insights about repository maintainability, contributor engagement, and development workflow efficiency."
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
    },
    timeRange: {
      control: "select",
      options: ["7d", "30d", "90d", "1y"],
      description: "Time range for health analysis"
    },
    variant: {
      control: "select",
      options: ["excellent", "poor", "warning", "loading", "error", "llm-unavailable", "low-confidence"],
      description: "Health state variant"
    }
  },
  args: {
    owner: "facebook",
    repo: "react",
    timeRange: "30d",
    variant: "excellent"
  },
  tags: ["autodocs"]
};

export default meta;
type Story = StoryObj<typeof meta>;

// Excellent health repository
export const ExcellentHealth: Story = {};

// Poor health repository (needs immediate attention)
export const PoorHealth: Story = {
  args: {
    variant: "poor"
  }
};

// Warning state (moderate health with areas for improvement)
export const WarningHealth: Story = {
  args: {
    variant: "warning"
  }
};

// Loading state
export const Loading: Story = {
  args: {
    variant: "loading"
  }
};

// Error state
export const Error: Story = {
  args: {
    variant: "error"
  }
};

// LLM service unavailable (fallback mode)
export const LLMUnavailable: Story = {
  args: {
    variant: "llm-unavailable"
  }
};

// Low confidence LLM insight
export const LowConfidenceLLM: Story = {
  args: {
    variant: "low-confidence"
  }
};

// Interactive test story
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for component to load
    await expect(canvas.getByText(/repository health/i)).toBeInTheDocument();
    
    // Check health score is displayed
    await expect(canvas.getByText(/92/)).toBeInTheDocument();
    
    // Verify health factors are shown
    await expect(canvas.getByText(/review coverage/i)).toBeInTheDocument();
    await expect(canvas.getByText(/response time/i)).toBeInTheDocument();
    
    // Check AI insight is displayed
    await expect(canvas.getByText(/outstanding repository health/i)).toBeInTheDocument();
    
    // Verify confidence badge
    await expect(canvas.getByText(/92%/)).toBeInTheDocument();
  }
};

// Comparison view showing different health states
export const HealthComparison: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4 text-green-600">Excellent Health (Score: 92)</h3>
        <div className="max-w-2xl">
          <MockRepositoryHealth owner="facebook" repo="react" timeRange="30d" variant="excellent" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4 text-yellow-600">Warning Health (Score: 67)</h3>
        <div className="max-w-2xl">
          <MockRepositoryHealth owner="example" repo="moderate-repo" timeRange="30d" variant="warning" />
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4 text-red-600">Poor Health (Score: 34)</h3>
        <div className="max-w-2xl">
          <MockRepositoryHealth owner="example" repo="struggling-repo" timeRange="30d" variant="poor" />
        </div>
      </div>
    </div>
  )
};