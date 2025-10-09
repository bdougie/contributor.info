/**
 * Database Utilities for Edge Functions
 * 
 * Shared utilities for database operations including Supabase client creation
 * and common data operations like contributor upserts.
 * 
 * @module database
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * GitHub user data structure from API responses
 */
export interface GitHubUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  type?: string;
}

/**
 * Extended GitHub user data from GraphQL responses
 */
export interface GitHubUserExtended extends GitHubUser {
  bio?: string | null;
  company?: string | null;
  location?: string | null;
  blog?: string | null;
  followers?: number;
  following?: number;
  public_repos?: number;
  github_created_at?: string;
}

/**
 * Creates a Supabase client with service role key
 * 
 * @returns {SupabaseClient} Configured Supabase client
 * @throws {Error} If required environment variables are missing
 * 
 * @example
 * const supabase = createSupabaseClient();
 * const { data, error } = await supabase.from('contributors').select('*');
 */
export const createSupabaseClient = (): SupabaseClient => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing required Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Ensures a contributor exists in the database, creating or updating as needed
 * 
 * This function handles the common pattern of upserting contributor records
 * when processing GitHub events or syncing repository data. It automatically
 * detects bot accounts and maintains contributor metadata.
 * 
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {GitHubUser | GitHubUserExtended} userData - GitHub user data to upsert
 * @returns {Promise<string | null>} The contributor's database ID, or null on error
 * 
 * @example
 * const contributorId = await ensureContributor(supabase, {
 *   id: 12345,
 *   login: 'octocat',
 *   name: 'The Octocat',
 *   avatar_url: 'https://github.com/images/error/octocat_happy.gif',
 *   type: 'User'
 * });
 */
export async function ensureContributor(
  supabase: SupabaseClient,
  userData: GitHubUser | GitHubUserExtended
): Promise<string | null> {
  if (!userData || !userData.id) {
    console.error('Invalid user data provided to ensureContributor');
    return null;
  }

  try {
    const extendedData = userData as GitHubUserExtended;
    const upsertData: Record<string, unknown> = {
      github_id: userData.id,
      username: userData.login,
      display_name: userData.name || null,
      email: userData.email || null,
      avatar_url: userData.avatar_url || null,
      profile_url: `https://github.com/${userData.login}`,
      is_bot: userData.type === 'Bot' || userData.login.includes('[bot]'),
      is_active: true,
      last_updated_at: new Date().toISOString(),
    };

    // Add extended fields if available
    if (extendedData.bio !== undefined) {
      upsertData.bio = extendedData.bio;
    }
    if (extendedData.company !== undefined) {
      upsertData.company = extendedData.company;
    }
    if (extendedData.location !== undefined) {
      upsertData.location = extendedData.location;
    }
    if (extendedData.blog !== undefined) {
      upsertData.blog = extendedData.blog;
    }
    if (extendedData.followers !== undefined) {
      upsertData.followers = extendedData.followers;
    }
    if (extendedData.following !== undefined) {
      upsertData.following = extendedData.following;
    }
    if (extendedData.public_repos !== undefined) {
      upsertData.public_repos = extendedData.public_repos;
    }
    if (extendedData.github_created_at) {
      upsertData.github_created_at = extendedData.github_created_at;
    }

    const { data, error } = await supabase
      .from('contributors')
      .upsert(
        upsertData,
        {
          onConflict: 'github_id',
          ignoreDuplicates: false,
        }
      )
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('Error upserting contributor %s:', userData.login, error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Exception in ensureContributor for %s:', userData.login, error);
    return null;
  }
}

/**
 * Gets an existing contributor by GitHub ID
 * 
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {number} githubId - GitHub user ID
 * @returns {Promise<string | null>} The contributor's database ID, or null if not found
 * 
 * @example
 * const contributorId = await getContributorByGitHubId(supabase, 12345);
 */
export async function getContributorByGitHubId(
  supabase: SupabaseClient,
  githubId: number
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('contributors')
      .select('id')
      .eq('github_id', githubId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching contributor by GitHub ID %s:', githubId, error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Exception in getContributorByGitHubId for %s:', githubId, error);
    return null;
  }
}

/**
 * Gets or creates a contributor (checks if exists first, then creates if needed)
 * 
 * This is a lighter alternative to ensureContributor when you want to avoid
 * unnecessary upserts for contributors that already exist.
 * 
 * @param {SupabaseClient} supabase - Supabase client instance
 * @param {GitHubUser} userData - GitHub user data
 * @returns {Promise<string | null>} The contributor's database ID, or null on error
 * 
 * @example
 * const contributorId = await getOrCreateContributor(supabase, githubUser);
 */
export async function getOrCreateContributor(
  supabase: SupabaseClient,
  userData: GitHubUser
): Promise<string | null> {
  // First check if contributor exists
  const existingId = await getContributorByGitHubId(supabase, userData.id);
  if (existingId) {
    return existingId;
  }

  // If not, create the contributor
  return await ensureContributor(supabase, userData);
}
