import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import TestInsights from "./test-insights";

// Mock the insights analyzePullRequests function
// TODO: Mock @/lib/insights/pullRequests using Storybook's approach
// Original vi.mock replaced - needs manual review;

// Mock the RepoInsightsContainer component
// TODO: Mock @/components/insights/RepoInsightsContainer using Storybook's approach
// Original vi.mock replaced - needs manual review;

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
    // TODO: Mock @/lib/insights/pullRequests using Storybook's approach
// Original vi.mock replaced - needs manual review;

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
    // TODO: Mock @/lib/insights/pullRequests using Storybook's approach
// Original vi.mock replaced - needs manual review;

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
    global.fetch = fn().mockResolvedValue({
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
    global.fetch = fn().mockResolvedValue({
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
    // TODO: Mock @/lib/insights/pullRequests using Storybook's approach
// Original vi.mock replaced - needs manual review;

    global.fetch = fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ success: true, _data: {} })
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