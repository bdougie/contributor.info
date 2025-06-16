import type { Meta, StoryObj } from "@storybook/react";
import PRActivity from "./pr-activity";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import type { PullRequest } from "@/lib/types";

// Helper function to create mock pull requests with varied activity
const createMockPR = (
  id: number,
  login: string,
  title: string,
  state: "open" | "closed",
  daysAgo: number,
  isBot: boolean = false,
  hasReviews: boolean = true,
  hasComments: boolean = true
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
      state === "closed"
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
    true
  ),
  createMockPR(
    2,
    "bob",
    "Fix navigation bug on mobile",
    "open",
    2,
    false,
    true,
    false
  ),
  createMockPR(
    3,
    "carol",
    "Update documentation for API endpoints",
    "closed",
    3,
    false,
    false,
    true
  ),
  createMockPR(
    4,
    "dave",
    "Implement dark mode toggle",
    "open",
    4,
    false,
    true,
    true
  ),
  createMockPR(
    5,
    "eve",
    "Refactor database connection pool",
    "closed",
    5,
    false,
    true,
    false
  ),
  createMockPR(
    6,
    "frank",
    "Add unit tests for user service",
    "open",
    6,
    false,
    false,
    true
  ),
  createMockPR(
    7,
    "grace",
    "Optimize image loading performance",
    "closed",
    7,
    false,
    true,
    true
  ),
  createMockPR(
    8,
    "henry",
    "Fix memory leak in WebSocket connection",
    "open",
    8,
    false,
    true,
    false
  ),
];

// Dataset with bot activity
const datasetWithBots: PullRequest[] = [
  ...recentActivityDataset.slice(0, 5),
  createMockPR(
    9,
    "dependabot[bot]",
    "Bump axios from 0.21.1 to 0.21.4",
    "closed",
    1,
    true,
    false,
    false
  ),
  createMockPR(
    10,
    "renovate[bot]",
    "Update dependency react to v18.2.0",
    "open",
    2,
    true,
    false,
    false
  ),
  createMockPR(
    11,
    "github-actions[bot]",
    "Auto-update package-lock.json",
    "closed",
    3,
    true,
    false,
    false
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

    return createMockPR(
      i + 1,
      contributor,
      title,
      state,
      daysAgo,
      false,
      hasReviews,
      hasComments
    );
  }
);

// Minimal activity dataset
const minimalActivityDataset: PullRequest[] = [
  createMockPR(1, "alice", "Initial commit", "closed", 10, false, false, false),
  createMockPR(2, "bob", "Add README", "closed", 8, false, false, true),
];

const emptyDataset: PullRequest[] = [];

const meta = {
  title: "Components/PRActivity",
  component: PRActivity,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A component that displays a feed of pull request activities including opening, closing, merging, reviews, and comments.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PRActivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RecentActivity: Story = {
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

export const WithBots: Story = {
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
};

export const HighActivity: Story = {
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
};

export const Loading: Story = {
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
};

export const Error: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: [],
          loading: false,
          error: "Failed to load activity data",
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

export const EmptyData: Story = {
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
};

export const MixedStates: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: {
          pullRequests: [
            createMockPR(
              1,
              "alice",
              "Feature in progress",
              "open",
              1,
              false,
              false,
              false
            ),
            createMockPR(
              2,
              "bob",
              "Completed feature",
              "closed",
              2,
              false,
              true,
              true
            ),
            createMockPR(
              3,
              "carol",
              "Under review",
              "open",
              3,
              false,
              true,
              false
            ),
            createMockPR(
              4,
              "dave",
              "Merged fix",
              "closed",
              4,
              false,
              true,
              true
            ),
            createMockPR(5, "eve", "Draft PR", "open", 5, false, false, true),
          ],
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
