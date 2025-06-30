import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import React, { useState } from "react";
import LotteryFactor, { LotteryFactorContent } from "./lottery-factor";
import { MemoryRouter } from "react-router-dom";
import { RepoStatsContext } from "@/lib/repo-stats-context";
import type { LotteryFactor as LotteryFactorType, ContributorStats } from "@/lib/types";

// Mock dependencies
import * as timeRangeStore from "@/lib/time-range-store";
import * as supabaseModule from "@/lib/supabase";
import * as shareableCard from "@/components/features/sharing/shareable-card";
import * as contributorModule from "../contributor";
import * as lotteryIcon from "@/components/icons/LotteryIcon";
import * as yoloIcon from "@/components/icons/YoloIcon";

// Override modules
(timeRangeStore as any).useTimeRangeStore = fn(() => ({
  getDaysAgo: fn().mockReturnValue(30),
}));

(supabaseModule as any).supabase = {
  auth: {
    getUser: fn().mockResolvedValue({
      data: {
        user: {
          email: "test@example.com",
          user_metadata: {
            user_name: "test-user",
            avatar_url: "https://avatars.githubusercontent.com/u/123?v=4",
          },
        },
      },
      error: null,
    }),
  },
  from: fn().mockReturnValue({
    select: fn().mockReturnValue({
      eq: fn().mockReturnValue({
        gte: fn().mockReturnValue({
          order: fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      }),
    }),
  }),
};

(shareableCard as any).ShareableCard = ({ children }: any) => React.createElement('div', null, children);
(contributorModule as any).ContributorHoverCard = ({ trigger }: any) => trigger;
(lotteryIcon as any).LotteryIcon = () => React.createElement('div', null, 'LotteryIcon');
(yoloIcon as any).YoloIcon = () => React.createElement('div', null, 'YoloIcon');

// Mock data
const mockContributors: ContributorStats[] = [
  {
    login: "alice-dev",
    avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    pullRequests: 45,
    percentage: 37.5
  },
  {
    login: "bob-contributor",
    avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
    pullRequests: 28,
    percentage: 23.3
  },
  {
    login: "carol-occasional",
    avatar_url: "https://avatars.githubusercontent.com/u/3?v=4",
    pullRequests: 15,
    percentage: 12.5
  }
];

const mockLotteryFactor: LotteryFactorType = {
  topContributorsCount: 3,
  topContributorsPercentage: 73.3,
  contributors: mockContributors,
  totalContributors: 12,
  riskLevel: "Medium"
};

const mockPullRequests = Array.from({ length: 120 }, (_, i) => ({
  id: i + 1,
  number: i + 100,
  title: `PR #${i + 100}`,
  state: "closed" as const,
  created_at: "2024-01-10T10:30:00Z",
  updated_at: "2024-01-10T14:00:00Z",
  merged_at: "2024-01-10T14:00:00Z",
  additions: 50 + i * 2,
  deletions: 20 + i,
  repository_owner: "facebook",
  repository_name: "react",
  user: {
    id: (i % 3) + 1,
    login: mockContributors[i % 3].login,
    avatar_url: mockContributors[i % 3].avatar_url,
    type: i === 5 ? "Bot" as const : "User" as const,
  },
  html_url: `https://github.com/facebook/react/pull/${i + 100}`,
  reviews: [],
  comments: [],
}));

const meta = {
  title: "Features/Health/LotteryFactor",
  component: LotteryFactor,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A comprehensive lottery factor analysis component showing contributor distribution, risk levels, and YOLO coder detection. Includes interactive features like bot filtering and detailed contributor information."
      }
    }
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: mockLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof LotteryFactor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <LotteryFactor />,
  parameters: {
    docs: {
      description: {
        story: "Default lottery factor display showing medium risk with balanced contributor distribution."
      }
    }
  }
};

export const HighRisk: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: {
              ...mockLotteryFactor,
              topContributorsPercentage: 89.2,
              riskLevel: "High",
              contributors: [
                { ...mockContributors[0], percentage: 65.0, pullRequests: 78 },
                { ...mockContributors[1], percentage: 24.2, pullRequests: 29 }
              ]
            },
            directCommitsData: null,
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "High risk lottery factor with concentrated contributions from few maintainers."
      }
    }
  }
};

export const LowRisk: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/kubernetes/kubernetes"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: {
              ...mockLotteryFactor,
              topContributorsPercentage: 45.8,
              riskLevel: "Low",
              totalContributors: 25,
              contributors: [
                { ...mockContributors[0], percentage: 18.5, pullRequests: 22 },
                { ...mockContributors[1], percentage: 15.2, pullRequests: 18 },
                { ...mockContributors[2], percentage: 12.1, pullRequests: 15 }
              ]
            },
            directCommitsData: null,
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Low risk lottery factor with well-distributed contributions across many contributors."
      }
    }
  }
};

export const WithYoloCoders: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: mockLotteryFactor,
            directCommitsData: {
              hasYoloCoders: true,
              yoloCoderStats: [
                {
                  login: "admin-user",
                  avatar_url: "https://avatars.githubusercontent.com/u/999?v=4",
                  directCommits: 12,
                  totalPushedCommits: 45,
                  type: "User"
                },
                {
                  login: "senior-dev",
                  avatar_url: "https://avatars.githubusercontent.com/u/998?v=4",
                  directCommits: 8,
                  totalPushedCommits: 28,
                  type: "User"
                }
              ]
            },
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Lottery factor with YOLO coders detection showing direct commits to main branch."
      }
    }
  }
};

export const WithBots: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: [
                ...mockPullRequests,
                {
                  id: 999,
                  number: 999,
                  title: "Bot: Update dependencies",
                  state: "closed" as const,
                  created_at: "2024-01-10T10:30:00Z",
                  updated_at: "2024-01-10T14:00:00Z",
                  merged_at: "2024-01-10T14:00:00Z",
                  additions: 50,
                  deletions: 20,
                  repository_owner: "facebook",
                  repository_name: "react",
                  user: {
                    id: 999,
                    login: "dependabot[bot]",
                    avatar_url: "https://avatars.githubusercontent.com/u/999?v=4",
                    type: "Bot" as const,
                  },
                  html_url: "https://github.com/facebook/react/pull/999",
                  reviews: [],
                  comments: [],
                }
              ],
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: mockLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Lottery factor with bot activity and toggle for including/excluding bots."
      }
    }
  }
};

export const LoadingState: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: [],
              loading: true,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: null,
            directCommitsData: null,
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Lottery factor in loading state showing skeleton placeholders."
      }
    }
  }
};

export const EmptyRepository: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/empty/repo"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: [],
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: null,
            directCommitsData: null,
          }}
        >
          <div className="w-[700px] p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Lottery factor for repository with no contribution data."
      }
    }
  }
};

export const ContentOnly: Story = {
  render: () => (
    <LotteryFactorContent
      stats={{
        pullRequests: mockPullRequests,
        loading: false,
        error: null,
      }}
      lotteryFactor={mockLotteryFactor}
      showYoloButton={false}
      includeBots={false}
    />
  ),
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <div className="w-[600px] p-4">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Standalone lottery factor content component without card wrapper."
      }
    }
  }
};

export const YoloCodersView: Story = {
  render: () => {
    // Create a component that shows YOLO coders view directly
    const YoloCodersDemo = () => {
      const [showYolo, setShowYolo] = useState(true);
      
      return (
        <div className="w-[600px] p-4">
          {showYolo ? (
            <LotteryFactorContent
              stats={{
                pullRequests: mockPullRequests,
                loading: false,
                error: null,
              }}
              lotteryFactor={mockLotteryFactor}
              showYoloButton={true}
              includeBots={false}
            />
          ) : (
            <button 
              onClick={() => setShowYolo(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Show YOLO Coders
            </button>
          )}
        </div>
      );
    };

    return <YoloCodersDemo />;
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: mockLotteryFactor,
            directCommitsData: {
              hasYoloCoders: true,
              yoloCoderStats: [
                {
                  login: "admin-user",
                  avatar_url: "https://avatars.githubusercontent.com/u/999?v=4",
                  directCommits: 12,
                  totalPushedCommits: 45,
                  type: "User"
                }
              ]
            },
          }}
        >
          <Story />
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: "Direct view of YOLO coders interface showing developers who commit directly to main."
      }
    }
  }
};

export const MobileView: Story = {
  render: () => <LotteryFactor />,
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/facebook/react"]}>
        <RepoStatsContext.Provider
          value={{
            stats: {
              pullRequests: mockPullRequests,
              loading: false,
              error: null,
            },
            includeBots: false,
            setIncludeBots: () => {},
            lotteryFactor: mockLotteryFactor,
            directCommitsData: null,
          }}
        >
          <div className="w-full p-4">
            <Story />
          </div>
        </RepoStatsContext.Provider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    viewport: {
      defaultViewport: "mobile1"
    },
    docs: {
      description: {
        story: "Lottery factor on mobile devices with responsive layout."
      }
    }
  }
};