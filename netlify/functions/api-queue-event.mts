// API endpoint to queue events to Inngest from the browser
import { Inngest } from "inngest";
import type { Context } from "@netlify/functions";

// Environment detection
const isDevelopment = () => {
  const nodeEnv = process.env.NODE_ENV;
  const netlifyContext = process.env.CONTEXT;
  
  if (netlifyContext === 'production' || nodeEnv === 'production') {
    return false;
  }
  
  return nodeEnv !== 'production';
};

// Create Inngest client with server-side keys
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: isDevelopment(),
  eventKey: process.env.INNGEST_EVENT_KEY || 'dev-key',
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

export default async (req: Request, context: Context) => {
  // Only allow POST requests
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    // Parse the request body
    const body = await req.json();
    const { eventName, data } = body;

    if (!eventName || !data) {
      return new Response(JSON.stringify({ 
        error: "Missing required fields: eventName and data" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Send the event to Inngest server-side
    const result = await inngest.send({
      name: eventName,
      data: data
    });

    return new Response(JSON.stringify({
      success: true,
      message: "Event queued successfully",
      eventId: result.ids?.[0]
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Failed to queue event:", error);
    
    return new Response(JSON.stringify({
      error: "Failed to queue event",
      message: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = {
  path: "/api/queue-event"
};