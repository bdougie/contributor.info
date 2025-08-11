exports.handler = async (event, context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
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
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const { owner, repo } = params;

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

    // In a real implementation, this would check the database
    // For now, we'll simulate checking if the repository has data
    // This is a placeholder that always returns false initially
    // The actual implementation would query Supabase

    console.log(`Checking repository status for ${owner}/${repo}`);

    // Simulate checking database
    // In production, this would be:
    // const { data } = await supabase
    //   .from('repositories')
    //   .select('id')
    //   .eq('owner', owner)
    //   .eq('name', repo)
    //   .maybeSingle();

    // For now, return a simulated response
    const hasData = false; // This would be !!data in production

    return {
      statusCode: 200,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        owner,
        repo,
        hasData,
        message: hasData ? 'Repository has data' : 'Repository not yet available'
      })
    };

  } catch (error) {
    console.error('Failed to check repository status:', error);
    
    return {
      statusCode: 500,
      headers: { 
        ...corsHeaders,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: 'Failed to check repository status' 
      })
    };
  }
};