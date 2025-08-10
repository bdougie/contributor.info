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

    console.log(`Repository discovery requested for ${owner}/${repo}`);

    // For now, just return success
    // The actual discovery will happen through manual tracking or other means
    return {
      statusCode: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        success: true,
        message: `Discovery request acknowledged for ${owner}/${repo}`,
        note: 'Repository will be tracked. Please refresh in a moment.'
      })
    };

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
        message: 'Failed to process discovery request.' 
      })
    };
  }
};