import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      // Handle malformed JSON
      body = {};
    }
    const { owner, repo } = body;

    // Validate repository parameters
    const isValidRepoName = (name: string) => /^[a-zA-Z0-9._-]+$/.test(name);

    if (!owner || !repo) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Missing owner or repo',
          message: 'Please provide both owner and repo parameters'
        })
      };
    }

    // Validate format to prevent injection attacks
    if (!isValidRepoName(owner) || !isValidRepoName(repo)) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid repository format',
          message: 'Repository names can only contain letters, numbers, dots, underscores, and hyphens'
        })
      };
    }

    // Validate length constraints
    if (owner.length > 39 || repo.length > 100) {
      return {
        statusCode: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          error: 'Invalid repository name length',
          message: 'Repository or organization name is too long'
        })
      };
    }

    // Check if user is authenticated
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const isAuthenticated = !!authHeader;

    // First, verify the repository exists on GitHub
    try {
      const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'contributor-info',
          ...(process.env.GITHUB_TOKEN && {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`
          })
        }
      });

      if (githubResponse.status === 404) {
        return {
          statusCode: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Repository not found',
            message: `Repository ${owner}/${repo} not found on GitHub`
          })
        };
      }

      if (!githubResponse.ok) {
        throw new Error(`GitHub API error: ${githubResponse.status}`);
      }

      const githubData = await githubResponse.json();

      // Check if it's a private repository
      if (githubData.private) {
        return {
          statusCode: 403,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            success: false,
            error: 'Private repository',
            message: 'Cannot track private repositories'
          })
        };
      }

    } catch (githubError) {
      // Continue anyway - the repository might exist but we hit rate limits
      console.log('GitHub check error:', (githubError as Error).message);
    }

    // Send Inngest event to trigger discovery and data sync
    try {
      const inngestEventKey = process.env.INNGEST_EVENT_KEY ||
                             process.env.INNGEST_PRODUCTION_EVENT_KEY;

      let inngestUrl: string;
      // Check if we're in local development
      if (!inngestEventKey || inngestEventKey === 'local_development_only') {
        inngestUrl = 'http://localhost:8288/e/local';
      } else {
        inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
      }

      // Send the discovery event
      const inngestResponse = await fetch(inngestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'discover/repository.new',
          data: {
            owner,
            repo,
            source: 'user-tracking',
            userId: isAuthenticated ? 'authenticated-user' : null,
            timestamp: new Date().toISOString()
          }
        })
      });

      const responseText = await inngestResponse.text();

      if (!inngestResponse.ok) {
        console.error('Inngest error:', inngestResponse.status, responseText);
        throw new Error(`Inngest returned ${inngestResponse.status}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { status: 'sent' };
      }

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: `Tracking started for ${owner}/${repo}`,
          repositoryId: result.ids?.[0] || 'pending',
          eventId: result.ids?.[0] || result.status || 'pending'
        })
      };

    } catch (inngestError: unknown) {
      // Log error for debugging but don't expose to client
      if (process.env.NODE_ENV === 'development') {
        console.error('Inngest error:', inngestError);
      }

      // Still return success but note the background processing issue
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: true,
          message: `Tracking request received for ${owner}/${repo}`,
          warning: 'Background processing may be delayed'
        })
      };
    }

  } catch (error) {
    console.error('Function error:', error);

    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        message: 'Failed to track repository. Please try again.'
      })
    };
  }
};