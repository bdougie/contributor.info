const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

exports.handler = async (event, context) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Missing owner or repo',
          message: 'Please provide both owner and repo parameters',
        }),
      };
    }

    console.log('Checking repository status for %s/%s', owner, repo);

    // Check if we have Supabase credentials
    if (!supabaseAnonKey) {
      console.warn('Supabase credentials not configured, returning simulated response');
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          hasData: false,
          message: 'Repository not yet available',
        }),
      };
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Check if repository exists in database
    const { data, error } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .maybeSingle();

    if (error) {
      console.error('Database query error:', error);
      // Don't expose database errors to client
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          owner,
          repo,
          hasData: false,
          message: 'Repository not yet available',
        }),
      };
    }

    const hasData = !!data;

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        owner,
        repo,
        hasData,
        message: hasData ? 'Repository has data' : 'Repository not yet available',
      }),
    };
  } catch (error) {
    console.error('Failed to check repository status:', error);

    return {
      statusCode: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to check repository status',
      }),
    };
  }
};
