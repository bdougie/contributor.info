import type { Meta, StoryObj } from "@storybook/react";
import TestInsights from "./test-insights";

// Mock the insights analyzePullRequests function
vi.mock("@/lib/insights/pullRequests", () => ({
  analyzePullRequests: vi.fn().mockResolvedValue({
    totalPRs: 15,
    averageTimeToMerge: 48,
    prMergeTimesByAuthor: {
      "alice": [24, 36, 48],
      "bob": [12, 72, 36], 
      "carol": [60, 24]
    },
    prsByAuthor: {
      "alice": 3,
      "bob": 3,
      "carol": 2
    },
    insights: {
      fastestMerger: "bob",
      mostActive: "alice",
      bottlenecks: ["carol"]
    }
  })
}));

// Mock the RepoInsightsContainer component
vi.mock("@/components/insights/RepoInsightsContainer", () => ({
  RepoInsightsContainer: ({ owner, repo }: { owner: string, repo: string }) => (
    <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
      <h3 className="text-lg font-semibold mb-2">Repository Insights Preview</h3>
      <p className="text-muted-foreground mb-4">
        Showing insights for <code>{owner}/{repo}</code>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="font-semibold text-green-900">Total PRs</div>
          <div className="text-2xl font-bold text-green-700">15</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="font-semibold text-blue-900">Avg Merge Time</div>
          <div className="text-2xl font-bold text-blue-700">48h</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-3">
          <div className="font-semibold text-purple-900">Active Contributors</div>
          <div className="text-2xl font-bold text-purple-700">3</div>
        </div>
      </div>
    </div>
  )
}));

// Mock environment variables
const mockEnv = {
  VITE_SUPABASE_URL: 'https://test.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'test-anon-key',
};

Object.defineProperty(import.meta, 'env', {
  value: mockEnv,
  writable: true,
});

const meta = {
  title: "Features/Auth/TestInsights",
  component: TestInsights,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A comprehensive testing interface for debugging and validating insights functionality. Includes testing for both legacy Supabase functions and new local implementations, with interactive component previews."
      }
    }
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TestInsights>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[900px] p-4">
      <TestInsights />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Default testing interface showing all tabs for insights testing."
      }
    }
  }
};

export const LocalImplementationSuccess: Story = {
  render: () => {
    // Mock successful local implementation
    vi.mock("@/lib/insights/pullRequests", () => ({
      analyzePullRequests: vi.fn().mockResolvedValue({
        totalPRs: 25,
        averageTimeToMerge: 32,
        prMergeTimesByAuthor: {
          "alice": [24, 36, 48, 12],
          "bob": [12, 72, 36, 24, 18], 
          "carol": [60, 24, 48]
        },
        prsByAuthor: {
          "alice": 4,
          "bob": 5,
          "carol": 3
        },
        insights: {
          fastestMerger: "bob",
          mostActive: "bob", 
          bottlenecks: []
        }
      })
    }));

    return (
      <div className="w-[900px] p-4">
        <TestInsights />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Testing interface with successful local implementation results."
      }
    }
  }
};

export const LocalImplementationError: Story = {
  render: () => {
    // Mock failed local implementation
    vi.mock("@/lib/insights/pullRequests", () => ({
      analyzePullRequests: vi.fn().mockRejectedValue(
        new Error("API rate limit exceeded. Please try again later.")
      )
    }));

    return (
      <div className="w-[900px] p-4">
        <TestInsights />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Testing interface showing error handling for failed analysis."
      }
    }
  }
};

export const SupabaseFunctionTest: Story = {
  render: () => {
    // Mock fetch for Supabase function testing
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json'
      }),
      json: () => Promise.resolve({
        success: true,
        data: {
          totalPRs: 30,
          averageTimeToMerge: 40,
          prMergeTimesByAuthor: {
            "maintainer1": [24, 12, 36],
            "contributor1": [48, 60, 72]
          }
        }
      })
    });

    return (
      <div className="w-[900px] p-4">
        <TestInsights />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Testing interface for legacy Supabase function with successful response."
      }
    }
  }
};

export const SupabaseFunctionError: Story = {
  render: () => {
    // Mock fetch error for Supabase function
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({
        'content-type': 'application/json'
      }),
      json: () => Promise.resolve({
        error: "Rate limit exceeded"
      })
    });

    return (
      <div className="w-[900px] p-4">
        <TestInsights />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Testing interface showing error handling for Supabase function failures."
      }
    }
  }
};

export const ComponentPreview: Story = {
  render: () => (
    <div className="w-[900px] p-4">
      <TestInsights />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Focus on the component preview tab showing how insights look in the actual UI."
      }
    }
  }
};

export const LoadingStates: Story = {
  render: () => {
    // Mock slow loading for demonstration
    vi.mock("@/lib/insights/pullRequests", () => ({
      analyzePullRequests: vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          totalPRs: 20,
          averageTimeToMerge: 36,
          prMergeTimesByAuthor: {},
          prsByAuthor: {}
        }), 5000))
      )
    }));

    global.fetch = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ success: true, data: {} })
      }), 5000))
    );

    return (
      <div className="w-[900px] p-4">
        <TestInsights />
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Click any test button to see loading states
        </div>
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Testing interface demonstrating loading states for all operations."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => (
    <div className="w-full p-4">
      <TestInsights />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Testing interface on mobile devices."
      }
    }
  }
};