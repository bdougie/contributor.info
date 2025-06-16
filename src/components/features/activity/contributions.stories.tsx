import type { Meta, StoryObj } from "@storybook/react";
import Contributions from "./contributions";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import type { PullRequest } from "@/lib/types";

// Helper function to create mock pull requests
const createMockPR = (
  id: number,
  login: string,
  additions: number,
  deletions: number,
  daysAgo: number,
  isBot: boolean = false
): PullRequest => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    id,
    number: id,
    title: `Feature ${id}: ${login}'s contribution`,
    state: Math.random() > 0.3 ? "closed" : "open",
    created_at: date.toISOString(),
    updated_at: date.toISOString(),
    merged_at: Math.random() > 0.2 ? date.toISOString() : null,
    additions,
    deletions,
    repository_owner: "test-org",
    repository_name: "test-repo",
    user: {
      id: id,
      login,
      avatar_url: `https://avatars.githubusercontent.com/u/${id}?v=4`,
      type: isBot ? "Bot" : "User",
    },
    html_url: `https://github.com/test-org/test-repo/pull/${id}`,
    commits: [
      {
        language: ["TypeScript", "JavaScript", "Python", "Go", "Rust"][
          Math.floor(Math.random() * 5)
        ],
        additions,
        deletions,
      },
    ],
  };
};

// Create varied datasets for different stories
const smallDataset: PullRequest[] = [
  createMockPR(1, "alice", 50, 10, 1),
  createMockPR(2, "bob", 20, 5, 2),
  createMockPR(3, "carol", 100, 30, 3),
  createMockPR(4, "dave", 15, 2, 4),
  createMockPR(5, "eve", 75, 20, 5),
];

const largeDataset: PullRequest[] = Array.from({ length: 50 }, (_, i) => {
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
  const additions = Math.floor(Math.random() * 500) + 10;
  const deletions = Math.floor(Math.random() * 100) + 1;
  const daysAgo = Math.floor(Math.random() * 30) + 1;

  return createMockPR(i + 1, contributor, additions, deletions, daysAgo);
});

const datasetWithBots: PullRequest[] = [
  ...smallDataset,
  createMockPR(6, "dependabot[bot]", 2, 1, 1, true),
  createMockPR(7, "renovate[bot]", 5, 0, 2, true),
  createMockPR(8, "github-actions[bot]", 1, 1, 3, true),
];

const extremeDataset: PullRequest[] = [
  createMockPR(1, "normaldev", 50, 10, 1),
  createMockPR(2, "smallchange", 2, 1, 2),
  createMockPR(3, "megacommit", 2000, 500, 3),
  createMockPR(4, "refactorer", 100, 80, 4),
  createMockPR(5, "bugfixer", 5, 3, 5),
];

const emptyDataset: PullRequest[] = [];

const meta = {
  title: "Components/Contributions",
  component: Contributions,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A scatter plot visualization showing repository activity with pull request data plotted by changes vs time.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Contributions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: smallDataset, loading: false, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
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
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
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
          error: "Failed to load repository data",
        },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
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
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const LargeDataset: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: largeDataset, loading: false, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
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
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
      </div>
    </RepoStatsContext.Provider>
  ),
};

export const ExtremeValues: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { pullRequests: extremeDataset, loading: false, error: null },
        includeBots: false,
        setIncludeBots: () => {},
        lotteryFactor: null,
        directCommitsData: null,
      }}
    >
      <div className="w-[800px] h-[600px] p-4">
        <Contributions />
      </div>
    </RepoStatsContext.Provider>
  ),
};
