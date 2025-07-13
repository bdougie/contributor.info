import type { Context } from "@netlify/functions";
import { inngest } from "../../src/lib/inngest/client";

/**
 * API endpoint to queue Inngest events from the browser
 * This is necessary because browser code cannot directly send to Inngest
 */
const queueEventHandler = async (req: Request, _context: Context) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await req.json();
    const { eventName, data } = body;

    if (!eventName || !data) {
      return new Response('Missing eventName or data', { status: 400 });
    }

    // Send event to Inngest
    const result = await inngest.send({
      name: eventName,
      data
    });

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.ids?.[0] || 'unknown' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Failed to queue event:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export default queueEventHandler;
export const handler = queueEventHandler;