// API endpoint to queue events to Inngest from the browser
import { Inngest } from "inngest";
import type { Context } from "@netlify/functions";

// Environment detection - treat deploy previews as production for signing
const isProduction = () => {
  const context = process.env.CONTEXT;
  const nodeEnv = process.env.NODE_ENV;
  
  // Deploy previews should use production mode for proper signing
  return context === 'production' || 
         context === 'deploy-preview' || 
         nodeEnv === 'production' ||
         process.env.NETLIFY === 'true'; // All Netlify environments use production mode
};

// Get production environment variables
const getProductionEnvVar = (key: string, fallbackKey?: string): string => {
  // For production, use production-specific keys first
  if (isProduction()) {
    return process.env[`INNGEST_PRODUCTION_${key}`] || process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
  }
  // For preview/dev, use existing keys
  return process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
};

// Create Inngest client with server-side keys
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false, // Force production mode for proper request signing
  eventKey: getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
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
    // Log environment info for debugging
    console.log("API Queue Event - Environment:", {
      context: process.env.CONTEXT,
      isProduction: isProduction(),
      hasEventKey: !!getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
      hasSigningKey: !!getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY')
    });

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

    console.log("Sending event to Inngest:", { eventName, dataKeys: Object.keys(data) });

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