import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface RepositoryValidation {
  isTracked: boolean;
  exists: boolean;
  error?: string;
  trackingUrl?: string;
}

export async function validateRepository(
  owner: string,
  repo: string,
  supabaseClient?: SupabaseClient
): Promise<RepositoryValidation> {
  const isValidRepoName = (name: string): boolean => /^[a-zA-Z0-9._-]+$/.test(name);

  if (!owner || !repo) {
    return { isTracked: false, exists: false, error: 'Missing owner or repo parameter' };
  }

  if (!isValidRepoName(owner) || !isValidRepoName(repo)) {
    return {
      isTracked: false,
      exists: false,
      error:
        'Invalid repository format. Names can only contain letters, numbers, dots, underscores, and hyphens',
    };
  }

  if (owner.length > 39 || repo.length > 100) {
    return {
      isTracked: false,
      exists: false,
      error: 'Repository or organization name is too long',
    };
  }

  try {
    let supabase: SupabaseClient;

    // Use provided client or create new one
    if (supabaseClient) {
      supabase = supabaseClient;
    } else {
      const supabaseUrl = process.env.SUPABASE_URL || '';
      const supabaseKey =
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseKey) {
        return {
          isTracked: false,
          exists: false,
          error: 'Missing Supabase configuration',
        };
      }

      supabase = createClient(supabaseUrl, supabaseKey);
    }

    const { data, error } = await supabase
      .from('tracked_repositories')
      .select('id, tracking_enabled')
      .eq('organization_name', owner.toLowerCase())
      .eq('repository_name', repo.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Error checking repository tracking:', error);
      console.error('Query params - owner:', owner, 'repo:', repo);
      return {
        isTracked: false,
        exists: false,
        error: `Database error while checking repository tracking: ${error.message || 'Unknown error'}`,
      };
    }

    if (!data) {
      const trackingUrl = `https://contributor.info/${owner}/${repo}`;
      return {
        isTracked: false,
        exists: true,
        error: `Repository ${owner}/${repo} is not tracked. Please track it first at ${trackingUrl}`,
        trackingUrl,
      };
    }

    // Check if repository is active
    if (!data.tracking_enabled) {
      const trackingUrl = `https://contributor.info/${owner}/${repo}`;
      return {
        isTracked: false,
        exists: true,
        error: `Repository ${owner}/${repo} tracking is inactive. Please reactivate it at ${trackingUrl}`,
        trackingUrl,
      };
    }

    return { isTracked: true, exists: true };
  } catch (error) {
    console.error('Error in validateRepository:', error);
    return { isTracked: false, exists: false, error: 'Internal error while validating repository' };
  }
}

export function createNotFoundResponse(owner: string, repo: string, trackingUrl?: string) {
  return new Response(
    JSON.stringify({
      error: 'Repository not found',
      message: `Repository ${owner}/${repo} is not being tracked`,
      trackingUrl: trackingUrl || `https://contributor.info/${owner}/${repo}`,
      action: 'Please visit the tracking URL to start tracking this repository',
    }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export function createErrorResponse(error: string, status = 400) {
  return new Response(JSON.stringify({ error, success: false }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // NOTE: Credentials removed for security - cannot use credentials with wildcard origin
  // 'Access-Control-Allow-Credentials': 'true', // SECURITY: Violates CORS spec with wildcard origin
};
