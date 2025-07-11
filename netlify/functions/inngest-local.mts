// Local development Inngest function for testing
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Environment detection for local
const isDevelopment = () => {
  return process.env.NODE_ENV !== 'production' || process.env.CONTEXT !== 'production';
};

// Create Inngest client for local development
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || "contributor-info-local",
  isDev: isDevelopment(),
  // Use local keys if available, otherwise fall back to existing keys
  eventKey: process.env.INNGEST_LOCAL_EVENT_KEY || process.env.INNGEST_EVENT_KEY || 'dev-key',
  signingKey: process.env.INNGEST_LOCAL_SIGNING_KEY || process.env.INNGEST_SIGNING_KEY,
});

// Test function to verify connection
const testFunction = inngest.createFunction(
  { id: "local-test-function" },
  { event: "test/local.hello" },
  async ({ event, step }) => {
    console.log("Local test function executed!", event);
    
    await step.run("log-event", async () => {
      console.log("Event data:", JSON.stringify(event.data, null, 2));
      return { logged: true };
    });
    
    return { 
      message: "Hello from Local Inngest!", 
      timestamp: new Date().toISOString(),
      environment: "local",
      data: event.data
    };
  }
);

// Simple PR capture function for testing
const capturePrDetailsLocal = inngest.createFunction(
  { 
    id: "local-capture-pr-details",
    name: "Local Capture PR Details"
  },
  { event: "local/capture.pr.details" },
  async ({ event, step }) => {
    const { repositoryId, prNumber } = event.data;
    
    const result = await step.run("process-pr", async () => {
      console.log(`Processing PR #${prNumber} for repository ${repositoryId}`);
      return {
        repositoryId,
        prNumber,
        processed: true,
        timestamp: new Date().toISOString()
      };
    });
    
    return {
      success: true,
      result
    };
  }
);

// Repository sync function for testing
const syncRepositoryLocal = inngest.createFunction(
  { 
    id: "local-sync-repository",
    name: "Local Sync Repository"
  },
  { event: "local/sync.repository" },
  async ({ event, step }) => {
    const { repositoryId, days } = event.data;
    
    const result = await step.run("sync-data", async () => {
      console.log(`Syncing ${days} days of data for repository ${repositoryId}`);
      return {
        repositoryId,
        days,
        synced: true,
        timestamp: new Date().toISOString()
      };
    });
    
    return {
      success: true,
      result
    };
  }
);

// Create the serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [
    testFunction,
    capturePrDetailsLocal,
    syncRepositoryLocal
  ],
  servePath: "/.netlify/functions/inngest-local",
  landingPage: true // Enable landing page for local development
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  
  // Handle GET requests with a detailed status page
  if (req.method === "GET" && !url.searchParams.has("fnId")) {
    return new Response(JSON.stringify({
      message: "Inngest Local Development endpoint",
      status: "active",
      endpoint: "http://localhost:8888/.netlify/functions/inngest-local",
      isDev: true,
      functions: [
        {
          id: "local-test-function",
          event: "test/local.hello"
        },
        {
          id: "local-capture-pr-details", 
          event: "local/capture.pr.details"
        },
        {
          id: "local-sync-repository",
          event: "local/sync.repository"
        }
      ],
      instructions: {
        inngestDev: "Run: npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local",
        testEvent: 'Send test event: { "name": "test/local.hello", "data": { "message": "Hello!" } }'
      }
    }, null, 2), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  }

  // Pass all other requests to Inngest
  return inngestHandler(req, context);
};

// Also export as handler for compatibility
export const handler = inngestHandler;