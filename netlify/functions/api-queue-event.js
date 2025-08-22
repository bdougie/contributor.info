// API endpoint to queue events to Inngest from the browser
// JavaScript version to ensure production deployment compatibility

const { Inngest } = require("inngest");

// Get environment variables
const getEnvVar = (key, fallbackKey) => {
  return process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
};

// Create Inngest client
const eventKey = getEnvVar('INNGEST_EVENT_KEY', 'INNGEST_PRODUCTION_EVENT_KEY');
const isLocalDev = !eventKey || eventKey === 'local_development_only';

const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: isLocalDev,
  eventKey: isLocalDev ? 'local-dev-key' : eventKey,
  signingKey: isLocalDev ? undefined : getEnvVar('INNGEST_SIGNING_KEY', 'INNGEST_PRODUCTION_SIGNING_KEY'),
  baseUrl: isLocalDev ? 'http://localhost:8288' : undefined,
});

exports.handler = async (event, context) => {
  // CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
      },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const { eventName, data } = body;

    if (!eventName || !data) {
      return {
        statusCode: 400,
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        },
        body: JSON.stringify({ 
          error: "Missing required fields: eventName and data" 
        })
      };
    }

    // Log in development
    if (isLocalDev) {
      console.log('[api-queue-event] Sending event:', eventName);
      console.log('[api-queue-event] Event data:', JSON.stringify(data, null, 2));
    }

    // Send the event to Inngest
    const result = await inngest.send({
      name: eventName,
      data: data
    });

    if (isLocalDev) {
      console.log('[api-queue-event] Event sent successfully:', result);
    }

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
      },
      body: JSON.stringify({
        success: true,
        message: "Event queued successfully",
        eventId: result.ids?.[0],
        eventIds: result.ids
      })
    };

  } catch (error) {
    console.error('[api-queue-event] Error:', error);
    return {
      statusCode: 500,
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders
      },
      body: JSON.stringify({
        error: "Failed to queue event",
        message: error.message || "Unknown error"
      })
    };
  }
};