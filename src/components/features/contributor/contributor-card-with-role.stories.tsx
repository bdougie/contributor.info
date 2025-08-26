import type { Meta, StoryObj } from '@storybook/react';
// import { ContributorCardWithRole } from './contributor-card-with-role' // Not used directly in stories
import { RepoStatsContext } from '@/lib/repo-stats-context';
import { MonthlyContributor } from '@/lib/types';

// Mock data for the context
const mockStats = {
  pullRequests: [
    {
      id: 1,
      user: {
        id: 1,
        login: 'alice-maintainer',
        avatar_url: 'https://github.com/alice-maintainer.png',
      },
      title: 'Add new feature',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T11:00:00Z',
      merged_at: '2024-01-15T12:00:00Z',
      state: 'closed' as const,
      merged: true,
      number: 123,
      html_url: 'https://github.com/test/repo/pull/123',
      draft: false,
      assignee: null,
      assignees: [],
      labels: [],
      milestone: null,
      requested_reviewers: [],
      head: { sha: 'abc123' },
      base: { sha: 'def456' },
      additions: 100,
      deletions: 50,
      repository_owner: 'testorg',
      repository_name: 'testrepo',
    },
  ],
  reviews: [],
  comments: [],
};

// Mock contributors with different roles
const mockContributors: MonthlyContributor[] = [
  {
    login: 'alice-maintainer',
    avatar_url: 'https://github.com/alice-maintainer.png',
    rank: 1,
    activity: {
      pullRequests: 15,
      reviews: 8,
      comments: 25,
      totalScore: 48,
      firstContributionDate: '2024-01-01T00:00:00Z',
    },
  },
  {
    login: 'bob-owner',
    avatar_url: 'https://github.com/bob-owner.png',
    rank: 2,
    activity: {
      pullRequests: 12,
      reviews: 20,
      comments: 30,
      totalScore: 62,
      firstContributionDate: '2024-01-02T00:00:00Z',
    },
  },
  {
    login: 'charlie-contributor',
    avatar_url: 'https://github.com/charlie-contributor.png',
    rank: 3,
    activity: {
      pullRequests: 5,
      reviews: 2,
      comments: 8,
      totalScore: 15,
      firstContributionDate: '2024-01-10T00:00:00Z',
    },
  },
  {
    login: 'dependabot[bot]',
    avatar_url: 'https://github.com/dependabot.png',
    rank: 4,
    activity: {
      pullRequests: 20,
      reviews: 0,
      comments: 0,
      totalScore: 20,
      firstContributionDate: '2024-01-01T00:00:00Z',
    },
  },
];

// Mock the useContributorRole hook
const mockRoles = {
  'alice-maintainer': {
    id: '1',
    user_id: 'alice-maintainer',
    repository_owner: 'testorg',
    repository_name: 'testrepo',
    role: 'maintainer' as const,
    confidence_score: 0.92,
    detected_at: '2024-01-01T00:00:00Z',
    last_verified: '2024-01-15T00:00:00Z',
    detection_methods: ['merge_event', 'push_to_protected', 'review_dismissed'],
    permission_events_count: 15,
    is_bot: false,
    activity_level: 'high' as const,
    days_since_last_active: 1,
  },
  'bob-owner': {
    id: '2',
    user_id: 'bob-owner',
    repository_owner: 'testorg',
    repository_name: 'testrepo',
    role: 'owner' as const,
    confidence_score: 0.98,
    detected_at: '2024-01-01T00:00:00Z',
    last_verified: '2024-01-15T00:00:00Z',
    detection_methods: ['admin_action', 'merge_event', 'release_published'],
    permission_events_count: 25,
    is_bot: false,
    activity_level: 'high' as const,
    days_since_last_active: 0,
  },
  'charlie-contributor': {
    id: '3',
    user_id: 'charlie-contributor',
    repository_owner: 'testorg',
    repository_name: 'testrepo',
    role: 'contributor' as const,
    confidence_score: 0.15,
    detected_at: '2024-01-10T00:00:00Z',
    last_verified: '2024-01-15T00:00:00Z',
    detection_methods: [],
    permission_events_count: 0,
    is_bot: false,
    activity_level: 'medium' as const,
    days_since_last_active: 2,
  },
  'dependabot[bot]': {
    id: '4',
    user_id: 'dependabot[bot]',
    repository_owner: 'testorg',
    repository_name: 'testrepo',
    role: 'contributor' as const,
    confidence_score: 0.05,
    detected_at: '2024-01-01T00:00:00Z',
    last_verified: '2024-01-15T00:00:00Z',
    detection_methods: [],
    permission_events_count: 0,
    is_bot: true,
    activity_level: 'high' as const,
    days_since_last_active: 0,
  },
};

// Mock the hook - removed unused function

// Create a simplified version for stories that accepts mock role data
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ContributorHoverCard } from './contributor-hover-card';
import { useMemo } from 'react';
import {
  GitPullRequest,
  MessageSquare,
  GitPullRequestDraft,
  Trophy,
  Shield,
  User,
  Bot,
} from '@/components/ui/icon';

const ContributorCardStory = ({
  contributor,
  mockRole = null,
  mockLoading = false,
  showRank = true,
  isWinner = false,
  showConfidence = false,
  className,
}: unknown) => {
  const { login, avatar_url, activity, rank } = contributor;
  // const { stats } = useContext(RepoStatsContext); // Not used in story component

  // Use mock data instead of hook
  const role = mockRole;
  const roleLoading = mockLoading;

  // Create contributor data for hover card
  const contributorData = useMemo(() => {
    return {
      login,
      avatar_url,
      id: login,
      pullRequests: 0,
      reviews: [],
      comments: [],
      percentage: 0,
    };
  }, [login, avatar_url]);

  // Determine role badge variant and label
  const getRoleBadge = () => {
    if (!role || roleLoading) return null;

    const badges = [];

    // Role badge
    if (role.role === 'owner') {
      badges.push(
        <Badge key="role" variant="default" className="bg-purple-600 hover:bg-purple-700">
          <Shield className="h-3 w-3 mr-1" />
          Owner
        </Badge>,
      );
    } else if (role.role === 'maintainer') {
      badges.push(
        <Badge key="role" variant="default" className="bg-blue-600 hover:bg-blue-700">
          <User className="h-3 w-3 mr-1" />
          Maintainer
        </Badge>,
      );
    }

    // Bot indicator
    if (role.is_bot) {
      badges.push(
        <Badge key="bot" variant="outline" className="border-muted-foreground/50">
          <Bot className="h-3 w-3 mr-1" />
          Bot
        </Badge>,
      );
    }

    // Confidence score
    if (showConfidence && role.role !== 'contributor') {
      const confidencePercent = Math.round(role.confidence_score * 100);
      const confidenceColor =
        confidencePercent >= 90
          ? 'text-green-600'
          : confidencePercent >= 70
            ? 'text-yellow-600'
            : 'text-orange-600';

      badges.push(
        <span key="confidence" className={cn('text-xs font-medium', confidenceColor)}>
          {confidencePercent}% confidence
        </span>,
      );
    }

    return badges;
  };

  // Create enhanced tooltip content
  const tooltipContent = (
    <div className="space-y-2">
      <div className="font-medium">{login}'s Activity</div>

      {role && (
        <div className="text-xs space-y-1 border-b pb-2">
          <div className="font-medium">Role Detection</div>
          <div>Status: {role.role === 'contributor' ? 'External' : 'Internal'} Contributor</div>
          {role.role !== 'contributor' && (
            <>
              <div>Confidence: {Math.round(role.confidence_score * 100)}%</div>
              <div>Detection Methods: {role.detection_methods.join(', ')}</div>
              <div>Privileged Events: {role.permission_events_count}</div>
            </>
          )}
        </div>
      )}

      <div className="text-xs space-y-1">
        <div className="flex items-center gap-2">
          <GitPullRequest className="h-3 w-3" />
          <span>{activity.pullRequests} Pull Requests</span>
        </div>
        <div className="flex items-center gap-2">
          <GitPullRequestDraft className="h-3 w-3" />
          <span>{activity.reviews} Reviews</span>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3 w-3" />
          <span>{activity.comments} Comments</span>
        </div>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'relative p-4 rounded-lg border bg-card transition-all cursor-pointer',
              'hover:bg-muted/50',
              isWinner && 'ring-2 ring-yellow-500 bg-yellow-50/10 dark:bg-yellow-900/10',
              role?.role === 'owner' && 'border-purple-500/30',
              role?.role === 'maintainer' && 'border-blue-500/30',
              className,
            )}
            role={isWinner ? 'article' : 'listitem'}
            aria-label={`${login}${isWinner ? ' - Winner' : ''}, ${activity.totalScore} points${role ? `, ${role.role}` : ''}`}
            tabIndex={0}
          >
            {/* Rank Badge */}
            {showRank && (
              <div className="absolute -top-2 -right-2 z-10">
                <Badge
                  variant={rank === 1 ? 'default' : 'secondary'}
                  className="h-6 w-6 rounded-full p-0 flex items-center justify-center"
                >
                  {rank}
                </Badge>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <ContributorHoverCard contributor={contributorData}>
                  <Avatar className="h-10 w-10 cursor-pointer">
                    <AvatarImage src={avatar_url} alt={login} />
                    <AvatarFallback>{login.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </ContributorHoverCard>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm truncate">{login}</h3>
                    {isWinner && (
                      <Trophy
                        className="h-4 w-4 text-yellow-600"
                        data-testid="trophy-icon"
                        aria-label="Winner"
                        role="img"
                      />
                    )}
                  </div>

                  {/* Role badges */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">{getRoleBadge()}</div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <GitPullRequest className="h-3 w-3" />
                      <span>{activity.pullRequests}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitPullRequestDraft className="h-3 w-3" />
                      <span>{activity.reviews}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{activity.comments}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs font-medium">Score: {activity.totalScore}</span>
                    {role && role.role !== 'contributor' && (
                      <span className="text-xs text-muted-foreground">Internal Contributor</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const meta: Meta<typeof ContributorCardStory> = {
  title: 'Components/ContributorCardWithRole',
  component: ContributorCardStory,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Enhanced contributor card that displays role badges, confidence scores, and internal/external contributor indicators.',
      },
    },
  },
  decorators: [
    (Story) => (
      <RepoStatsContext.Provider
        value={{
          stats: { ...mockStats, loading: false, error: null },
          lotteryFactor: null,
          directCommitsData: null,
          includeBots: false,
          setIncludeBots: () => {},
        }}
      >
        <div className="w-80">
          <Story />
        </div>
      </RepoStatsContext.Provider>
    ),
  ],
  argTypes: {
    owner: { control: 'text' },
    repo: { control: 'text' },
    showRank: { control: 'boolean' },
    isWinner: { control: 'boolean' },
    showConfidence: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof ContributorCardStory>;

export const Maintainer: Story = {
  args: {
    contributor: mockContributors[0], // alice-maintainer
    mockRole: mockRoles['alice-maintainer'],
    showRank: true,
    isWinner: false,
    showConfidence: true,
  },
};

export const Owner: Story = {
  args: {
    contributor: mockContributors[1], // bob-owner
    mockRole: mockRoles['bob-owner'],
    showRank: true,
    isWinner: true,
    showConfidence: true,
  },
};

export const ExternalContributor: Story = {
  args: {
    contributor: mockContributors[2], // charlie-contributor
    mockRole: mockRoles['charlie-contributor'],
    showRank: true,
    isWinner: false,
    showConfidence: false,
  },
};

export const BotContributor: Story = {
  args: {
    contributor: mockContributors[3], // dependabot[bot]
    mockRole: mockRoles['dependabot[bot]'],
    showRank: true,
    isWinner: false,
    showConfidence: false,
  },
};

export const WithoutRank: Story = {
  args: {
    contributor: mockContributors[0],
    mockRole: mockRoles['alice-maintainer'],
    showRank: false,
    isWinner: false,
    showConfidence: true,
  },
};

export const Loading: Story = {
  args: {
    contributor: mockContributors[0],
    mockRole: null,
    mockLoading: true,
    showRank: true,
    isWinner: false,
    showConfidence: true,
  },
};

export const ComparisonGrid: Story = {
  render: () => (
    <RepoStatsContext.Provider
      value={{
        stats: { ...mockStats, loading: false, error: null },
        lotteryFactor: null,
        directCommitsData: null,
        includeBots: false,
        setIncludeBots: () => {},
      }}
    >
      <div className="grid grid-cols-2 gap-4 w-[700px]">
        <ContributorCardStory
          contributor={mockContributors[1]}
          mockRole={mockRoles['bob-owner']}
          showRank={true}
          isWinner={true}
          showConfidence={true}
        />
        <ContributorCardStory
          contributor={mockContributors[0]}
          mockRole={mockRoles['alice-maintainer']}
          showRank={true}
          isWinner={false}
          showConfidence={true}
        />
        <ContributorCardStory
          contributor={mockContributors[2]}
          mockRole={mockRoles['charlie-contributor']}
          showRank={true}
          isWinner={false}
          showConfidence={false}
        />
        <ContributorCardStory
          contributor={mockContributors[3]}
          mockRole={mockRoles['dependabot[bot]']}
          showRank={true}
          isWinner={false}
          showConfidence={false}
        />
      </div>
    </RepoStatsContext.Provider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Comparison showing different contributor roles: Owner (purple badge), Maintainer (blue badge), External Contributor (no role badge), and Bot (with bot indicator).',
      },
    },
  },
};
