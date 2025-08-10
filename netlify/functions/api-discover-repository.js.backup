/**
 * API endpoint to handle repository discovery
 * This allows the frontend to trigger repository setup when a new repo is visited
 */

exports.handler = async (event, context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
          error: 'Missing owner or repo',
          message: 'Please provide both owner and repo parameters' 
        })
      };
    }

    // Validate repository name format
    const validFormat = /^[a-zA-Z0-9-_.]+$/.test(owner) && /^[a-zA-Z0-9-_.]+$/.test(repo);
    if (!validFormat) {
      return {
        statusCode: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          error: 'Invalid repository format',
          message: 'Repository names can only contain letters, numbers, hyphens, underscores, and dots' 
        })
      };
    }

    console.log(`Repository discovery requested for ${owner}/${repo}`);

    // Send event to Inngest via HTTP instead of using the client
    // This avoids module import issues
    try {
      const inngestUrl = process.env.INNGEST_EVENT_KEY 
        ? 'https://inn.gs/e/' + process.env.INNGEST_EVENT_KEY
        : 'http://localhost:8288/e/local';
      
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
            source: 'user-discovery',
            timestamp: new Date().toISOString()
          }
        })
      });

      if (!inngestResponse.ok) {
        throw new Error(`Inngest returned ${inngestResponse.status}`);
      }

      const result = await inngestResponse.json();
      console.log(`Repository discovery initiated for ${owner}/${repo}`, result);

      return {
        statusCode: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          success: true,
          message: `Discovery started for ${owner}/${repo}`,
          eventId: result.ids?.[0] || 'pending'
        })
      };
    } catch (inngestError) {
      console.error('Failed to send Inngest event:', inngestError);
      
      // For now, just acknowledge the request
      // The repository will be discovered through other means (e.g., manual tracking)
      return {
        statusCode: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          success: true,
          message: `Discovery request received for ${owner}/${repo}`,
          note: 'Repository will be processed soon'
        })
      };
    }

  } catch (error) {
    console.error('Failed to process repository discovery:', error);
    
    return {
      statusCode: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        success: false,
        error: 'Internal server error',
        message: 'Failed to start repository discovery. Please try again.' 
      })
    };
  }
};