import type { Meta, StoryObj } from '@storybook/react';
import { ContributorHoverCard } from './contributor-hover-card';
import type { ContributorStats } from '@/lib/types';

const meta: Meta<typeof ContributorHoverCard> = {
  title: 'Features/Contributor/HoverCard with Profile',
  component: ContributorHoverCard,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof ContributorHoverCard>;

const mockContributorWithProfile: ContributorStats = {
  login: 'octocat',
  avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
  pullRequests: 42,
  percentage: 15.5,
  name: 'The Octocat',
  company: '@github',
  location: 'San Francisco, CA',
  bio: 'GitHub mascot and all-around cool cat',
  websiteUrl: 'https://github.com/octocat',
  recentPRs: [
    {
      id: 1,
      number: 123,
      title: 'Add new feature for user profiles',
      state: 'open' as const,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T14:00:00Z',
      merged_at: null,
      additions: 150,
      deletions: 30,
      repository_owner: 'github',
      repository_name: 'example-repo',
      user: {
        id: 1,
        login: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      },
      html_url: 'https://github.com/github/example-repo/pull/123',
    },
    {
      id: 2,
      number: 124,
      title: 'Fix bug in authentication flow',
      state: 'closed' as const,
      created_at: '2024-01-14T10:00:00Z',
      updated_at: '2024-01-14T16:00:00Z',
      merged_at: '2024-01-14T16:00:00Z',
      additions: 50,
      deletions: 20,
      repository_owner: 'github',
      repository_name: 'example-repo',
      user: {
        id: 1,
        login: 'octocat',
        avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
      },
      html_url: 'https://github.com/github/example-repo/pull/124',
    },
  ],
  organizations: [
    {
      login: 'github',
      avatar_url: 'https://avatars.githubusercontent.com/u/9919?v=4',
    },
    {
      login: 'opensource',
      avatar_url: 'https://avatars.githubusercontent.com/u/1234?v=4',
    },
  ],
};

const mockContributorWithoutProfile: ContributorStats = {
  login: 'developer',
  avatar_url: 'https://avatars.githubusercontent.com/u/12345?v=4',
  pullRequests: 15,
  percentage: 8.2,
  recentPRs: [],
};

export const WithCompanyAndLocation: Story = {
  args: {
    contributor: mockContributorWithProfile,
    children: (
      <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        Hover to see profile with company
      </button>
    ),
  },
};

export const WithoutProfileInfo: Story = {
  args: {
    contributor: mockContributorWithoutProfile,
    children: (
      <button className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
        Hover to see profile without company
      </button>
    ),
  },
};

export const WithRole: Story = {
  args: {
    contributor: mockContributorWithProfile,
    role: 'Maintainer',
    children: (
      <button className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600">
        Hover to see maintainer with profile
      </button>
    ),
  },
};

export const WithReviewsAndComments: Story = {
  args: {
    contributor: mockContributorWithProfile,
    showReviews: true,
    showComments: true,
    reviewsCount: 25,
    commentsCount: 48,
    children: (
      <button className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">
        Hover to see contributor with reviews
      </button>
    ),
  },
};
