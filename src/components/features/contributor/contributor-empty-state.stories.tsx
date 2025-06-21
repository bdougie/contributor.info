import type { Meta, StoryObj } from "@storybook/react";
import { ContributorEmptyState, MinimalActivityDisplay } from "./contributor-empty-state";

const meta = {
  title: "Features/Contributor/ContributorEmptyState",
  component: ContributorEmptyState,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Empty state component that displays different states when there is no contributor data, including no data, no activity, minimal activity, and loading errors.",
      },
    },
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[600px] p-4">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    type: {
      control: "select",
      options: ["no_data", "no_activity", "minimal_activity", "loading_error"],
      description: "Type of empty state to display",
    },
    message: {
      control: "text",
      description: "Custom message to display",
    },
    suggestion: {
      control: "text",
      description: "Custom suggestion text",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
} satisfies Meta<typeof ContributorEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoData: Story = {
  args: {
    type: "no_data",
  },
};

export const NoActivity: Story = {
  args: {
    type: "no_activity",
  },
};

export const MinimalActivity: Story = {
  args: {
    type: "minimal_activity",
  },
};

export const LoadingError: Story = {
  args: {
    type: "loading_error",
  },
};

export const CustomMessage: Story = {
  args: {
    type: "no_data",
    message: "This repository hasn't been configured for contributor tracking yet.",
    suggestion: "Contact the repository maintainer to set up contributor tracking.",
  },
};

export const NetworkError: Story = {
  args: {
    type: "loading_error",
    message: "Network connection lost while loading contributor data.",
    suggestion: "Check your internet connection and try again.",
  },
};

const mockContributors = [
  {
    login: "alice",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    activity: {
      pullRequests: 3,
      reviews: 2,
      comments: 5,
      totalScore: 18,
    },
    rank: 1,
  },
  {
    login: "bob",
    avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
    activity: {
      pullRequests: 1,
      reviews: 1,
      comments: 3,
      totalScore: 8,
    },
    rank: 2,
  },
  {
    login: "charlie",
    avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
    activity: {
      pullRequests: 2,
      reviews: 0,
      comments: 1,
      totalScore: 7,
    },
    rank: 3,
  },
];

export const MinimalActivityDisplayExample: Story = {
  render: () => (
    <MinimalActivityDisplay
      contributors={mockContributors}
      month="January"
      year={2024}
    />
  ),
};

export const MinimalActivityDisplayEmpty: Story = {
  render: () => (
    <MinimalActivityDisplay
      contributors={[]}
      month="December"
      year={2023}
    />
  ),
};