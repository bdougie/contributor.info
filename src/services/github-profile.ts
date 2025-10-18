import { supabase } from '@/lib/supabase';

interface GitHubUserProfile {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
}

/**
 * Fetch user profile information from GitHub API
 * @param username - GitHub username
 * @returns User profile data including company information
 */
export async function fetchGitHubUserProfile(username: string): Promise<GitHubUserProfile | null> {
  try {
    console.log(`Fetching GitHub profile for ${username}`);

    // Get the user's GitHub token from Supabase session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userToken = session?.provider_token;

    // Use user's token if available, otherwise fall back to env token
    const githubToken = userToken || import.meta.env.VITE_GITHUB_TOKEN;

    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ContributorInfo/1.0',
    };

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers,
    });

    if (!response.ok) {
      console.error(`Failed to fetch GitHub profile for ${username}: ${response.status}`);
      return null;
    }

    const profile: GitHubUserProfile = await response.json();
    console.log(`Successfully fetched profile for ${username}`, {
      company: profile.company,
      location: profile.location,
    });

    return profile;
  } catch (error) {
    console.error(`Error fetching GitHub profile for ${username}:`, error);
    return null;
  }
}

/**
 * Fetch user profile with GraphQL API for more detailed information
 * @param username - GitHub username
 * @returns User profile data with additional fields
 */
export async function fetchGitHubUserProfileGraphQL(username: string): Promise<{
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  websiteUrl: string | null;
  organizations: Array<{
    login: string;
    avatarUrl: string;
    name: string | null;
  }>;
} | null> {
  try {
    console.log(`Fetching GitHub profile via GraphQL for ${username}`);

    // Get the user's GitHub token from Supabase session
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userToken = session?.provider_token;

    // Use user's token if available, otherwise fall back to env token
    const githubToken = userToken || import.meta.env.VITE_GITHUB_TOKEN;

    if (!githubToken) {
      console.warn('No GitHub token available, falling back to REST API');
      const restProfile = await fetchGitHubUserProfile(username);
      if (!restProfile) return null;

      return {
        login: restProfile.login,
        name: restProfile.name,
        company: restProfile.company,
        location: restProfile.location,
        bio: restProfile.bio,
        websiteUrl: restProfile.blog,
        organizations: [],
      };
    }

    const graphqlHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${githubToken}`,
    };

    const graphqlQuery = {
      query: `
        query GetUserProfile($username: String!) {
          user(login: $username) {
            login
            name
            company
            location
            bio
            websiteUrl
            organizations(first: 10) {
              nodes {
                login
                avatarUrl
                name
              }
            }
          }
        }
      `,
      variables: { username },
    };

    const graphqlResponse = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: graphqlHeaders,
      body: JSON.stringify(graphqlQuery),
    });

    if (!graphqlResponse.ok) {
      console.error('GraphQL request failed:', graphqlResponse.status);
      // Fall back to REST API
      const restProfile = await fetchGitHubUserProfile(username);
      if (!restProfile) return null;

      return {
        login: restProfile.login,
        name: restProfile.name,
        company: restProfile.company,
        location: restProfile.location,
        bio: restProfile.bio,
        websiteUrl: restProfile.blog,
        organizations: [],
      };
    }

    const data = await graphqlResponse.json();

    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return null;
    }

    if (!data.data?.user) {
      console.warn('User not found in GraphQL response');
      return null;
    }

    const user = data.data.user;
    console.log(`Successfully fetched profile via GraphQL for ${username}`, {
      company: user.company,
      location: user.location,
      organizationCount: user.organizations?.nodes?.length || 0,
    });

    return {
      login: user.login,
      name: user.name,
      company: user.company,
      location: user.location,
      bio: user.bio,
      websiteUrl: user.websiteUrl,
      organizations: user.organizations?.nodes || [],
    };
  } catch (error) {
    console.error(`Error fetching GitHub profile via GraphQL for ${username}:`, error);
    return null;
  }
}

/**
 * Update contributor profile information in the database
 * @param username - GitHub username
 * @param profileData - Profile data to update
 */
export async function updateContributorProfile(
  username: string,
  profileData: {
    company?: string | null;
    location?: string | null;
    bio?: string | null;
    blog?: string | null;
    display_name?: string | null;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('contributors')
      .update({
        company: profileData.company,
        location: profileData.location,
        bio: profileData.bio,
        blog: profileData.blog,
        display_name: profileData.display_name,
        last_updated_at: new Date().toISOString(),
      })
      .eq('username', username);

    if (error) {
      console.error('Error updating contributor profile:', error);
      throw error;
    }

    console.log(`Successfully updated profile for ${username}`);
  } catch (error) {
    console.error(`Failed to update contributor profile for ${username}:`, error);
  }
}

/**
 * Fetch and cache user profile data
 * @param username - GitHub username
 * @returns Complete profile data with company information
 */
export async function fetchAndCacheUserProfile(username: string): Promise<{
  login: string;
  name: string | null;
  company: string | null;
  location: string | null;
  bio: string | null;
  websiteUrl: string | null;
  organizations: Array<{
    login: string;
    avatarUrl: string;
    name: string | null;
  }>;
} | null> {
  try {
    // Try GraphQL first for complete data
    const profile = await fetchGitHubUserProfileGraphQL(username);

    if (profile) {
      // Update the database with the fetched profile data
      await updateContributorProfile(username, {
        company: profile.company,
        location: profile.location,
        bio: profile.bio,
        blog: profile.websiteUrl,
        display_name: profile.name,
      });
    }

    return profile;
  } catch (error) {
    console.error(`Error fetching and caching profile for ${username}:`, error);
    return null;
  }
}
