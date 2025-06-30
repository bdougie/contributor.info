import type { Meta, StoryObj } from "@storybook/react";
import { ActivityItem } from "./activity-item";
import { PullRequestActivity } from "@/lib/types";
import { RepoStatsContext } from "@/lib/repo-stats-context";

// Mock the contributor hooks and utilities
// TODO: Mock @/hooks/useContributorRoles using Storybook's approach
// Original vi.mock replaced - needs manual review;

// TODO: Mock @/lib/contributor-utils using Storybook's approach
// Original vi.mock replaced - needs manual review;

// Helper function to create mock activities
const createMockActivity = (
  type: PullRequestActivity["type"],
  userName: string = "alice-dev",
  isBot: boolean = false
): PullRequestActivity => ({
  id: `activity-${type}-${Date.now()}`,
  type,
  user: {
    id: `user-${Math.floor(Math.random() * 1000)}`,
    name: userName,
    avatar: `https://avatars.githubusercontent.com/u/${Math.floor(Math.random() * 1000)}?v=4`,
    isBot,
  },
  pullRequest: {
    id: `pr-${Math.floor(Math.random() * 1000)}`,
    number: Math.floor(Math.random() * 1000) + 1,
    title: `Example PR: Add new feature for ${type} event`,
    url: "https://github.com/facebook/react/pull/123",
  },
  repository: {
    id: "repo-facebook-react",
    owner: "facebook",
    name: "react", 
    url: "https://github.com/facebook/react",
  },
  timestamp: "2 hours ago",
});

const mockPullRequests = [
  {
    id: 1,
    number: 123,
    title: "Add authentication system",
    state: "open" as const,
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T12:00:00Z",
    merged_at: null,
    additions: 250,
    deletions: 50,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 1,
      login: "alice-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      type: "User" as const,
    },
    html_url: "https://github.com/facebook/react/pull/123",
    reviews: [
      {
        id: 1,
        state: "approved",
        user: {
          login: "bob-reviewer",
          avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
        },
        submitted_at: "2024-01-15T11:00:00Z",
      },
    ],
    comments: [
      {
        id: 1,
        user: {
          login: "alice-dev",
          avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        },
        created_at: "2024-01-15T10:45:00Z",
      },
    ],
  },
];

const meta = {
  title: "Features/Activity/ActivityItem",
  component: ActivityItem,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "An individual item component that displays a single pull request activity with user information, activity type, and contextual details."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <RepoStatsContext.Provider
        value={{
          stats: {
            pullRequests: mockPullRequests,
            loading: false,
            error: null,
          },
          includeBots: false,
          setIncludeBots: () => {},
          lotteryFactor: null,
          directCommitsData: null,
        }}
      >
        <div className="w-[600px] p-4">
          <Story />
        </div>
      </RepoStatsContext.Provider>
    ),
  ],
} satisfies Meta<typeof ActivityItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OpenedPR: Story = {
  args: {
    activity: createMockActivity("opened"),
  },
};

export const MergedPR: Story = {
  args: {
    activity: createMockActivity("merged"),
  },
};

export const ClosedPR: Story = {
  args: {
    activity: createMockActivity("closed"),
  },
};

export const ReviewedPR: Story = {
  args: {
    activity: createMockActivity("reviewed"),
  },
};

export const CommentedPR: Story = {
  args: {
    activity: createMockActivity("commented"),
  },
};

export const BotActivity: Story = {
  args: {
    activity: createMockActivity("opened", "dependabot[bot]", true),
  },
  parameters: {
    docs: {
      description: {
        story: "Activity item showing bot activity with bot indicator icon."
      }
    }
  }
};

export const LongTitle: Story = {
  args: {
    activity: {
      ...createMockActivity("opened"),
      pullRequest: {
        id: "pr-456",
        number: 456,
        title: "This is a very long pull request title that should demonstrate how the component handles text truncation and responsive layout on different screen sizes",
        url: "https://github.com/facebook/react/pull/456",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Activity item with an exceptionally long PR title to test text truncation."
      }
    }
  }
};

export const LongRepositoryName: Story = {
  args: {
    activity: {
      ...createMockActivity("merged"),
      repository: {
        id: "repo-very-long-organization-name-extremely-long-repository-name-that-might-cause-layout-issues",
        owner: "very-long-organization-name",
        name: "extremely-long-repository-name-that-might-cause-layout-issues",
        url: "https://github.com/very-long-organization-name/extremely-long-repository-name-that-might-cause-layout-issues",
      },
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Activity item with long repository names to test responsive layout."
      }
    }
  }
};

export const RecentActivity: Story = {
  args: {
    activity: {
      ...createMockActivity("reviewed"),
      timestamp: "just now",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Activity item showing very recent activity."
      }
    }
  }
};

export const OldActivity: Story = {
  args: {
    activity: {
      ...createMockActivity("closed"),
      timestamp: "3 months ago",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Activity item showing older activity to test timestamp display."
      }
    }
  }
};