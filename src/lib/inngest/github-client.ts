import { supabase } from '../supabase';

const GITHUB_API_BASE = 'https://api.github.com';

export async function getGitHubHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };

  // Try to get the user's GitHub token from Supabase session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.provider_token) {
      headers['Authorization'] = `token ${session.provider_token}`;
    }
  } catch (error) {
    // Use unauthenticated requests if no token available
    console.warn('No GitHub token available, using unauthenticated requests');
  }

  return headers;
}

export async function makeGitHubRequest(endpoint: string): Promise<any> {
  const headers = await getGitHubHeaders();
  
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