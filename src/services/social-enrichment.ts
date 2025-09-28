import { supabase } from '@/lib/supabase';
import {
  isValidLinkedInUrl,
  isValidDiscordUrl,
  sanitizeLinkedInUrl,
  sanitizeDiscordUrl,
} from '@/lib/validation/url-validation';

interface SocialLinks {
  discord_url: string | null;
  linkedin_url: string | null;
}

interface GitHubProfile {
  login: string;
  bio?: string | null;
  blog?: string | null;
  company?: string | null;
  location?: string | null;
}

/**
 * Extract Discord URL from a text string
 * Looks for discord.gg links, discord.com links, or Discord usernames
 */
function extractDiscordUrl(text: string): string | null {
  if (!text) return null;

  // Match discord.gg/invite links
  const discordInviteMatch = text.match(
    /(?:https?:\/\/)?(?:www\.)?discord\.(?:gg|com\/invite)\/[\w-]+/i
  );
  if (discordInviteMatch) {
    return discordInviteMatch[0].startsWith('http')
      ? discordInviteMatch[0]
      : `https://${discordInviteMatch[0]}`;
  }

  // Match Discord usernames (e.g., @username or username#1234)
  const discordUsernameMatch = text.match(/@?[\w.-]+#\d{4}/);
  if (discordUsernameMatch) {
    return `discord:${discordUsernameMatch[0].replace('@', '')}`;
  }

  return null;
}

/**
 * Extract LinkedIn URL from a text string
 */
function extractLinkedInUrl(text: string): string | null {
  if (!text) return null;

  // Match LinkedIn profile URLs
  const linkedInMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\/?/i);
  if (linkedInMatch) {
    return linkedInMatch[0].startsWith('http') ? linkedInMatch[0] : `https://${linkedInMatch[0]}`;
  }

  return null;
}

/**
 * Fetch GitHub user profile and extract social links
 */
export async function fetchGitHubProfileSocialLinks(username: string): Promise<SocialLinks> {
  try {
    console.log(`=== Fetching GitHub profile for ${username} ===`);

    // Get the user's GitHub token from Supabase session (same pattern as search)
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userToken = session?.provider_token;

    // Use user's token if available, otherwise fall back to env token
    const githubToken = userToken || import.meta.env.VITE_GITHUB_TOKEN;

    console.log('GitHub token available:', !!githubToken);
    console.log('Using user token:', !!userToken);

    if (!githubToken) {
      console.warn(
        'No GitHub token found. GraphQL API will not be available. Only REST API will be used.'
      );
    }

    // Try GraphQL API first to get social accounts
    if (githubToken) {
      const graphqlHeaders: HeadersInit = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${githubToken}`,
      };

      const graphqlQuery = {
        query: `
          query GetUserSocialAccounts($username: String!) {
            user(login: $username) {
              socialAccounts(first: 10) {
                nodes {
                  provider
                  url
                  displayName
                }
              }
              bio
              websiteUrl
              company
              location
            }
          }
        `,
        variables: { username },
      };

      try {
        console.log('Making GraphQL request to GitHub API...');
        const graphqlResponse = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: graphqlHeaders,
          body: JSON.stringify(graphqlQuery),
        });

        console.log('GraphQL response status:', graphqlResponse.status);

        if (graphqlResponse.ok) {
          const data = await graphqlResponse.json();
          console.log('GraphQL response data:', JSON.stringify(data, null, 2));

          if (data.data?.user) {
            const user = data.data.user;
            let discord_url: string | null = null;
            let linkedin_url: string | null = null;

            // Check social accounts
            if (user.socialAccounts?.nodes) {
              console.log('Social accounts found:', user.socialAccounts.nodes);
              for (const account of user.socialAccounts.nodes) {
                console.log('Checking account:', account);
                if (
                  account.provider === 'LINKEDIN' ||
                  (typeof account.url === 'string' && isValidLinkedInUrl(account.url))
                ) {
                  linkedin_url = sanitizeLinkedInUrl(account.url) || account.url;
                  console.log('Found LinkedIn URL:', linkedin_url);
                }
                if (
                  account.provider === 'DISCORD' ||
                  (typeof account.url === 'string' && isValidDiscordUrl(account.url))
                ) {
                  discord_url = sanitizeDiscordUrl(account.url) || account.url;
                  console.log('Found Discord URL:', discord_url);
                }
              }
            }

            // Also check bio and other fields as fallback
            const searchText = [user.bio, user.websiteUrl, user.company, user.location]
              .filter(Boolean)
              .join(' ');

            if (!discord_url) {
              const extracted = extractDiscordUrl(searchText);
              discord_url =
                extracted && isValidDiscordUrl(extracted) ? sanitizeDiscordUrl(extracted) : null;
            }
            if (!linkedin_url) {
              const extracted = extractLinkedInUrl(searchText);
              linkedin_url =
                extracted && isValidLinkedInUrl(extracted) ? sanitizeLinkedInUrl(extracted) : null;
            }

            console.log('Final social links from GraphQL:', { discord_url, linkedin_url });
            return { discord_url, linkedin_url };
          } else {
            console.warn('GraphQL response missing user data:', data);
          }
        } else {
          const errorText = await graphqlResponse.text();
          console.error('GraphQL request failed:', graphqlResponse.status, errorText);
        }
      } catch (graphqlError) {
        console.error('GraphQL error, falling back to REST API:', graphqlError);
      }
    } else {
      console.log('No token available, skipping GraphQL API');
    }

    // Fall back to REST API
    console.log('Falling back to REST API...');
    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ContributorInfo/1.0',
    };

    // Use the same token we determined above (user's token or fallback)
    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
      console.log('Using auth token for REST API request');
    }

    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers,
    });

    if (!response.ok) {
      console.error(`Failed to fetch GitHub profile for ${username}: ${response.status}`);
      const errorText = await response.text();
      console.error('GitHub API error:', errorText);
      return { discord_url: null, linkedin_url: null };
    }

    const profile: GitHubProfile = await response.json();
    console.log('GitHub profile fetched (REST):', profile);

    // Check bio, blog, company, and location fields for social links
    const searchText = [profile.bio, profile.blog, profile.company, profile.location]
      .filter(Boolean)
      .join(' ');

    console.log('Searching for social links in:', searchText);

    const discord_url = extractDiscordUrl(searchText);
    const linkedin_url = extractLinkedInUrl(searchText);

    console.log('Found social links from REST:', { discord_url, linkedin_url });

    return { discord_url, linkedin_url };
  } catch (error) {
    console.error(`Error fetching GitHub profile for ${username}:`, error);
    return { discord_url: null, linkedin_url: null };
  }
}

/**
 * Update contributor's social links in the database
 */
export async function updateContributorSocialLinks(
  contributorId: string,
  socialLinks: SocialLinks
): Promise<void> {
  const { error } = await supabase
    .from('contributors')
    .update({
      discord_url: socialLinks.discord_url,
      linkedin_url: socialLinks.linkedin_url,
    })
    .eq('id', contributorId);

  if (error) {
    console.error('Error updating contributor social links:', error);
    throw error;
  }
}

/**
 * Fetch and update social links for a contributor by username
 */
export async function fetchAndUpdateSocialLinks(
  contributorId: string,
  username: string
): Promise<SocialLinks> {
  const socialLinks = await fetchGitHubProfileSocialLinks(username);

  // Only update if we found at least one social link
  if (socialLinks.discord_url || socialLinks.linkedin_url) {
    await updateContributorSocialLinks(contributorId, socialLinks);
  }

  return socialLinks;
}

/**
 * Batch process multiple contributors to fetch their social links
 */
export async function batchFetchSocialLinks(
  contributors: Array<{ id: string; username: string }>
): Promise<void> {
  const promises = contributors.map(async (contributor) => {
    try {
      await fetchAndUpdateSocialLinks(contributor.id, contributor.username);
    } catch (error) {
      console.error(`Failed to fetch social links for ${contributor.username}:`, error);
    }
  });

  await Promise.allSettled(promises);
}
