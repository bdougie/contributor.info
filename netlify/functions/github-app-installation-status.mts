import type { Context } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Use SUPABASE_URL (server-side) first, fall back to VITE_ prefix for local dev
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
// Installation tables are RLS-restricted to authenticated users, so this
// server-side check needs the service role key (anon fallback for local dev)
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

interface InstallationStatus {
  installed: boolean;
  installationId?: number;
  installedAt?: string;
}

/**
 * Check whether the contributor.info GitHub App is installed on a repository.
 *
 * A repo is considered covered when either:
 * 1. It is linked in app_enabled_repositories to a live installation, or
 * 2. Its owner has a live installation with repository_selection = 'all'
 *    (repos created after install never fire installation_repositories events)
 */
async function getInstallationStatus(owner: string, repo: string): Promise<InstallationStatus> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: repoData } = await supabase
    .from('repositories')
    .select('id')
    .eq('owner', owner)
    .eq('name', repo)
    .maybeSingle();

  if (repoData) {
    const { data: enabledRepo } = await supabase
      .from('app_enabled_repositories')
      .select(
        'enabled_at, github_app_installations!inner(installation_id, deleted_at, suspended_at)'
      )
      .eq('repository_id', repoData.id)
      .is('github_app_installations.deleted_at', null)
      .is('github_app_installations.suspended_at', null)
      .maybeSingle();

    const installation = Array.isArray(enabledRepo?.github_app_installations)
      ? enabledRepo?.github_app_installations[0]
      : enabledRepo?.github_app_installations;

    if (installation) {
      return {
        installed: true,
        installationId: installation.installation_id,
        installedAt: enabledRepo?.enabled_at ?? undefined,
      };
    }
  }

  // Owner-wide installation covering all repositories
  const { data: ownerInstall } = await supabase
    .from('github_app_installations')
    .select('installation_id, installed_at')
    .eq('account_name', owner)
    .eq('repository_selection', 'all')
    .is('deleted_at', null)
    .is('suspended_at', null)
    .maybeSingle();

  if (ownerInstall) {
    return {
      installed: true,
      installationId: ownerInstall.installation_id,
      installedAt: ownerInstall.installed_at ?? undefined,
    };
  }

  return { installed: false };
}

export default async (req: Request, _context: Context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // Note: Removed Allow-Credentials as it's incompatible with wildcard origin
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  const url = new URL(req.url);
  const owner = url.searchParams.get('owner');
  const repo = url.searchParams.get('repo');

  if (!owner || !repo) {
    return new Response(JSON.stringify({ error: 'Missing owner or repo parameter' }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const status = await getInstallationStatus(owner, repo);

    return new Response(JSON.stringify(status), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error('Failed to check installation status:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        installed: false,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // No caching for error responses
        },
      }
    );
  }
};
