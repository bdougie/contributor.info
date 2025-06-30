import type { Meta, StoryObj } from "@storybook/react";
import { QuadrantChart } from "./quadrant-chart";
import type { PullRequest, QuadrantData } from "@/lib/types";

// Mock the dependencies
vi.mock("@/lib/contribution-analyzer", () => ({
  ContributionAnalyzer: {
    analyze: vi.fn((pr: PullRequest) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 10 + 2,
      complexity: Math.random() * 100
    }))
  }
}));

vi.mock("../contributor", () => ({
  ContributorHoverCard: ({ children, contributor }: any) => (
    <div title={`${contributor.login}: ${contributor.pullRequests} PRs`}>
      {children}
    </div>
  )
}));

vi.mock("@/components/common/cards", () => ({
  FileHoverInfo: ({ children, pullRequest }: any) => (
    <div title={`PR #${pullRequest.number}: ${pullRequest.title}`}>
      {children}
    </div>
  )
}));

// Mock data
const mockPullRequests: PullRequest[] = [
  {
    id: 1,
    number: 123,
    title: "Add authentication system",
    state: "closed",
    created_at: "2024-01-10T10:30:00Z",
    updated_at: "2024-01-10T14:00:00Z",
    merged_at: "2024-01-10T14:00:00Z",
    additions: 250,
    deletions: 50,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 1,
      login: "alice-dev",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
      type: "User",
    },
    html_url: "https://github.com/facebook/react/pull/123",
    reviews: [],
    comments: [],
    url: "https://github.com/facebook/react/pull/123",
    author: {
      id: 1,
      login: "alice-dev"
    },
    commits: [
      {
        language: "TypeScript",
        additions: 200,
        deletions: 30
      },
      {
        language: "CSS",
        additions: 50,
        deletions: 20
      }
    ]
  },
  {
    id: 2,
    number: 124,
    title: "Fix navigation bug",
    state: "closed",
    created_at: "2024-01-11T09:15:00Z",
    updated_at: "2024-01-11T10:30:00Z",
    merged_at: "2024-01-11T10:30:00Z",
    additions: 45,
    deletions: 120,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 2,
      login: "bob-fix",
      avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
      type: "User",
    },
    html_url: "https://github.com/facebook/react/pull/124",
    reviews: [],
    comments: [],
    url: "https://github.com/facebook/react/pull/124",
    author: {
      id: 2,
      login: "bob-fix"
    },
    commits: [
      {
        language: "JavaScript",
        additions: 25,
        deletions: 80
      },
      {
        language: "HTML",
        additions: 20,
        deletions: 40
      }
    ]
  },
  {
    id: 3,
    number: 125,
    title: "Refactor component architecture", 
    state: "closed",
    created_at: "2024-01-12T14:20:00Z",
    updated_at: "2024-01-12T16:45:00Z",
    merged_at: "2024-01-12T16:45:00Z",
    additions: 180,
    deletions: 200,
    repository_owner: "facebook",
    repository_name: "react",
    user: {
      id: 3,
      login: "carol-arch",
      avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
      type: "User",
    },
    html_url: "https://github.com/facebook/react/pull/125",
    reviews: [],
    comments: [],
    url: "https://github.com/facebook/react/pull/125",
    author: {
      id: 3,
      login: "carol-arch"
    },
    commits: [
      {
        language: "TypeScript",
        additions: 180,
        deletions: 200
      }
    ]
  }
];

const mockQuadrants: QuadrantData[] = [
  {
    name: "Refinement",
    count: 45,
    percentage: 28.1,
    color: "#ef4444",
    description: "Refining existing features",
    authors: [
      { id: 1, login: "alice-dev", contributions: 12 },
      { id: 2, login: "bob-fix", contributions: 8 }
    ]
  },
  {
    name: "New Stuff", 
    count: 67,
    percentage: 41.9,
    color: "#22c55e",
    description: "Adding new functionality",
    authors: [
      { id: 1, login: "alice-dev", contributions: 15 },
      { id: 3, login: "carol-arch", contributions: 10 },
      { id: 4, login: "dave-new", contributions: 7 }
    ]
  },
  {
    name: "Maintenance",
    count: 32,
    percentage: 20.0,
    color: "#f97316",
    description: "Bug fixes and maintenance",
    authors: [
      { id: 2, login: "bob-fix", contributions: 18 },
      { id: 5, login: "eve-maint", contributions: 6 }
    ]
  },
  {
    name: "Refactoring",
    count: 16,
    percentage: 10.0,
    color: "#8b5cf6",
    description: "Code structure improvements",
    authors: [
      { id: 3, login: "carol-arch", contributions: 12 }
    ]
  }
];

const meta = {
  title: "Features/Health/QuadrantChart",
  component: QuadrantChart,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "An interactive quadrant chart visualization showing the distribution of pull requests across four categories: Refinement, New Stuff, Maintenance, and Refactoring. Each point represents a PR positioned based on additions/deletions ratio."
      }
    }
  },
  tags: ["autodocs"],
  argTypes: {
    data: {
      control: false,
      description: "Array of pull requests to visualize"
    },
    quadrants: {
      control: false,
      description: "Quadrant data with statistics and contributor information"
    }
  }
} satisfies Meta<typeof QuadrantChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    data: mockPullRequests,
    quadrants: mockQuadrants
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Default quadrant chart showing distribution of pull requests with contributor avatars."
      }
    }
  }
};

export const HighActivity: Story = {
  args: {
    data: Array.from({ length: 25 }, (_, i) => ({
      ...mockPullRequests[i % 3],
      id: i + 1,
      number: i + 100,
      title: `PR #${i + 100}: ${['Feature', 'Bugfix', 'Refactor'][i % 3]} update`,
      author: {
        id: (i % 5) + 1,
        login: `contributor-${(i % 5) + 1}`
      }
    })),
    quadrants: mockQuadrants.map(q => ({
      ...q,
      count: q.count * 2,
      authors: [
        ...q.authors,
        { id: 6, login: "new-contributor", contributions: 5 }
      ]
    }))
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "High activity repository with many pull requests and contributors."
      }
    }
  }
};

export const RefactoringHeavy: Story = {
  args: {
    data: mockPullRequests.map((pr, i) => ({
      ...pr,
      additions: 100 + i * 20,
      deletions: 150 + i * 30, // Higher deletions for refactoring
      commits: [{
        language: "TypeScript",
        additions: 100 + i * 20,
        deletions: 150 + i * 30
      }]
    })),
    quadrants: [
      { ...mockQuadrants[0], count: 15, percentage: 15.0 },
      { ...mockQuadrants[1], count: 20, percentage: 20.0 },
      { ...mockQuadrants[2], count: 25, percentage: 25.0 },
      { 
        ...mockQuadrants[3], 
        count: 40, 
        percentage: 40.0,
        authors: [
          { id: 3, login: "carol-arch", contributions: 20 },
          { id: 7, login: "refactor-expert", contributions: 15 },
          { id: 8, login: "clean-code-fan", contributions: 12 }
        ]
      }
    ]
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Repository with heavy refactoring activity showing more deletions than additions."
      }
    }
  }
};

export const NewProjectActivity: Story = {
  args: {
    data: mockPullRequests.map((pr, i) => ({
      ...pr,
      additions: 300 + i * 50, // High additions for new project
      deletions: 10 + i * 5,   // Low deletions
      commits: [{
        language: "TypeScript",
        additions: 300 + i * 50,
        deletions: 10 + i * 5
      }]
    })),
    quadrants: [
      { ...mockQuadrants[0], count: 10, percentage: 10.0 },
      { 
        ...mockQuadrants[1], 
        count: 70, 
        percentage: 70.0,
        authors: [
          { id: 1, login: "alice-dev", contributions: 25 },
          { id: 2, login: "bob-fix", contributions: 20 },
          { id: 3, login: "carol-arch", contributions: 18 },
          { id: 9, login: "startup-dev", contributions: 15 }
        ]
      },
      { ...mockQuadrants[2], count: 15, percentage: 15.0 },
      { ...mockQuadrants[3], count: 5, percentage: 5.0 }
    ]
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "New project showing heavy 'New Stuff' activity with many additions and few deletions."
      }
    }
  }
};

export const EmptyRepository: Story = {
  args: {
    data: [],
    quadrants: mockQuadrants.map(q => ({
      ...q,
      count: 0,
      percentage: 0,
      authors: []
    }))
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Empty repository with no pull requests to display."
      }
    }
  }
};

export const SingleContributor: Story = {
  args: {
    data: mockPullRequests.map(pr => ({
      ...pr,
      author: { id: 1, login: "solo-dev" },
      user: {
        ...pr.user,
        id: 1,
        login: "solo-dev"
      }
    })),
    quadrants: mockQuadrants.map(q => ({
      ...q,
      authors: [{ id: 1, login: "solo-dev", contributions: q.count }]
    }))
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Repository with a single contributor showing all activity from one person."
      }
    }
  }
};

export const MobileView: Story = {
  args: {
    data: mockPullRequests,
    quadrants: mockQuadrants
  },
  render: (args) => (
    <div className="w-full p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Mobile view showing desktop recommendation message instead of the complex chart."
      }
    }
  }
};

export const NoCommitData: Story = {
  args: {
    data: mockPullRequests.map(pr => ({
      ...pr,
      commits: undefined // No commit data
    })),
    quadrants: mockQuadrants
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Chart handling pull requests without detailed commit information."
      }
    }
  }
};

export const ManyContributors: Story = {
  args: {
    data: mockPullRequests,
    quadrants: [
      {
        ...mockQuadrants[0],
        authors: Array.from({ length: 8 }, (_, i) => ({
          id: i + 1,
          login: `contributor-${i + 1}`,
          contributions: 10 - i
        }))
      },
      ...mockQuadrants.slice(1)
    ]
  },
  render: (args) => (
    <div className="w-[800px] h-[500px] p-4">
      <QuadrantChart {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Quadrant with many contributors showing avatar overflow with +N indicator."
      }
    }
  }
};