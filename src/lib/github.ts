import { supabase } from './supabase';
import type { PullRequest } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

async function fetchUserOrganizations(username: string, headers: HeadersInit): Promise<{ login: string; avatar_url: string; }[]> {
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
    console.error('Error fetching user organizations:', error);
    return [];
  }
}

export async function fetchPullRequests(owner: string, repo: string): Promise<PullRequest[]> {
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
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`,
      { headers }
    );

    if (!response.ok) {
      const error = await response.json();
      if (response.status === 404) {
        throw new Error(`Repository "${owner}/${repo}" not found. Please check if the repository exists and is public.`);
      } else if (response.status === 403 && error.message?.includes('rate limit')) {
        throw new Error(
          token
            ? 'GitHub API rate limit exceeded. Please try again later.'
            : 'GitHub API rate limit exceeded. Please log in with GitHub to increase the rate limit.'
        );
      } else if (response.status === 401) {
        throw new Error('Invalid GitHub token. Please check your token and try again. Make sure you\'ve copied the entire token correctly.');
      }
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }

    const prs = await response.json();
    
    // Fetch additional details for each PR to get additions/deletions
    const detailedPRs = await Promise.all(
      prs.map(async (pr: any) => {
        const detailsResponse = await fetch(
          `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${pr.number}`,
          { headers }
        );

        if (!detailsResponse.ok) {
          console.warn(`Failed to fetch details for PR #${pr.number}`);
          return {
            ...pr,
            additions: 0,
            deletions: 0,
          };
        }

        const details = await detailsResponse.json();
        
        // Fetch user's organizations
        const organizations = await fetchUserOrganizations(pr.user.login, headers);
        
        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          state: pr.state,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          merged_at: pr.merged_at,
          additions: details.additions,
          deletions: details.deletions,
          repository_owner: owner,
          repository_name: repo,
          user: {
            id: pr.user.id,
            login: pr.user.login,
            avatar_url: pr.user.avatar_url,
          },
          organizations,
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