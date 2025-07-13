import type { Handler } from "@netlify/functions";
import { inngest } from "../../src/lib/inngest/client";

/**
 * API endpoint to queue Inngest events from the browser
 * This is necessary because browser code cannot directly send to Inngest
 */
export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method not allowed'
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { eventName, data } = body;

    if (!eventName || !data) {
      return {
        statusCode: 400,
        body: 'Missing eventName or data'
      };
    }

    // Send event to Inngest
    const result = await inngest.send({
      name: eventName,
      data
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: true, 
        id: result.ids?.[0] || 'unknown' 
      })
    };

  } catch (error) {
    console.error('Failed to queue event:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
    };
  }
};