import { supabase } from '@/lib/supabase';
import type { GitHubRepository } from '@/lib/github';

// Extended repository properties that may be available from GitHub API
export interface ExtendedGitHubRepository extends GitHubRepository {
  watchers_count?: number;
  watchers?: number;
  open_issues_count?: number;
  open_issues?: number;
  size?: number;
  homepage?: string | null;
  default_branch?: string;
  fork?: boolean;
  archived?: boolean;
  disabled?: boolean;
  has_issues?: boolean;
  has_projects?: boolean;
  has_wiki?: boolean;
  has_pages?: boolean;
  has_downloads?: boolean;
  license?: { spdx_id?: string };
  topics?: string[];
  created_at?: string;
  updated_at?: string;
}

/**
 * Create a repository in the database as a fallback when GitHub API is unavailable
 * WARNING: This is only for local development when API is unavailable
 * Production should always use the server-side API endpoint
 * Uses a negative github_id to avoid conflicts with real GitHub IDs
 */
export async function createRepositoryFallback(
  owner: string,
  name: string,
  repo?: Partial<ExtendedGitHubRepository>
) {
  // Only allow this in development environment
  if (import.meta.env.PROD) {
    console.error('Repository fallback creation attempted in production - this should use the API');
    return { data: null, error: new Error('Direct repository creation not allowed in production') };
  }

  // Generate a temporary github_id for local development (negative to avoid conflicts)
  const tempGithubId = -Math.floor(Math.random() * 1000000000);

  try {
    const { data, error } = await supabase
      .from('repositories')
      .insert({
        github_id: repo?.id || tempGithubId,
        owner,
        name,
        full_name: `${owner}/${name}`,
        description: repo?.description || null,
        language: repo?.language || null,
        stargazers_count: repo?.stargazers_count || 0,
        watchers_count: repo?.watchers_count || repo?.watchers || 0,
        forks_count: repo?.forks_count || 0,
        open_issues_count: repo?.open_issues_count || repo?.open_issues || 0,
        size: repo?.size || 0,
        // is_active is managed server-side, not set client-side
        // Extended properties if available
        homepage: repo?.homepage || null,
        default_branch: repo?.default_branch || 'main',
        is_fork: repo?.fork || false,
        is_archived: repo?.archived || false,
        is_disabled: repo?.disabled || false,
        is_private: repo?.private || false,
        has_issues: repo?.has_issues !== false,
        has_projects: repo?.has_projects !== false,
        has_wiki: repo?.has_wiki !== false,
        has_pages: repo?.has_pages || false,
        has_downloads: repo?.has_downloads !== false,
        license: repo?.license?.spdx_id || null,
        topics: repo?.topics || [],
        github_created_at: repo?.created_at || null,
        github_updated_at: repo?.updated_at || null,
        github_pushed_at: repo?.pushed_at || null,
      })
      .select('id')
      .single();

    if (error) {
      // Check if repository already exists
      if (error.code === '23505') {
        // Unique violation
        const { data: existingRepo } = await supabase
          .from('repositories')
          .select('id')
          .eq('owner', owner)
          .eq('name', name)
          .maybeSingle();

        if (existingRepo) {
          return { data: existingRepo, error: null };
        }
      }

      console.error('Failed to create repository %s/%s:', owner, name, error);
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    console.error('Unexpected error creating repository %s/%s:', owner, name, err);
    return { data: null, error: err };
  }
}

/**
 * Wait for a repository to be created in the database with exponential backoff
 * @param owner Repository owner
 * @param name Repository name
 * @param maxAttempts Maximum number of polling attempts (default 30)
 * @returns Repository ID if found, throws error on timeout
 */
export async function waitForRepository(
  owner: string,
  name: string,
  maxAttempts = 30
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', name)
      .maybeSingle();

    if (data) {
      console.log('Repository %s/%s found after %d attempts', owner, name, attempt + 1);
      return data.id;
    }

    // Exponential backoff with max delay of 2 seconds
    const delay = Math.min(100 * Math.pow(1.5, attempt), 2000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Repository creation timeout for ${owner}/${name} after ${maxAttempts} attempts`);
}

/**
 * Check if a repository exists in the database
 */
export async function checkRepositoryExists(owner: string, name: string) {
  const { data, error } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', name)
    .maybeSingle();

  return { exists: !!data, repositoryId: data?.id, error };
}
