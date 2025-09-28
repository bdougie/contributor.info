import { createSupabaseClient } from '../../../src/lib/supabase.js';

interface RepositoryValidation {
  isTracked: boolean;
  exists: boolean;
  error?: string;
  trackingUrl?: string;
}

export async function validateRepository(
  owner: string,
  repo: string
): Promise<RepositoryValidation> {
  // Validate repository name format
  const isValidRepoName = (name: string): boolean => /^[a-zA-Z0-9._-]+$/.test(name);

  if (!owner || !repo) {
    return {
      isTracked: false,
      exists: false,
      error: 'Missing owner or repo parameter',
    };
  }

  if (!isValidRepoName(owner) || !isValidRepoName(repo)) {
    return {
      isTracked: false,
      exists: false,
      error: 'Invalid repository format. Names can only contain letters, numbers, dots, underscores, and hyphens',
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
    // Check if repository is tracked in database
    const supabase = createSupabaseClient();

    const { data, error } = await supabase
      .from('tracked_repositories')
      .select('id, is_active')
      .eq('owner', owner.toLowerCase())
      .eq('name', repo.toLowerCase())
      .maybeSingle();

    if (error) {
      console.error('Error checking repository tracking:', error);
      return {
        isTracked: false,
        exists: false,
        error: 'Database error while checking repository tracking',
      };
    }

    if (!data) {
      // Repository not tracked - provide UI tracking URL
      const trackingUrl = `https://contributor.info/${owner}/${repo}`;
      return {
        isTracked: false,
        exists: true,
        error: `Repository ${owner}/${repo} is not tracked. Please track it first at ${trackingUrl}`,
        trackingUrl,
      };
    }

    // Check if tracking is active
    if (!data.is_active) {
      const trackingUrl = `https://contributor.info/${owner}/${repo}`;
      return {
        isTracked: false,
        exists: true,
        error: `Repository ${owner}/${repo} tracking is inactive. Please reactivate it at ${trackingUrl}`,
        trackingUrl,
      };
    }

    return {
      isTracked: true,
      exists: true,
    };
  } catch (error) {
    console.error('Error in validateRepository:', error);
    return {
      isTracked: false,
      exists: false,
      error: 'Internal error while validating repository',
    };
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
  return new Response(
    JSON.stringify({
      error,
      success: false,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  );
}

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Credentials': 'true',
};
