import type { Meta, StoryObj } from '@storybook/react';
import { TrendingPage } from './TrendingPage';
import type { TrendingRepositoryData } from './TrendingRepositoryCard';

const meta = {
  title: 'Features/Trending/TrendingPage',
  component: TrendingPage,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The main trending repositories page that displays repositories with significant recent activity and metric improvements. Features filtering, sorting, and time period selection.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    loading: {
      control: 'boolean',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof TrendingPage>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockTrendingRepos: TrendingRepositoryData[] = [
  {
    id: 'repo-1',
    owner: 'continuedev',
    name: 'continue',
    description:
      'The open-source autopilot for software development—bring the power of ChatGPT to VS Code',
    language: 'TypeScript',
    stars: 15240,
    trending_score: 156.8,
    star_change: 89.7,
    pr_change: 67.4,
    contributor_change: 23.1,
    last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/continuedev.png',
    html_url: 'https://github.com/continuedev/continue',
  },
  {
    id: 'repo-2',
    owner: 'microsoft',
    name: 'typescript',
    description: 'TypeScript is a superset of JavaScript that compiles to clean JavaScript output.',
    language: 'TypeScript',
    stars: 98450,
    trending_score: 134.2,
    star_change: 45.3,
    pr_change: 78.9,
    contributor_change: 15.6,
    last_activity: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/microsoft.png',
    html_url: 'https://github.com/microsoft/typescript',
  },
  {
    id: 'repo-3',
    owner: 'vercel',
    name: 'ai',
    description: 'Build AI-powered applications with React, Svelte, Vue, and Solid',
    language: 'TypeScript',
    stars: 8920,
    trending_score: 98.7,
    star_change: 67.2,
    pr_change: 34.8,
    contributor_change: 45.3,
    last_activity: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/vercel.png',
    html_url: 'https://github.com/vercel/ai',
  },
  {
    id: 'repo-4',
    owner: 'vitejs',
    name: 'vite',
    description: "Next generation frontend tooling. It's fast!",
    language: 'JavaScript',
    stars: 65420,
    trending_score: 87.3,
    star_change: 23.8,
    pr_change: 56.7,
    contributor_change: 12.4,
    last_activity: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/vitejs.png',
    html_url: 'https://github.com/vitejs/vite',
  },
  {
    id: 'repo-5',
    owner: 'facebook',
    name: 'react',
    description:
      'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
    language: 'JavaScript',
    stars: 225680,
    trending_score: 76.5,
    star_change: 12.3,
    pr_change: 89.2,
    contributor_change: 8.7,
    last_activity: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/facebook.png',
    html_url: 'https://github.com/facebook/react',
  },
  {
    id: 'repo-6',
    owner: 'rustlang',
    name: 'rust',
    description: 'Empowering everyone to build reliable and efficient software.',
    language: 'Rust',
    stars: 95340,
    trending_score: 65.2,
    star_change: 34.5,
    pr_change: 45.8,
    contributor_change: 19.3,
    last_activity: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/rust-lang.png',
    html_url: 'https://github.com/rust-lang/rust',
  },
  {
    id: 'repo-7',
    owner: 'python',
    name: 'cpython',
    description: 'The Python programming language',
    language: 'Python',
    stars: 61280,
    trending_score: 52.8,
    star_change: 18.7,
    pr_change: 67.3,
    contributor_change: 25.1,
    last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/python.png',
    html_url: 'https://github.com/python/cpython',
  },
  {
    id: 'repo-8',
    owner: 'golang',
    name: 'go',
    description: 'The Go programming language',
    language: 'Go',
    stars: 122340,
    trending_score: 48.3,
    star_change: 15.2,
    pr_change: 38.9,
    contributor_change: 11.6,
    last_activity: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    avatar_url: 'https://github.com/golang.png',
    html_url: 'https://github.com/golang/go',
  },
];

export const Default: Story = {
  args: {
    repositories: mockTrendingRepos,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    repositories: [],
    loading: true,
  },
};

export const Empty: Story = {
  args: {
    repositories: [],
    loading: false,
  },
};

export const SingleRepository: Story = {
  args: {
    repositories: [mockTrendingRepos[0]],
    loading: false,
  },
};

export const FewRepositories: Story = {
  args: {
    repositories: mockTrendingRepos.slice(0, 3),
    loading: false,
  },
};

export const TypeScriptOnly: Story = {
  args: {
    repositories: mockTrendingRepos.filter((repo) => repo.language === 'TypeScript'),
    loading: false,
  },
};

export const MixedLanguages: Story = {
  args: {
    repositories: [
      ...mockTrendingRepos,
      {
        id: 'repo-9',
        owner: 'flutter',
        name: 'flutter',
        description: 'Flutter makes it easy and fast to build beautiful apps for mobile and beyond',
        language: 'Dart',
        stars: 164280,
        trending_score: 72.4,
        star_change: 28.3,
        pr_change: 52.7,
        contributor_change: 16.8,
        last_activity: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        avatar_url: 'https://github.com/flutter.png',
        html_url: 'https://github.com/flutter/flutter',
      },
      {
        id: 'repo-10',
        owner: 'swift',
        name: 'swift',
        description: 'The Swift Programming Language',
        language: 'C++',
        stars: 67180,
        trending_score: 41.7,
        star_change: 9.8,
        pr_change: 73.2,
        contributor_change: 7.4,
        last_activity: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
        avatar_url: 'https://github.com/apple.png',
        html_url: 'https://github.com/apple/swift',
      },
    ],
    loading: false,
  },
};

export const LowTrendingScores: Story = {
  args: {
    repositories: mockTrendingRepos.map((repo) => ({
      ...repo,
      trending_score: repo.trending_score * 0.3,
      star_change: repo.star_change * 0.5,
      pr_change: repo.pr_change * 0.4,
      contributor_change: repo.contributor_change * 0.6,
    })),
    loading: false,
  },
};

export const NegativeChanges: Story = {
  args: {
    repositories: [
      {
        ...mockTrendingRepos[0],
        trending_score: 25.3,
        star_change: -15.2,
        pr_change: -8.7,
        contributor_change: -3.4,
      },
      {
        ...mockTrendingRepos[1],
        trending_score: 18.9,
        star_change: -22.8,
        pr_change: -12.5,
        contributor_change: -7.1,
      },
      {
        ...mockTrendingRepos[2],
        trending_score: 12.6,
        star_change: -5.3,
        pr_change: -18.9,
        contributor_change: -2.8,
      },
    ],
    loading: false,
  },
};

// Responsive stories
export const Mobile: Story = {
  args: {
    repositories: mockTrendingRepos,
    loading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const Tablet: Story = {
  args: {
    repositories: mockTrendingRepos,
    loading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

export const Desktop: Story = {
  args: {
    repositories: mockTrendingRepos,
    loading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'desktop',
    },
  },
};
