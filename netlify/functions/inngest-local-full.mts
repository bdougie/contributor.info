// Local development Inngest function with all capture functions
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import all capture functions (excluding embeddings to avoid transformers issue)
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureRepositorySync,
  capturePrDetailsGraphQL,
  captureRepositorySyncGraphQL,
  classifyRepositorySize,
  classifySingleRepository,
  updatePrActivity,
  discoverNewRepository
} from "../../src/lib/inngest/functions/index-without-embeddings";

// Ensure GITHUB_TOKEN is available
if (!process.env.GITHUB_TOKEN && process.env.VITE_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
}

// Create Inngest client for local development
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || "contributor-info",
  isDev: true, // Always dev mode for local
  eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key',
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

// Log configuration
console.log('Inngest Local Configuration:', {
  appId: process.env.VITE_INNGEST_APP_ID || "contributor-info",
  hasEventKey: !!process.env.INNGEST_EVENT_KEY,
  hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
  hasGithubToken: !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN,
  hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
});

// Test function to verify connection
const testFunction = inngest.createFunction(
  { id: "local-test-function" },
  { event: "test/local.hello" },
  async ({ event, step }) => {
    console.log("Local test function executed!", event);
    
    await step.run("log-environment", async () => {
      console.log("Environment:", {
        nodeEnv: process.env.NODE_ENV,
        hasEventKey: !!process.env.INNGEST_EVENT_KEY,
        hasSigningKey: !!process.env.INNGEST_SIGNING_KEY
      });
      return { logged: true };
    });
    
    return { 
      message: "Hello from Local Inngest with all functions!", 
      timestamp: new Date().toISOString(),
      environment: "local",
      data: event.data
    };
  }
);

// Create the serve handler with ALL functions
const inngestHandler = serve({
  client: inngest,
  functions: [
    testFunction,
    // REST API functions
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureRepositorySync,
    // GraphQL functions (preferred)
    capturePrDetailsGraphQL,
    captureRepositorySyncGraphQL,
    // Classification functions
    classifyRepositorySize,
    classifySingleRepository,
    // PR activity updates
    updatePrActivity,
    // Repository discovery
    discoverNewRepository
  ],
  servePath: "/.netlify/functions/inngest-local-full",
  landingPage: true
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  
  // Handle GET requests with a detailed status page
  if (req.method === "GET" && !url.searchParams.has("fnId")) {
    return new Response(JSON.stringify({
      message: "Inngest Local Development endpoint (Full)",
      status: "active",
      endpoint: "http://localhost:8888/.netlify/functions/inngest-local-full",
      isDev: true,
      functionCount: 11,
      functions: [
        { id: "local-test-function", event: "test/local.hello" },
        { id: "capture-pr-details", event: "capture/pr.details" },
        { id: "capture-pr-reviews", event: "capture/pr.reviews" },
        { id: "capture-pr-comments", event: "capture/pr.comments" },
        { id: "capture-repository-sync", event: "capture/repository.sync" },
        { id: "capture-pr-details-graphql", event: "capture/pr.details.graphql" },
        { id: "capture-repository-sync-graphql", event: "capture/repository.sync.graphql" },
        { id: "classify-repository-size", event: "classify/repository.size" },
        { id: "classify-single-repository", event: "classify/repository.single" },
        { id: "update-pr-activity", event: "update/pr.activity" },
        { id: "discover-new-repository", event: "discover/repository.new" }
      ],
      instructions: {
        inngestDev: "Run: npx inngest-cli@latest dev -u http://localhost:8888/.netlify/functions/inngest-local-full",
        testEvents: [
          'Test: { "name": "test/local.hello", "data": { "message": "Hello!" } }',
          'Sync: { "name": "capture/repository.sync.graphql", "data": { "repositoryId": "xxx", "days": 7 } }'
        ]
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