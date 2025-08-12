import type { Context } from "@netlify/functions";

export default async (req: Request, context: Context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });
  }

  try {
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { owner, repo } = body;

    if (!owner || !repo) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Missing owner or repo',
        message: 'Please provide both owner and repo parameters' 
      }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // Check if user is authenticated
    // In production, this would validate the Supabase session
    // For now, we'll accept all requests but log the authentication status
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
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
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Repository not found',
          message: `Repository ${owner}/${repo} not found on GitHub` 
        }), {
          status: 404,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        });
      }

      if (!githubResponse.ok) {
        throw new Error(`GitHub API error: ${githubResponse.status}`);
      }

      const githubData = await githubResponse.json();

      // Check if it's a private repository
      if (githubData.private) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'Private repository',
          message: 'Cannot track private repositories' 
        }), {
          status: 403,
          headers: { 
            ...corsHeaders,
            'Content-Type': 'application/json' 
          }
        });
      }

    } catch (githubError) {
      // Continue anyway - the repository might exist but we hit rate limits
    }

    // Send Inngest event to trigger discovery and data sync
    try {
      const inngestEventKey = process.env.INNGEST_EVENT_KEY || 
                             process.env.INNGEST_PRODUCTION_EVENT_KEY;
      
      let inngestUrl: string;
      // Check if we're in local development (special key or no key)
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
        throw new Error(`Inngest returned ${inngestResponse.status}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { status: 'sent' };
      }


      return new Response(JSON.stringify({ 
        success: true,
        message: `Tracking started for ${owner}/${repo}`,
        repositoryId: result.ids?.[0] || 'pending',
        eventId: result.ids?.[0] || result.status || 'pending'
      }), {
        status: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });

    } catch (inngestError: unknown) {
      const errorMessage = inngestError instanceof Error ? inngestError.message : String(inngestError);
      
      // Still return success but note the background processing issue
      return new Response(JSON.stringify({ 
        success: true,
        message: `Tracking request received for ${owner}/${repo}`,
        warning: 'Background processing may be delayed'
      }), {
        status: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

  } catch (error) {
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to track repository. Please try again.' 
    }), {
      status: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });
  }
};

export const config = {
  path: "/api/track-repository"
};