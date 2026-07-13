import { getSupabase } from '@/lib/supabase-lazy';
import type { GitHubRepository } from '@/lib/github';

/** Row returned by {@link getRepositoryByOwnerName} — the superset of columns
 * every repo-view consumer needs, so one query serves all of them. */
export interface RepositoryIdentity {
  id: string;
  owner: string;
  name: string;
  last_updated_at: string | null;
}

declare global {
  interface Window {
    /**
     * Repository row prefetched by the ssr-repo edge function and inlined into
     * the HTML shell. Consumed one-shot by getRepositoryByOwnerName() so client
     * hooks skip the owner/name → id round trip on first load (#1815).
     */
    __REPO_SSR__?: RepositoryIdentity;
  }
}

/** Runtime validation for the SSR-injected payload (it crosses an HTML boundary). */
function isRepositoryIdentity(value: unknown): value is RepositoryIdentity {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.owner === 'string' &&
    (row.last_updated_at === null || typeof row.last_updated_at === 'string')
  );
}

/**
 * Consume the SSR-prefetched repository row if it matches the requested
 * owner/name. GitHub names are case-insensitive, so the comparison is too.
 * One-shot: the global is deleted on first use so client-side navigation to
 * other repositories never reuses stale data.
 */
function consumeSSRRepository(owner: string, name: string): RepositoryIdentity | null {
  if (typeof window === 'undefined') return null;

  const payload = window.__REPO_SSR__;
  if (!isRepositoryIdentity(payload)) return null;

  const matches =
    payload.owner.toLowerCase() === owner.toLowerCase() &&
    payload.name.toLowerCase() === name.toLowerCase();
  if (!matches) return null;

  delete window.__REPO_SSR__;
  return {
    id: payload.id,
    owner: payload.owner,
    name: payload.name,
    last_updated_at: payload.last_updated_at,
  };
}

// Promise-level dedup + short TTL cache for the owner/name → repository row
// lookup. Before this, every repo-view hook resolved the id independently,
// firing 4-6 identical queries per page view (#1815).
//
// Cache semantics matter here:
// - Concurrent callers share the in-flight promise (dedup).
// - Found rows are cached for the TTL (matches query-client staleTime).
// - Misses (null) and errors are NOT cached — tracking flows poll for a repo
//   to appear right after it's created, and a cached miss would break them.
const REPOSITORY_LOOKUP_TTL_MS = 5 * 60 * 1000;

interface RepositoryLookupEntry {
  promise: Promise<RepositoryIdentity | null>;
  timestamp: number;
}

const repositoryLookupCache = new Map<string, RepositoryLookupEntry>();

/**
 * Resolve a repository row by owner/name with request dedup and caching.
 *
 * Returns null when the repository isn't in the database; throws on query
 * errors so callers can distinguish "not tracked" from "lookup failed".
 */
export function getRepositoryByOwnerName(
  owner: string,
  name: string
): Promise<RepositoryIdentity | null> {
  const key = `${owner}/${name}`;
  const cached = repositoryLookupCache.get(key);
  if (cached && Date.now() - cached.timestamp < REPOSITORY_LOOKUP_TTL_MS) {
    return cached.promise;
  }

  const ssrRow = consumeSSRRepository(owner, name);
  if (ssrRow) {
    const seeded = Promise.resolve(ssrRow);
    repositoryLookupCache.set(key, { promise: seeded, timestamp: Date.now() });
    return seeded;
  }

  const promise = (async (): Promise<RepositoryIdentity | null> => {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('repositories')
      .select('id, owner, name, last_updated_at')
      .eq('owner', owner)
      .eq('name', name)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return (data as RepositoryIdentity | null) ?? null;
  })();

  repositoryLookupCache.set(key, { promise, timestamp: Date.now() });
  promise
    .then((result) => {
      if (result === null) {
        repositoryLookupCache.delete(key);
      }
    })
    .catch(() => {
      repositoryLookupCache.delete(key);
    });

  return promise;
}

/** Test-only escape hatch to reset the lookup cache between cases. */
export function clearRepositoryLookupCache(): void {
  repositoryLookupCache.clear();
}

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
    const supabase = await getSupabase();
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
      .maybeSingle();

    if (error) {
      // Check if repository already exists
      if (error.code === '23505') {
        // Unique violation
        const supabase = await getSupabase();
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
  const supabase = await getSupabase();
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
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', name)
    .maybeSingle();

  return { exists: !!data, repositoryId: data?.id, error };
}
