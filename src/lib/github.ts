import { supabase } from './supabase';
import type { PullRequest } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

// Export the fetchUserOrganizations function to fix the missing export error
export async function fetchUserOrganizations(username: string, headers: HeadersInit): Promise<{ login: string; avatar_url: string; }[]> {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/users/${username}/orgs`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const orgs = await response.json();
    return orgs.slice(0, 3).map((org: any) => ({
      login: org.login,
      avatar_url: org.avatar_url,
    }));
  } catch (error) {
    return [];
  }
}

async function fetchPRReviews(owner: string, repo: string, prNumber: number, headers: HeadersInit) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const reviews = await response.json();
    return reviews.map((review: any) => ({
      id: review.id,
      state: review.state,
      user: {
        login: review.user.login,
        avatar_url: review.user.avatar_url
      },
      submitted_at: review.submitted_at
    }));
  } catch (error) {
    return [];
  }
}

async function fetchPRComments(owner: string, repo: string, prNumber: number, headers: HeadersInit) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const comments = await response.json();
    return comments.map((comment: any) => ({
      id: comment.id,
      user: {
        login: comment.user.login,
        avatar_url: comment.user.avatar_url
      },
      created_at: comment.created_at
    }));
  } catch (error) {
    return [];
  }
}

export async function fetchPullRequests(owner: string, repo: string, timeRange: string = '30'): Promise<PullRequest[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    // Calculate date range based on timeRange parameter
    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100&since=${since.toISOString()}`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        throw new Error(`Repository "${owner}/${repo}" not found. Please check if the repository exists and is public.`);
      } else if (response.status === 403 && error.message?.includes('rate limit')) {
        if (!token) {
          throw new Error('GitHub API rate limit exceeded. Please log in with GitHub to increase the rate limit.');
        } else {
          throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }
      } else if (response.status === 401) {
        throw new Error('Invalid GitHub token. Please check your token and try again. Make sure you\'ve copied the entire token correctly.');
      }
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    const prs = await response.json();
    
    // Filter PRs by the time range
    const filteredPRs = prs.filter((pr: any) => {
      const prDate = new Date(pr.updated_at);
      return prDate >= since;
    });
    
    // Fetch additional details for each PR to get additions/deletions
    const detailedPRs = await Promise.all(
      filteredPRs.map(async (pr: any) => {
        const detailsResponse = await fetch(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`,
          { headers }
        );

        if (!detailsResponse.ok) {
          return {
            ...pr,
            additions: 0,
            deletions: 0,
          };
        }

        const details = await detailsResponse.json();
        
        // Fetch user's organizations
        const organizations = await fetchUserOrganizations(pr.user.login, headers);
        
        // Fetch PR reviews and comments (in parallel)
        const [reviews, comments] = await Promise.all([
          fetchPRReviews(owner, repo, pr.number, headers),
          fetchPRComments(owner, repo, pr.number, headers)
        ]);
        
        // Check if user is a bot by their type or by checking if name contains [bot]
        const isBot = 
          pr.user.type === 'Bot' || 
          pr.user.login.includes('[bot]');
        
        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          merged_at: pr.merged_at,
          closed_at: pr.closed_at,
          additions: details.additions,
          deletions: details.deletions,
          repository_owner: owner,
          repository_name: repo,
          html_url: pr.html_url,
          user: {
            id: pr.user.id,
            login: pr.user.login,
            avatar_url: pr.user.avatar_url,
            type: isBot ? 'Bot' : 'User',
          },
          organizations,
          reviews,
          comments
        };
      })
    );

    return detailedPRs;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred while fetching repository data.');
  }
}

export async function fetchRepositoryInfo(owner: string, repo: string): Promise<{
  id: number;
  name: string;
  full_name: string;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  language: string | null;
  fork: boolean;
  archived: boolean;
  disabled: boolean;
  private: boolean;
} | null> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env token
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Repository not found or not accessible
      }
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const repoData = await response.json();
    return {
      id: repoData.id,
      name: repoData.name,
      full_name: repoData.full_name,
      stargazers_count: repoData.stargazers_count,
      forks_count: repoData.forks_count,
      watchers_count: repoData.watchers_count,
      open_issues_count: repoData.open_issues_count,
      created_at: repoData.created_at,
      updated_at: repoData.updated_at,
      pushed_at: repoData.pushed_at,
      size: repoData.size,
      language: repoData.language,
      fork: repoData.fork,
      archived: repoData.archived,
      disabled: repoData.disabled,
      private: repoData.private,
    };
  } catch (error) {
    console.error('Error fetching repository info:', error);
    return null;
  }
}

export async function fetchRepositoryStargazers(owner: string, repo: string, limit: number = 100): Promise<{
  login: string;
  avatar_url: string;
  starred_at: string;
}[]> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3.star+json', // This gives us starred_at timestamps
  };

  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/stargazers?per_page=${Math.min(limit, 100)}&sort=created&direction=desc`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const stargazers = await response.json();
    return stargazers.map((star: any) => ({
      login: star.user?.login || star.login,
      avatar_url: star.user?.avatar_url || star.avatar_url,
      starred_at: star.starred_at || new Date().toISOString(), // Fallback if no timestamp
    }));
  } catch (error) {
    console.error('Error fetching stargazers:', error);
    return [];
  }
}

export async function fetchRepositoryCommitActivity(owner: string, repo: string, timeRange: string = '30'): Promise<{
  totalCommits: number;
  commitFrequency: number; // commits per day
  uniqueCommitters: number;
  recentCommits: Array<{
    sha: string;
    author: {
      login: string;
      avatar_url: string;
    };
    commit: {
      message: string;
      author: {
        date: string;
      };
    };
  }>;
}> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    // Calculate date range
    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));
    
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?since=${since.toISOString()}&per_page=100`,
      { headers }
    );

    if (!response.ok) {
      return { totalCommits: 0, commitFrequency: 0, uniqueCommitters: 0, recentCommits: [] };
    }

    const commits = await response.json();
    const uniqueCommitters = new Set();
    const recentCommits = commits.slice(0, 10).map((commit: any) => {
      if (commit.author?.login) {
        uniqueCommitters.add(commit.author.login);
      }
      return {
        sha: commit.sha,
        author: {
          login: commit.author?.login || 'unknown',
          avatar_url: commit.author?.avatar_url || '',
        },
        commit: {
          message: commit.commit.message,
          author: {
            date: commit.commit.author.date,
          },
        },
      };
    });

    const totalCommits = commits.length;
    const commitFrequency = totalCommits / parseInt(timeRange);

    return {
      totalCommits,
      commitFrequency,
      uniqueCommitters: uniqueCommitters.size,
      recentCommits,
    };
  } catch (error) {
    console.error('Error fetching commit activity:', error);
    return { totalCommits: 0, commitFrequency: 0, uniqueCommitters: 0, recentCommits: [] };
  }
}

export async function fetchDirectCommits(owner: string, repo: string, timeRange: string = '30'): Promise<{
  directCommits: Array<{
    sha: string;
    actor: {
      login: string;
      avatar_url: string;
      type?: 'User' | 'Bot';
    };
    event_time: string;
    push_num_commits: number;
  }>;
  hasYoloCoders: boolean;
  yoloCoderStats: Array<{
    login: string;
    avatar_url: string;
    directCommits: number;
    totalPushedCommits: number;
    type?: 'User' | 'Bot';
  }>;
}> {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  // Try to get user's GitHub token from Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const userToken = session?.provider_token;

  // Use user's token if available, otherwise fall back to env tokerm -rf src/github-activityn
  const token = userToken || import.meta.env.VITE_GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }

  try {
    // First, get the default branch for the repository
    const repoResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { headers }
    );

    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository information: ${repoResponse.statusText}`);
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch;
    const defaultRef = `refs/heads/${defaultBranch}`;

    // Calculate date range based on timeRange parameter
    const since = new Date();
    since.setDate(since.getDate() - parseInt(timeRange));

    // Get merged PRs for the repository in the time range
    const pullRequests = await fetchPullRequests(owner, repo, timeRange);
    const mergedPRs = pullRequests.filter(pr => pr.merged_at);
    
    // Get the merge commit SHAs of the merged PRs
    const prMergeShaSet = new Set<string>();
    
    await Promise.all(
      mergedPRs.map(async (pr) => {
        try {
          // Fetch the PR details to get the merge commit SHA
          const prResponse = await fetch(
            `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`,
            { headers }
          );
          
          if (prResponse.ok) {
            const prData = await prResponse.json();
            if (prData.merge_commit_sha) {
              prMergeShaSet.add(prData.merge_commit_sha);
            }
          }
        } catch (error) {
          // Silently handle merge commit SHA fetch errors
        }
      })
    );

    // Fetch push events for the repository
    // Note: GitHub API doesn't have a direct way to get push events for a specific branch,
    // so we'll fetch all events and filter for push events to the default branch
    const eventsResponse = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/events?per_page=100`,
      { headers }
    );

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch repository events: ${eventsResponse.statusText}`);
    }

    const events = await eventsResponse.json();
    
    // Filter for push events to the default branch
    const pushEvents = events.filter((event: any) => {
      // Check if it's a push event to the default branch
      return event.type === 'PushEvent' && 
             event.payload.ref === defaultRef &&
             new Date(event.created_at) >= since;
    });

    // Identify YOLO pushes (pushes to default branch that don't correlate with PR merges)
    const yoloPushes = pushEvents.filter((push: any) => {
      return !prMergeShaSet.has(push.payload.head);
    });

    // Format the YOLO pushes data
    const directCommits = await Promise.all(yoloPushes.map(async (push: any) => {
      // Fetch user details to get avatar URL
      let avatar_url = '';
      try {
        const userResponse = await fetch(
          `${GITHUB_API_BASE}/users/${push.actor.login}`,
          { headers }
        );
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          avatar_url = userData.avatar_url;
        }
      } catch (error) {
        // Silently handle user details fetch errors
      }

      return {
        sha: push.payload.head,
        actor: {
          login: push.actor.login,
          avatar_url,
          type: push.actor.login.includes('[bot]') ? 'Bot' : 'User'
        },
        event_time: push.created_at,
        push_num_commits: push.payload.size
      };
    }));

    // Calculate statistics for YOLO coders (authors with direct pushes)
    const yoloCoderMap = new Map<string, { 
      login: string; 
      avatar_url: string; 
      directCommits: number;
      totalPushedCommits: number;
      type?: 'User' | 'Bot'; 
    }>();

    for (const commit of directCommits) {
      const login = commit.actor.login;
      
      // Check if this is a bot
      const isBot = login.includes('[bot]');
      
      if (yoloCoderMap.has(login)) {
        const coder = yoloCoderMap.get(login)!;
        coder.directCommits += 1;
        coder.totalPushedCommits += commit.push_num_commits;
      } else {
        yoloCoderMap.set(login, {
          login,
          avatar_url: commit.actor.avatar_url,
          directCommits: 1,
          totalPushedCommits: commit.push_num_commits,
          type: isBot ? 'Bot' : 'User',
        });
      }
    }

    const yoloCoderStats = Array.from(yoloCoderMap.values())
      .sort((a, b) => b.directCommits - a.directCommits);

    return {
      directCommits,
      hasYoloCoders: directCommits.length > 0,
      yoloCoderStats,
    };
  } catch (error) {
    return {
      directCommits: [],
      hasYoloCoders: false,
      yoloCoderStats: [],
    };
  }
}