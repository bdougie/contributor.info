// Production Inngest function for contributor.info
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
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

// Create Inngest client for production
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false, // Force production mode for proper request signing
  eventKey: getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

// Test function to verify connection
const testFunction = inngest.createFunction(
  { id: "prod-test-function" },
  { event: "test/prod.hello" },
  async ({ event, step }) => {
    console.log("Production test function executed!", event);
    
    await step.run("log-environment", async () => {
      console.log("Environment:", {
        context: process.env.CONTEXT,
        nodeEnv: process.env.NODE_ENV,
        isProduction: isProduction(),
        hasEventKey: !!getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
        hasSigningKey: !!getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY')
      });
      return { logged: true };
    });
    
    return { 
      message: "Hello from Production Inngest!", 
      timestamp: new Date().toISOString(),
      environment: isProduction() ? "production" : "preview",
      data: event.data
    };
  }
);

// Simple PR capture function
const capturePrDetailsProd = inngest.createFunction(
  { 
    id: "prod-capture-pr-details",
    name: "Production Capture PR Details",
    concurrency: { limit: 5 },
    retries: 3,
  },
  { event: "capture/pr.details" },
  async ({ event, step }) => {
    const { repositoryId, prNumber } = event.data;
    
    const result = await step.run("process-pr", async () => {
      console.log(`[PROD] Processing PR #${prNumber} for repository ${repositoryId}`);
      return {
        repositoryId,
        prNumber,
        processed: true,
        timestamp: new Date().toISOString(),
        environment: isProduction() ? "production" : "preview"
      };
    });
    
    return {
      success: true,
      result
    };
  }
);

// Repository sync function
const syncRepositoryProd = inngest.createFunction(
  { 
    id: "prod-sync-repository",
    name: "Production Sync Repository",
    concurrency: { limit: 3 },
    retries: 3,
  },
  { event: "capture/repository.sync" },
  async ({ event, step }) => {
    const { repositoryId, days } = event.data;
    
    const result = await step.run("sync-data", async () => {
      console.log(`[PROD] Syncing ${days} days of data for repository ${repositoryId}`);
      return {
        repositoryId,
        days,
        synced: true,
        timestamp: new Date().toISOString(),
        environment: isProduction() ? "production" : "preview"
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
    capturePrDetailsProd,
    syncRepositoryProd
  ],
  servePath: "/.netlify/functions/inngest-prod"
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  
  // Handle GET requests with a detailed status page
  if (req.method === "GET" && !url.searchParams.has("fnId")) {
    return new Response(JSON.stringify({
      message: "Inngest Production endpoint",
      status: "active",
      endpoint: "/.netlify/functions/inngest-prod",
      environment: {
        context: process.env.CONTEXT || "unknown",
        nodeEnv: process.env.NODE_ENV || "unknown",
        isProduction: isProduction(),
        hasEventKey: !!getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
        hasSigningKey: !!getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
      },
      functions: [
        {
          id: "prod-test-function",
          event: "test/prod.hello"
        },
        {
          id: "prod-capture-pr-details", 
          event: "capture/pr.details"
        },
        {
          id: "prod-sync-repository",
          event: "capture/repository.sync"
        }
      ],
      usage: {
        testEvent: 'Send: { "name": "test/prod.hello", "data": { "message": "Hello!" } }',
        prEvent: 'Send: { "name": "capture/pr.details", "data": { "repositoryId": "123", "prNumber": "456" } }'
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