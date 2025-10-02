import { supabase } from '../supabase';
import { serverEnv } from '../env-server';

const GITHUB_API_BASE = 'https://api.github.com';

// Define error interface for GitHub API errors
interface GitHubApiError extends Error {
  status?: number;
}

// Server-side GitHub token for Inngest functions
const SERVER_GITHUB_TOKEN = (() => {
  // In development, we might use the client token for testing
  if (serverEnv.NODE_ENV === 'development') {
    return process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  }
  // In production, use the proper server token
  return process.env.GITHUB_TOKEN || '';
})();

export async function getGitHubHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  // For server-side operations (like Inngest), use the server token
  if (SERVER_GITHUB_TOKEN) {
    headers['Authorization'] = `token ${SERVER_GITHUB_TOKEN}`;
    console.log(
      'Using server-side GitHub token for Inngest (token exists:',
      !!SERVER_GITHUB_TOKEN,
      ')'
    );
    return headers;
  }

  // Fallback: Try to get the user's GitHub token from Supabase session
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.provider_token) {
      headers['Authorization'] = `token ${session.provider_token}`;
      console.log('Using user session GitHub token');
    } else {
      console.warn('No GitHub token available, using unauthenticated requests');
    }
  } catch (error) {
    console.warn('Error getting GitHub session token:', error);
    console.warn('No GitHub token available, using unauthenticated requests');
  }

  return headers;
}

export async function makeGitHubRequest<T = unknown>(endpoint: string): Promise<T> {
  const headers = await getGitHubHeaders();

  // Add delay to prevent rate limiting (respectful API usage)
  await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay between requests

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    console.error(
      'GitHub API error: %s - %s',
      response.status,
      error.message || response.statusText
    );
    console.error('Endpoint: %s', endpoint);
    console.error('Has auth token: %s', !!headers['Authorization']);
    const apiError = new Error(
      `GitHub API error: ${error.message || response.statusText}`
    ) as GitHubApiError;
    apiError.status = response.status;
    throw apiError;
  }

  return response.json();
}

// Export a compatibility function for getOctokit
export function getOctokit() {
  return {
    rest: {
      pulls: {
        get: async (params: { owner: string; repo: string; pull_number: number }) => {
          const data = await makeGitHubRequest(
            `/repos/${params.owner}/${params.repo}/pulls/${params.pull_number}`
          );
          return { data };
        },
        listReviews: async (params: { owner: string; repo: string; pull_number: number }) => {
          const data = await makeGitHubRequest(
            `/repos/${params.owner}/${params.repo}/pulls/${params.pull_number}/reviews`
          );
          return { data };
        },
        listComments: async (params: { owner: string; repo: string; pull_number: number }) => {
          const data = await makeGitHubRequest(
            `/repos/${params.owner}/${params.repo}/pulls/${params.pull_number}/comments`
          );
          return { data };
        },
      },
      issues: {
        listComments: async (params: { owner: string; repo: string; issue_number: number }) => {
          const data = await makeGitHubRequest(
            `/repos/${params.owner}/${params.repo}/issues/${params.issue_number}/comments`
          );
          return { data };
        },
        listForRepo: async (params: {
          owner: string;
          repo: string;
          state?: 'open' | 'closed' | 'all';
          since?: string;
          per_page?: number;
          page?: number;
          sort?: 'created' | 'updated' | 'comments';
          direction?: 'asc' | 'desc';
        }) => {
          const queryParams = new URLSearchParams();
          if (params.state) queryParams.append('state', params.state);
          if (params.since) queryParams.append('since', params.since);
          if (params.per_page) queryParams.append('per_page', params.per_page.toString());
          if (params.page) queryParams.append('page', params.page.toString());
          if (params.sort) queryParams.append('sort', params.sort);
          if (params.direction) queryParams.append('direction', params.direction);

          const query = queryParams.toString();
          const data = await makeGitHubRequest(
            `/repos/${params.owner}/${params.repo}/issues${query ? `?${query}` : ''}`
          );
          return { data };
        },
      },
    },
  };
}
