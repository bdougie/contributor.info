import type { Meta, StoryObj } from "@storybook/react";
import { PullRequestActivityFeed } from "./pr-activity-feed";
import { PullRequestActivity, ActivityType } from "@/lib/types";

// Mock data for PR activities
const createMockActivity = (
  id: string,
  type: ActivityType,
  actor: string,
  description: string,
  timestamp: string,
  prNumber?: number,
  repository?: string
): PullRequestActivity => ({
  id,
  type,
  actor: {
    login: actor,
    avatar_url: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 1000)}?v=4`,
    html_url: `https://github.com/${actor}`,
  },
  description,
  timestamp,
  pull_request: prNumber ? {
    number: prNumber,
    title: `Example PR #${prNumber}`,
    html_url: `https://github.com/${repository || 'example/repo'}/pull/${prNumber}`,
    state: Math.random() > 0.5 ? 'open' : 'closed'
  } : undefined,
  repository: repository || 'example/repo',
  html_url: `https://github.com/${repository || 'example/repo'}/pull/${prNumber || 1}`,
});

const mixedActivities: PullRequestActivity[] = [
  createMockActivity(
    "1",
    "opened",
    "alice-dev",
    "opened pull request #123",
    "2024-01-15T10:30:00Z",
    123,
    "facebook/react"
  ),
  createMockActivity(
    "2", 
    "reviewed",
    "bob-reviewer",
    "reviewed pull request #123",
    "2024-01-15T11:45:00Z",
    123,
    "facebook/react"
  ),
  createMockActivity(
    "3",
    "merged",
    "carol-maintainer", 
    "merged pull request #122",
    "2024-01-15T12:00:00Z",
    122,
    "facebook/react"
  ),
  createMockActivity(
    "4",
    "commented",
    "dave-contributor",
    "commented on pull request #124",
    "2024-01-15T12:30:00Z",
    124,
    "facebook/react"
  ),
  createMockActivity(
    "5",
    "closed",
    "eve-maintainer",
    "closed pull request #121",
    "2024-01-15T13:00:00Z",
    121,
    "facebook/react"
  ),
];

const highVolumeActivities: PullRequestActivity[] = Array.from(
  { length: 20 },
  (_, i) => {
    const types: ActivityType[] = ["opened", "merged", "reviewed", "commented", "closed"];
    const contributors = ["alice", "bob", "carol", "dave", "eve", "frank", "grace"];
    const type = types[i % types.length];
    const actor = contributors[i % contributors.length];
    
    return createMockActivity(
      `activity-${i}`,
      type,
      actor,
      `${type} pull request #${i + 100}`,
      new Date(Date.now() - i * 3600000).toISOString(), // Each activity 1 hour apart
      i + 100,
      "microsoft/vscode"
    );
  }
);

const meta = {
  title: "Features/Activity/PullRequestActivityFeed", 
  component: PullRequestActivityFeed,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A feed component that displays a chronological list of pull request activities including opening, merging, reviewing, commenting, and closing events."
      }
    }
  },
  tags: ["autodocs"],
  argTypes: {
    activities: {
      control: false,
      description: "Array of pull request activities to display"
    },
    loading: {
      control: "boolean",
      description: "Whether the feed is in a loading state"
    },
    error: {
      control: false,
      description: "Error object if there was an error loading activities"
    },
    selectedTypes: {
      control: "check",
      options: ["opened", "merged", "reviewed", "commented", "closed"],
      description: "Filter activities by selected types"
    }
  }
} satisfies Meta<typeof PullRequestActivityFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activities: mixedActivities,
    loading: false,
    error: null,
    selectedTypes: []
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const HighVolume: Story = {
  args: {
    activities: highVolumeActivities,
    loading: false,
    error: null,
    selectedTypes: []
  },
  render: (args) => (
    <div className="w-[600px] h-[500px] overflow-y-auto p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const FilteredByType: Story = {
  args: {
    activities: mixedActivities,
    loading: false,
    error: null,
    selectedTypes: ["opened", "merged"]
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const Loading: Story = {
  args: {
    activities: [],
    loading: true,
    error: null,
    selectedTypes: []
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const LoadingWithExistingData: Story = {
  args: {
    activities: mixedActivities.slice(0, 3),
    loading: true,
    error: null,
    selectedTypes: []
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const Error: Story = {
  args: {
    activities: [],
    loading: false,
    error: new Error("Failed to load PR activity data"),
    selectedTypes: []
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const EmptyData: Story = {
  args: {
    activities: [],
    loading: false,
    error: null,
    selectedTypes: []
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};

export const EmptyAfterFilter: Story = {
  args: {
    activities: mixedActivities,
    loading: false,
    error: null,
    selectedTypes: ["assigned"] // Type that doesn't exist in our data
  },
  render: (args) => (
    <div className="w-[600px] p-4">
      <PullRequestActivityFeed {...args} />
    </div>
  )
};