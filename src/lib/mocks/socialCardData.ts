// Mock data for social card stories - deterministic for visual testing

export const mockContributors = [
  {
    login: 'octocat',
    avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    contributions: 127,
  },
  {
    login: 'torvalds',
    avatar_url: 'https://avatars.githubusercontent.com/u/1024025?v=4',
    contributions: 89,
  },
  {
    login: 'gaearon',
    avatar_url: 'https://avatars.githubusercontent.com/u/810438?v=4',
    contributions: 73,
  },
  {
    login: 'addyosmani',
    avatar_url: 'https://avatars.githubusercontent.com/u/110953?v=4',
    contributions: 45,
  },
  {
    login: 'sindresorhus',
    avatar_url: 'https://avatars.githubusercontent.com/u/170270?v=4',
    contributions: 31,
  },
];

export const mockRepoStats = {
  popular: {
    totalContributors: 1247,
    totalPRs: 8934,
    mergedPRs: 7823,
    topContributors: mockContributors,
  },

  growing: {
    totalContributors: 156,
    totalPRs: 423,
    mergedPRs: 389,
    topContributors: mockContributors.slice(0, 3),
  },

  minimal: {
    totalContributors: 3,
    totalPRs: 12,
    mergedPRs: 10,
    topContributors: mockContributors.slice(0, 2),
  },

  enterprise: {
    totalContributors: 2847,
    totalPRs: 15672,
    mergedPRs: 14103,
    topContributors: mockContributors,
  },
};

export const mockRepositories = {
  react: {
    owner: 'facebook',
    repo: 'react',
    description: 'The library for web and native user interfaces',
    stars: 228000,
    stats: mockRepoStats.popular,
  },

  vue: {
    owner: 'vuejs',
    repo: 'vue',
    description: 'The Progressive JavaScript Framework',
    stars: 207000,
    stats: mockRepoStats.growing,
  },

  'awesome-project': {
    owner: 'developer',
    repo: 'awesome-project',
    description: 'An awesome open source project for testing',
    stars: 42,
    stats: mockRepoStats.minimal,
  },

  'enterprise-platform': {
    owner: 'bigcorp',
    repo: 'enterprise-platform',
    description: 'Large-scale enterprise application platform',
    stars: 5600,
    stats: mockRepoStats.enterprise,
  },

  'super-long-repository-name-that-might-overflow': {
    owner: 'organization-with-very-long-name',
    repo: 'super-long-repository-name-that-might-overflow-the-card-layout',
    description:
      'Testing repository with extremely long names to ensure proper text truncation and layout handling',
    stars: 123,
    stats: mockRepoStats.minimal,
  },
};

export const mockHomeStats = {
  totalRepositories: 2847,
  totalContributors: 156842,
  totalContributions: 892341,
  featuredRepos: ['facebook/react', 'vuejs/vue', 'microsoft/vscode', 'torvalds/linux'],
};
