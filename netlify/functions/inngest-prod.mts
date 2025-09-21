// Production Inngest function for contributor.info
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import function creators for production client
import { createCaptureRepositorySyncGraphQL, createClassifySingleRepository } from "./inngest-prod-functions.mjs";

// Import all capture functions from the main library
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureIssueComments,
  captureRepositoryIssues,
  captureRepositorySync,
  capturePrDetailsGraphQL,
  classifyRepositorySize,
  discoverNewRepository
} from "../../src/lib/inngest/functions/index-without-embeddings";

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

// Ensure GITHUB_TOKEN is available for the GraphQL client
if (!process.env.GITHUB_TOKEN && process.env.VITE_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
}

// Create Inngest client for production
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false, // Force production mode for proper request signing
  eventKey: getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

// Log configuration for debugging
console.log('Inngest Production Configuration:', {
  appId: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  hasEventKey: !!getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  hasSigningKey: !!getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
  hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY || !!process.env.VITE_SUPABASE_ANON_KEY,
  hasGithubToken: !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN,
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

// Create production functions using our configured client
const captureRepositorySyncGraphQL = createCaptureRepositorySyncGraphQL(inngest);
const classifySingleRepository = createClassifySingleRepository(inngest);

// Create the serve handler with signature verification
const inngestHandler = serve({
  client: inngest,
  functions: [
    testFunction,
    // GraphQL functions (preferred)
    captureRepositorySyncGraphQL,
    capturePrDetailsGraphQL,
    // REST functions
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureIssueComments,
    captureRepositoryIssues,
    captureRepositorySync,
    // Classification functions
    classifySingleRepository,
    classifyRepositorySize,
    // Discovery function
    discoverNewRepository
  ],
  servePath: "/.netlify/functions/inngest-prod",
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'), // Ensure signature verification
});

// Create the main handler function
const mainHandler = async (req: Request, context: Context) => {
  try {
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
          { id: "prod-test-function", event: "test/prod.hello" },
          { id: "capture-repository-sync-graphql", event: "capture/repository.sync.graphql" },
          { id: "capture-pr-details-graphql", event: "capture/pr.details.graphql" },
          { id: "capture-pr-details", event: "capture/pr.details" },
          { id: "capture-pr-reviews", event: "capture/pr.reviews" },
          { id: "capture-pr-comments", event: "capture/pr.comments" },
          { id: "capture-issue-comments", event: "capture/issue.comments" },
          { id: "capture-repository-issues", event: "capture/repository.issues" },
          { id: "capture-repository-sync", event: "capture/repository.sync" },
          { id: "classify-single-repository", event: "classify/repository.single" },
          { id: "classify-repository-size", event: "classify/repository.size" },
          { id: "discover-new-repository", event: "discover/repository.new" }
        ],
        usage: {
          testEvent: 'Send: { "name": "test/prod.hello", "data": { "message": "Hello!" } }',
          syncEvent: 'Send: { "name": "capture/repository.sync.graphql", "data": { "repositoryId": "123", "days": 30 } }',
          classifyEvent: 'Send: { "name": "classify/repository.single", "data": { "repositoryId": "123", "owner": "owner", "repo": "repo" } }'
        }
      }, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      });
    }

    // Pass all other requests to Inngest handler (which handles its own signature verification)
    return inngestHandler(req, context);
  } catch (error) {
    console.error('Error in inngest-prod handler:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
};

// Export default as the wrapper and handler as the raw inngest handler
export default mainHandler;
export const handler = inngestHandler;