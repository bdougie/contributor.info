import { inngest } from '../../src/lib/inngest/client';

/**
 * Blocked owner names that are app routes, not GitHub organizations
 * These should never be treated as repository identifiers
 */
const BLOCKED_OWNERS = new Set([
  'social-cards',
  'api',
  'dev',
  'admin',
  'docs',
  'feed',
  'workspace',
  'workspaces',
  'settings',
  'auth',
  'callback',
  'trending',
  'changelog',
  'terms',
  'privacy',
  'faq',
  'debug',
  'health',
  'status',
  'assets',
  'public',
  'static',
]);

/**
 * API endpoint to handle repository discovery
 * This allows the frontend to trigger repository setup when a new repo is visited
 */
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  try {
    const body = await req.json();
    const { owner, repo } = body;
    if (!owner || !repo || typeof owner !== 'string' || typeof repo !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Missing owner or repo',
          message: 'Please provide both owner and repo parameters as strings',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Block app routes that aren't GitHub repositories
    if (BLOCKED_OWNERS.has(owner.toLowerCase())) {
      console.warn(`Blocked discovery attempt for app route: ${owner}/${repo}`);
      return new Response(
        JSON.stringify({
          error: 'Invalid repository',
          message: `'${owner}' is a reserved path and cannot be tracked as a repository`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate repository name format
    const validFormat = /^[a-zA-Z0-9-_.]+$/.test(owner) && /^[a-zA-Z0-9-_.]+$/.test(repo);
    if (!validFormat) {
      return new Response(
        JSON.stringify({
          error: 'Invalid repository format',
          message:
            'Repository names can only contain letters, numbers, hyphens, underscores, and dots',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    // Send discovery event to Inngest
    const result = await inngest.send({
      name: 'discover/repository.new',
      data: {
        owner,
        repo,
        source: 'user-discovery',
        timestamp: new Date().toISOString(),
      },
    });
    console.log(`Repository discovery initiated for ${owner}/${repo}`, result);
    return new Response(
      JSON.stringify({
        success: true,
        message: `Discovery started for ${owner}/${repo}`,
        eventId: result.ids?.[0] || 'unknown',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Failed to initiate repository discovery:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: 'Failed to start repository discovery. Please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
