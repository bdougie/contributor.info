import type { Meta, StoryObj } from "@storybook/react";
import { within, userEvent, expect } from "@storybook/test";
import PRActivity from "./pr-activity";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import type { PullRequest } from "@/lib/types";
import { designTokens } from "../../../../.storybook/design-tokens";

// Helper function to create mock pull requests with varied activity
const createMockPR = (
  id: number,
  login: string,
  title: string,
  state: "open" | "closed",
  daysAgo: number,
  isBot: boolean = false,
  hasReviews: boolean = true,
  hasComments: boolean = true,
  isDraft: boolean = false,
  labels: string[] = []
): PullRequest => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  const reviews = hasReviews
    ? [
        {
          id: id * 100,
          state: "approved",
          user: {
            login: `reviewer${id}`,
            avatar_url: `https://avatars.githubusercontent.com/u/${
              id + 1000
            }?v=4`,
          },
          submitted_at: new Date(date.getTime() + 3600000).toISOString(), // 1 hour later
        },
        {
          id: id * 101,
          state: "changes_requested",
          user: {
            login: `reviewer${id + 1}`,
            avatar_url: `https://avatars.githubusercontent.com/u/${
              id + 1001
            }?v=4`,
          },
          submitted_at: new Date(date.getTime() + 7200000).toISOString(), // 2 hours later
        },
      ]
    : [];

  const comments = hasComments
    ? [
        {
          id: id * 200,
          user: {
            login: `commenter${id}`,
            avatar_url: `https://avatars.githubusercontent.com/u/${
              id + 2000
            }?v=4`,
          },
          created_at: new Date(date.getTime() + 7200000).toISOString(), // 2 hours later
        },
        {
          id: id * 201,
          user: {
            login: `commenter${id + 1}`,
            avatar_url: `https://avatars.githubusercontent.com/u/${
              id + 2001
            }?v=4`,
          },
          created_at: new Date(date.getTime() + 10800000).toISOString(), // 3 hours later
        },
      ]
    : [];

  return {
    id,
    number: id,
    title,
    state,
    created_at: date.toISOString(),
    updated_at: new Date(date.getTime() + 10800000).toISOString(), // 3 hours later
    merged_at:
      state === "closed" && !isDraft
        ? new Date(date.getTime() + 14400000).toISOString()
        : null, // 4 hours later
    additions: Math.floor(Math.random() * 200) + 10,
    deletions: Math.floor(Math.random() * 50) + 1,
    repository_owner: "test-org",
    repository_name: "test-repo",
    user: {
      id: id,
      login,
      avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
      type: isBot ? "Bot" : "User",
    },
    html_url: `https://github.com/test-org/test-repo/pull/${id}`,
    reviews,
    comments,
    draft: isDraft,
    labels: labels.map((name, i) => ({
      id: id * 1000 + i,
      name,
      color: ["#0366d6", "#d73a4a", "#0e8a16", "#ffd33d"][i % 4],
    })),
  };
};

// Recent active dataset with varied activity types
const recentActivityDataset: PullRequest[] = [
  createMockPR(
    1,
    "alice",
    "Add user authentication system",
    "closed",
    1,
    false,
    true,
    true,
    false,
    ["enhancement", "backend"]
  ),
  createMockPR(
    2,
    "bob",
    "Fix navigation bug on mobile",
    "open",
    2,
    false,
    true,
    false,
    false,
    ["bug", "mobile"]
  ),
  createMockPR(
    3,
    "carol",
    "Update documentation for API endpoints",
    "closed",
    3,
    false,
    false,
    true,
    false,
    ["documentation"]
  ),
  createMockPR(
    4,
    "dave",
    "Implement dark mode toggle",
    "open",
    4,
    false,
    true,
    true,
    false,
    ["enhancement", "ui"]
  ),
  createMockPR(
    5,
    "eve",
    "Refactor database connection pool",
    "closed",
    5,
    false,
    true,
    false,
    false,
    ["refactor", "performance"]
  ),
];

// Dataset with bot activity
const datasetWithBots: PullRequest[] = [
  ...recentActivityDataset.slice(0, 3),
  createMockPR(
    9,
    "dependabot[bot]",
    "Bump axios from 0.21.1 to 0.21.4",
    "closed",
    1,
    true,
    false,
    false,
    false,
    ["dependencies", "security"]
  ),
  createMockPR(
    10,
    "renovate[bot]",
    "Update dependency react to v18.2.0",
    "open",
    2,
    true,
    false,
    false,
    false,
    ["dependencies"]
  ),
  createMockPR(
    11,
    "github-actions[bot]",
    "Auto-update package-lock.json",
    "closed",
    3,
    true,
    false,
    false,
    false,
    ["automated"]
  ),
];

// Large active repository dataset
const highActivityDataset: PullRequest[] = Array.from(
  { length: 30 },
  (_, i) => {
    const contributors = [
      "alice",
      "bob",
      "carol",
      "dave",
      "eve",
      "frank",
      "grace",
      "henry",
      "iris",
      "jack",
    ];
    const contributor = contributors[i % contributors.length];
    const titles = [
      "Add new feature for user management",
      "Fix critical security vulnerability",
      "Improve performance of search functionality",
      "Update dependencies to latest versions",
      "Refactor authentication middleware",
      "Add comprehensive test coverage",
      "Fix UI inconsistencies across browsers",
      "Implement caching for API responses",
      "Add internationalization support",
      "Optimize database query performance",
    ];
    const title = `${titles[i % titles.length]} (#${i + 1})`;
    const state = Math.random() > 0.3 ? "closed" : "open";
    const daysAgo = Math.floor(Math.random() * 14) + 1; // Within last 2 weeks
    const hasReviews = Math.random() > 0.2; // 80% have reviews
    const hasComments = Math.random() > 0.3; // 70% have comments
    const labels = i % 3 === 0
? ["bug", "high-priority"] : 
                   i % 2 === 0 ? ["enhancement"] : [];

    return createMockPR(
      i + 1,
      contributor,
      title,
      state,
      daysAgo,
      false,
      hasReviews,
      hasComments,
      false,
      labels
    );
  }
);

// Draft PRs dataset
const draftPRsDataset: PullRequest[] = [
  createMockPR(1, "alice", "[WIP] New payment integration", "open", 1, false, false, true, true, ["draft", "payment"]),
  createMockPR(2, "bob", "[Draft] Refactor authentication", "open", 2, false, false, false, true, ["draft", "refactor"]),
  createMockPR(3, "carol", "Ready for review: API updates", "open", 3, false, true, true, false, ["ready"]),
  createMockPR(4, "dave", "[Draft] Experimental feature", "open", 4, false, false, true, true, ["draft", "experimental"]),
];

// Long-running PRs dataset
const longRunningPRsDataset: PullRequest[] = [
  createMockPR(1, "alice", "Major architectural refactor", "open", 45, false, true, true, false, ["refactor", "breaking-change"]),
  createMockPR(2, "bob", "Legacy system migration", "open", 60, false, true, true, false, ["migration", "long-running"]),
  createMockPR(3, "carol", "Performance optimization initiative", "open", 30, false, true, true, false, ["performance"]),
  createMockPR(4, "dave", "Security audit implementation", "open", 25, false, true, false, false, ["security", "audit"]),
];

// Conflicted PRs dataset
const conflictedPRsDataset: PullRequest[] = [
  createMockPR(1, "alice", "Feature branch with conflicts", "open", 3, false, true, true, false, ["has-conflicts", "needs-rebase"]),
  createMockPR(2, "bob", "Merge conflict in main files", "open", 5, false, false, true, false, ["has-conflicts", "blocked"]),
  createMockPR(3, "carol", "Resolved conflicts - ready to merge", "open", 1, false, true, false, false, ["resolved"]),
];

// Minimal activity dataset
const minimalActivityDataset: PullRequest[] = [
  createMockPR(1, "alice", "Initial commit", "closed", 10, false, false, false),
  createMockPR(2, "bob", "Add README", "closed", 8, false, false, true),
];

const emptyDataset: PullRequest[] = [];

const meta = {
  title: "Features/Activity/PRActivity",
  component: PRActivity,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A comprehensive pull request activity feed displaying PR lifecycle events including opening, closing, merging, reviews, and comments. Supports filtering, real-time updates, and various data states.",
      },
    },
  },
  argTypes: {
    includeBots: {
      control: "boolean",
      description: "Include bot-generated PRs in the activity feed",
      defaultValue: false,
    },
    maxItems: {
      control: { type: "number", min: 1, max: 100 },
      description: "Maximum number of PRs to display",
      defaultValue: 20,
    },
    refreshInterval: {
      control: { type: "number", min: 0, max: 60000 },
      description: "Auto-refresh interval in milliseconds (0 to disable)",
      defaultValue: 0,
    },
  },
  tags: ["autodocs", "activity", "real-time"],
} satisfies Meta<typeof PRActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: recentActivityDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const WithInteractions: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: recentActivityDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Wait for the component to render
    await expect(canvas.getByText(/alice/i)).toBeInTheDocument();
    
    // Test hovering over PR items
    const firstPR = canvas.getByText("Add user authentication system").closest('div');
    if (firstPR) {
      await userEvent.hover(firstPR);
      await userEvent.unhover(firstPR);
    }
    
    // Test clicking on a PR link if available
    const prLinks = canvas.getAllByRole('link');
    if (prLinks.length > 0) {
      await userEvent.hover(prLinks[0]);
    }
  },
};

export const WithBotActivity: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: datasetWithBots, loading: false, error: null },
        includeBots: true,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows activity feed including bot-generated PRs from Dependabot, Renovate, and GitHub Actions.",
      },
    },
  },
};

export const HighVolumeActivity: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: highActivityDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Demonstrates performance with 30+ concurrent PRs from multiple contributors.",
      },
    },
  },
};

export const DraftPRs: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: draftPRsDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows draft PRs and work-in-progress items with appropriate visual indicators.",
      },
    },
  },
};

export const LongRunningPRs: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: longRunningPRsDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Displays PRs that have been open for extended periods (25-60 days).",
      },
    },
  },
};

export const ConflictedPRs: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: conflictedPRsDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows PRs with merge conflicts and resolution status.",
      },
    },
  },
};

export const LoadingState: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: [], loading: true, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows loading skeleton while fetching PR data.",
      },
    },
  },
};

export const ErrorState: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: [],
          loading: false,
          error: "Failed to load activity data. Please check your connection and try again.",
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Displays error message when PR data fails to load.",
      },
    },
  },
};

export const EmptyState: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: emptyDataset, loading: false, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows empty state when no PRs exist for the repository.",
      },
    },
  },
};

export const MinimalActivity: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: minimalActivityDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[700px] h-[600px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story: "Shows activity feed with minimal PR activity.",
      },
    },
  },
};

export const MobileView: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: recentActivityDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[375px] h-[667px] p-2 touch-manipulation">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
    docs: {
      description: {
        story: "Mobile-optimized view with appropriate touch targets and responsive layout.",
      },
    },
  },
};

export const TabletView: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: recentActivityDataset,
          loading: false,
          error: null,
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[768px] h-[1024px] p-4">
        <PRActivity />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
    docs: {
      description: {
        story: "Tablet-optimized view with medium-sized layout.",
      },
    },
  },
};

export const DarkMode: Story = {
  render: () => (
    <div className="dark bg-gray-900 p-4">
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: recentActivityDataset,
            loading: false,
            error: null,
          },
          includeBots: false,
          setIncludeBots: () => {},
          lotteryFactor: null,
          directCommitsData: null,
        }}
      >
        <div className="w-[700px] h-[600px]">
          <PRActivity />
        </div>
      </RepoStatsContext.Provider>
    </div>
  ),
  parameters: {
    backgrounds: { default: "dark" },
    docs: {
      description: {
        story: "PR activity feed in dark mode with appropriate contrast and visibility.",
      },
    },
  },
};

export const RealTimeUpdates: Story = {
  render: () => {
    const [prs, setPrs] = React.useState(recentActivityDataset);
    
    React.useEffect(() => {
      const interval = setInterval(() => {
        // Simulate new PR arriving
        const newPR = createMockPR(
          Date.now(),
          "newuser",
          `Real-time update at ${new Date().toLocaleTimeString()}`,
          "open",
          0,
          false,
          false,
          true,
          false,
          ["new", "real-time"]
        );
        setPrs(prev => [newPR, ...prev].slice(0, 10));
      }, 5000);
      
      return () => clearInterval(interval);
    }, []);
    
    return (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: prs,
            loading: false,
            error: null,
          },
          includeBots: false,
          setIncludeBots: () => {},
          lotteryFactor: null,
          directCommitsData: null,
        }}
      >
        <div className="w-[700px] h-[600px] p-4">
          <PRActivity />
        </div>
      </RepoStatsContext.Provider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Simulates real-time PR updates arriving every 5 seconds.",
      },
    },
  },
};

export const FilteredByLabel: Story = {
  render: () => {
    const bugPRs = recentActivityDataset.filter(pr => 
      pr.labels?.some(label => label.name === "bug")
    );
    
    return (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: bugPRs,
            loading: false,
            error: null,
          },
          includeBots: false,
          setIncludeBots: () => {},
          lotteryFactor: null,
          directCommitsData: null,
        }}
      >
        <div className="w-[700px] h-[600px] p-4">
          <PRActivity />
        </div>
      </RepoStatsContext.Provider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Shows PRs filtered by specific labels (bug fixes in this example).",
      },
    },
  },
};

export const PerformanceTest: Story = {
  render: () => {
    const largeDataseet = Array.from({ length: 100 }, (_, i) => 
      createMockPR(
        i + 1,
        `user${i}`,
        `Performance test PR #${i + 1}`,
        Math.random() > 0.5 ? "open" : "closed",
        Math.floor(Math.random() * 30),
        i % 10 === 0, // Every 10th is a bot
        Math.random() > 0.3,
        Math.random() > 0.3
      )
    );
    
    return (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: largeDataseet,
            loading: false,
            error: null,
          },
          includeBots: true,
          setIncludeBots: () => {},
          lotteryFactor: null,
          directCommitsData: null,
        }}
      >
        <div className="w-[700px] h-[600px] p-4">
          <PRActivity />
        </div>
      </RepoStatsContext.Provider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: "Performance test with 100 PRs to verify smooth scrolling and rendering.",
      },
    },
  },
};

// Import React for the real-time story
import React from 'react';