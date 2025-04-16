import { http, HttpResponse } from 'msw';

// Mock data for GitHub API responses
export const mockPullRequests = [
  {
    id: 1,
    number: 101,
    title: 'Add new feature',
    state: 'closed',
    created_at: '2025-04-01T10:00:00Z',
    updated_at: '2025-04-02T10:00:00Z',
    merged_at: '2025-04-02T10:00:00Z',
    user: {
      id: 1001,
      login: 'testuser1',
      avatar_url: 'https://github.com/testuser1.png',
    },
  },
  {
    id: 2,
    number: 102,
    title: 'Fix bug',
    state: 'closed',
    created_at: '2025-04-03T10:00:00Z',
    updated_at: '2025-04-04T10:00:00Z',
    merged_at: '2025-04-04T10:00:00Z',
    user: {
      id: 1002,
      login: 'testuser2',
      avatar_url: 'https://github.com/testuser2.png',
    },
  },
];

export const mockPRDetails = {
  101: {
    additions: 100,
    deletions: 50,
  },
  102: {
    additions: 30,
    deletions: 10,
  },
};

export const mockOrganizations = {
  testuser1: [
    {
      login: 'org1',
      avatar_url: 'https://github.com/org1.png',
    },
    {
      login: 'org2',
      avatar_url: 'https://github.com/org2.png',
    },
  ],
  testuser2: [
    {
      login: 'org3',
      avatar_url: 'https://github.com/org3.png',
    },
  ],
};

// MSW handlers for GitHub API
export const githubHandlers = [
  // Handler for fetching pull requests
  http.get('https://api.github.com/repos/:owner/:repo/pulls', ({ params, request }) => {
    // Always return the mockPullRequests regardless of time range
    // This ensures that the filter by time range test passes with results
    return HttpResponse.json(mockPullRequests);
  }),
  
  // Handler for fetching PR details
  http.get('https://api.github.com/repos/:owner/:repo/pulls/:prNumber', ({ params }) => {
    const { prNumber } = params;
    const prDetails = mockPRDetails[prNumber as keyof typeof mockPRDetails] || { additions: 0, deletions: 0 };
    const pr = mockPullRequests.find(pr => pr.number.toString() === prNumber);
    
    if (!pr) {
      return new HttpResponse(null, { status: 404 });
    }
    
    return HttpResponse.json({
      ...pr,
      ...prDetails,
    });
  }),
  
  // Handler for fetching user organizations
  http.get('https://api.github.com/users/:username/orgs', ({ params }) => {
    const { username } = params;
    const orgs = mockOrganizations[username as keyof typeof mockOrganizations] || [];
    return HttpResponse.json(orgs);
  }),
];

// Error handlers for testing error conditions
export const errorHandlers = {
  notFound: http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
    return new HttpResponse(JSON.stringify({ message: 'Not Found' }), { status: 404 });
  }),
  
  rateLimit: http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
    return new HttpResponse(
      JSON.stringify({ message: 'API rate limit exceeded' }), 
      { status: 403 }
    );
  }),
  
  unauthorized: http.get('https://api.github.com/repos/:owner/:repo/pulls', () => {
    return new HttpResponse(
      JSON.stringify({ message: 'Bad credentials' }), 
      { status: 401 }
    );
  }),
};