import { supabase } from '../supabase';
import { serverEnv } from '../env';

const GITHUB_API_BASE = 'https://api.github.com';

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
    'Accept': 'application/vnd.github.v3+json',
  };

  // For server-side operations (like Inngest), use the server token
  if (SERVER_GITHUB_TOKEN) {
    headers['Authorization'] = `token ${SERVER_GITHUB_TOKEN}`;
    console.log('Using server-side GitHub token for Inngest');
    return headers;
  }

  // Fallback: Try to get the user's GitHub token from Supabase session
  try {
    const { data: { session } } = await supabase.auth.getSession();
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

export async function makeGitHubRequest(endpoint: string): Promise<any> {
  const headers = await getGitHubHeaders();
  
  // Add delay to prevent rate limiting (respectful API usage)
  await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay between requests
  
  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, {
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    const apiError = new Error(`GitHub API error: ${error.message || response.statusText}`);
    (apiError as any).status = response.status;
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
          const data = await makeGitHubRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.pull_number}`);
          return { data };
        },
        listReviews: async (params: { owner: string; repo: string; pull_number: number }) => {
          const data = await makeGitHubRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.pull_number}/reviews`);
          return { data };
        },
        listComments: async (params: { owner: string; repo: string; pull_number: number }) => {
          const data = await makeGitHubRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.pull_number}/comments`);
          return { data };
        }
      },
      issues: {
        listComments: async (params: { owner: string; repo: string; issue_number: number }) => {
          const data = await makeGitHubRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issue_number}/comments`);
          return { data };
        }
      }
    }
  };
}