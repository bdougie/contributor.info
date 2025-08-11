const fetch = require('node-fetch');

exports.handler = async (event, context) => {
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
    const body = JSON.parse(event.body || '{}');
    const { owner, repo } = body;

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

    // Check if user is authenticated
    // In production, this would validate the Supabase session
    // For now, we'll accept all requests but log the authentication status
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const isAuthenticated = !!authHeader;
    
    console.log(`Repository tracking requested for ${owner}/${repo} (authenticated: ${isAuthenticated})`);

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
      console.error('GitHub verification failed:', githubError);
      // Continue anyway - the repository might exist but we hit rate limits
    }

    // Send Inngest event to trigger discovery and data sync
    try {
      const inngestEventKey = process.env.INNGEST_EVENT_KEY || 
                             process.env.INNGEST_PRODUCTION_EVENT_KEY;
      
      let inngestUrl;
      if (inngestEventKey) {
        inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
        console.log('Using production Inngest endpoint');
      } else {
        inngestUrl = 'http://localhost:8288/e/local';
        console.log('Using local Inngest endpoint');
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
        console.error(`Inngest returned ${inngestResponse.status}: ${responseText}`);
        throw new Error(`Inngest returned ${inngestResponse.status}`);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        console.log('Inngest response (non-JSON):', responseText);
        result = { status: 'sent' };
      }

      console.log(`Repository tracking initiated for ${owner}/${repo}:`, result);

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

    } catch (inngestError) {
      console.error('Failed to send Inngest event:', inngestError.message || inngestError);
      
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
          warning: 'Background processing may be delayed',
          debug: process.env.NODE_ENV === 'development' ? inngestError.message : undefined
        })
      };
    }

  } catch (error) {
    console.error('Failed to process repository tracking:', error);
    
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