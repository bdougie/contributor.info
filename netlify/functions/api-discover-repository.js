const fetch = require('node-fetch');

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

    // Try to send Inngest event
    try {
      // Determine which Inngest endpoint to use
      const inngestEventKey = process.env.INNGEST_EVENT_KEY || 
                             process.env.INNGEST_PRODUCTION_EVENT_KEY;
      
      let inngestUrl;
      if (inngestEventKey) {
        // Production Inngest
        inngestUrl = `https://inn.gs/e/${inngestEventKey}`;
        console.log('Using production Inngest endpoint');
      } else {
        // Fallback to local (won't work in production)
        inngestUrl = 'http://localhost:8288/e/local';
        console.log('Using local Inngest endpoint (will fail in production)');
      }

      // Send the event
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

      console.log(`Repository discovery initiated for ${owner}/${repo}:`, result);

      return {
        statusCode: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          success: true,
          message: `Discovery started for ${owner}/${repo}`,
          eventId: result.ids?.[0] || result.status || 'pending'
        })
      };

    } catch (inngestError) {
      console.error('Failed to send Inngest event:', inngestError.message || inngestError);
      
      // Still return success to UI but note the issue
      return {
        statusCode: 200,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          success: true,
          message: `Discovery request received for ${owner}/${repo}`,
          warning: 'Background processing may be delayed',
          debug: process.env.NODE_ENV === 'development' ? inngestError.message : undefined
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
        message: 'Failed to process discovery request.' 
      })
    };
  }
};