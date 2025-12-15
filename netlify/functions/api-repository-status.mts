import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import type { RepositoryStatusResponse } from '../../src/types/repository-api';

// Constants
const RECENTLY_CREATED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Repository Status API Endpoint
 *
 * Returns the current status of a repository's tracking pipeline:
 * - Whether the repository exists in the database
 * - Whether it has actual data (commits, PRs)
 * - Current pipeline status
 *
 * Used for polling during the tracking flow to detect when data becomes available.
 */

// CORS headers - Note: wildcard origin cannot be used with credentials
// This endpoint returns public repository status data, no credentials needed
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default async (req: Request, _context: Context) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({
        success: false,
        hasData: false,
        status: 'error',
        error: 'Method not allowed',
      } satisfies RepositoryStatusResponse),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Parse query parameters
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');

  // Validate parameters
  if (!owner || !repo) {
    return new Response(
      JSON.stringify({
        success: false,
        hasData: false,
        status: 'error',
        error: 'Missing owner or repo query parameters',
      } satisfies RepositoryStatusResponse),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate format
  const isValidName = (name: string): boolean => /^[a-zA-Z0-9._-]+$/.test(name);
  if (!isValidName(owner) || !isValidName(repo)) {
    return new Response(
      JSON.stringify({
        success: false,
        hasData: false,
        status: 'error',
        error: 'Invalid repository format',
      } satisfies RepositoryStatusResponse),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({
          success: false,
          hasData: false,
          status: 'error',
          error: 'Service temporarily unavailable',
        } satisfies RepositoryStatusResponse),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Check if repository exists
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, owner, name, created_at, last_updated_at, is_active')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (repoError) {
      console.error('Database error checking repository:', repoError);
      return new Response(
        JSON.stringify({
          success: false,
          hasData: false,
          status: 'error',
          error: 'Unable to check repository status',
        } satisfies RepositoryStatusResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Repository not found
    if (!repoData) {
      return new Response(
        JSON.stringify({
          success: true,
          hasData: false,
          status: 'not_found',
          message: 'Repository is not being tracked',
        } satisfies RepositoryStatusResponse),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Step 2: Check data availability - commits, PRs, and contributors
    const [commitsResult, prsResult, contributorsResult] = await Promise.all([
      supabase
        .from('commits')
        .select('id', { count: 'exact', head: true })
        .eq('repository_id', repoData.id)
        .limit(1),
      supabase
        .from('pull_requests')
        .select('id', { count: 'exact', head: true })
        .eq('repository_id', repoData.id)
        .limit(1),
      supabase
        .from('contributors')
        .select('id', { count: 'exact', head: true })
        .eq('repository_id', repoData.id)
        .limit(1),
    ]);

    // Check for errors in count queries
    if (commitsResult.error || prsResult.error || contributorsResult.error) {
      console.error('Error checking data counts:', {
        commits: commitsResult.error,
        prs: prsResult.error,
        contributors: contributorsResult.error,
      });
      return new Response(
        JSON.stringify({
          success: false,
          hasData: false,
          status: 'error',
          error: 'Unable to check repository data',
        } satisfies RepositoryStatusResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const commitCount = commitsResult.count ?? 0;
    const prCount = prsResult.count ?? 0;
    const contributorCount = contributorsResult.count ?? 0;

    const hasCommits = commitCount > 0;
    const hasPullRequests = prCount > 0;
    const hasContributors = contributorCount > 0;

    // Determine status based on data availability
    const hasData = hasCommits || hasPullRequests || hasContributors;

    let status: RepositoryStatusResponse['status'];
    let message: string;

    if (hasData) {
      status = 'ready';
      message = 'Repository data is available';
    } else {
      // Check if repository was recently created (within threshold)
      const createdAt = new Date(repoData.created_at);
      const recentThreshold = new Date(Date.now() - RECENTLY_CREATED_THRESHOLD_MS);

      if (createdAt > recentThreshold) {
        status = 'syncing';
        message = 'Repository is being synced. Data will be available shortly.';
      } else {
        status = 'pending';
        message = 'Repository is tracked but data sync may be delayed. Try refreshing later.';
      }
    }

    const response: RepositoryStatusResponse = {
      success: true,
      hasData,
      status,
      repository: {
        id: repoData.id,
        owner: repoData.owner,
        name: repoData.name,
        createdAt: repoData.created_at,
        lastUpdatedAt: repoData.last_updated_at,
      },
      dataAvailability: {
        hasCommits,
        hasPullRequests,
        hasContributors,
        commitCount,
        prCount,
        contributorCount,
      },
      message,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unexpected error in repository-status:', error);

    return new Response(
      JSON.stringify({
        success: false,
        hasData: false,
        status: 'error',
        error: 'Internal server error',
      } satisfies RepositoryStatusResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
};
