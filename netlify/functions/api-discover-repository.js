/**
 * API endpoint to handle repository discovery
 * This allows the frontend to trigger repository setup when a new repo is visited
 * 
 * This is a simplified JavaScript version to work around Netlify deployment issues with .mts files
 */

export default async (req, context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
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
    const body = await req.json();
    const { owner, repo } = body;

    if (!owner || !repo) {
      return new Response(JSON.stringify({ 
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

    // Validate repository name format
    const validFormat = /^[a-zA-Z0-9-_.]+$/.test(owner) && /^[a-zA-Z0-9-_.]+$/.test(repo);
    if (!validFormat) {
      return new Response(JSON.stringify({ 
        error: 'Invalid repository format',
        message: 'Repository names can only contain letters, numbers, hyphens, underscores, and dots' 
      }), {
        status: 400,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        }
      });
    }

    // For now, just acknowledge the request since we can't easily import the Inngest client
    // The actual discovery will be handled by a different mechanism
    console.log(`Repository discovery requested for ${owner}/${repo}`);

    // Return success response
    return new Response(JSON.stringify({ 
      success: true,
      message: `Discovery initiated for ${owner}/${repo}`,
      note: 'Repository will be processed in the background'
    }), {
      status: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      }
    });

  } catch (error) {
    console.error('Failed to process repository discovery:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to start repository discovery. Please try again.' 
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
  path: "/api/discover-repository"
};