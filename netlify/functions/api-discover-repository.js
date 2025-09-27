// DEPRECATED: This endpoint is replaced by api-track-repository
// This stub prevents old code from triggering invalid discovery events

exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Log any attempts to use this deprecated endpoint
  const body = JSON.parse(event.body || '{}');
  console.warn('DEPRECATED: api-discover-repository called with:', body);
  console.warn('This endpoint is deprecated. Use api-track-repository instead.');

  return {
    statusCode: 410, // Gone - indicates the endpoint is deprecated
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      error: 'Deprecated endpoint',
      message: 'This discovery endpoint is deprecated. Please use the tracking feature instead.',
      deprecated: true,
    }),
  };
};
