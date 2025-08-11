// Unified Inngest handler for both development and production
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import all capture functions from the main library
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureRepositorySync,
  capturePrDetailsGraphQL,
  captureRepositorySyncGraphQL,
  classifyRepositorySize,
  classifySingleRepository,
} from "../../src/lib/inngest/functions/index-without-embeddings";

// Environment detection
const getEnvironment = () => {
  const context = process.env.CONTEXT;
  const nodeEnv = process.env.NODE_ENV;
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  
  // Check if we're in production
  const isProduction = context === 'production' || 
                      context === 'deploy-preview' || 
                      nodeEnv === 'production' ||
                      process.env.NETLIFY === 'true' ||
                      functionName?.includes('prod');
  
  return {
    isProduction,
    isDevelopment: !isProduction,
    context: context || 'unknown',
    nodeEnv: nodeEnv || 'unknown',
  };
};

// Get environment variables with fallbacks
const getEnvVar = (key: string, fallbackKey?: string): string => {
  const env = getEnvironment();
  
  // In production, check for production-specific keys first
  if (env.isProduction) {
    const prodKey = `INNGEST_PRODUCTION_${key}`;
    if (process.env[prodKey]) {
      return process.env[prodKey];
    }
  }
  
  // Check primary key
  if (process.env[key]) {
    return process.env[key];
  }
  
  // Check fallback key
  if (fallbackKey && process.env[fallbackKey]) {
    return process.env[fallbackKey];
  }
  
  return '';
};

// Ensure GITHUB_TOKEN is available
if (!process.env.GITHUB_TOKEN && process.env.VITE_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
}

// Create Inngest client
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: getEnvironment().isDevelopment,
  eventKey: getEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

// Log configuration (only in production for debugging)
if (getEnvironment().isProduction) {
  console.log('Inngest Configuration:', {
    appId: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
    environment: getEnvironment(),
    hasEventKey: !!getEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
    hasSigningKey: !!getEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
    hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY || !!process.env.VITE_SUPABASE_ANON_KEY,
    hasGithubToken: !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN,
  });
}

// Test function to verify connection
const testFunction = inngest.createFunction(
  { id: "test-function" },
  { event: "test/hello" },
  async ({ event, step }) => {
    const env = getEnvironment();
    
    console.log("Test function executed!", event);
    
    await step.run("log-environment", async () => {
      console.log("Environment:", env);
      return { logged: true };
    });
    
    return { 
      message: `Hello from ${env.isProduction ? 'Production' : 'Development'} Inngest!`, 
      timestamp: new Date().toISOString(),
      environment: env,
      data: event.data
    };
  }
);

// Create the serve handler with all functions
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
    captureRepositorySync,
    // Classification functions
    classifySingleRepository,
    classifyRepositorySize
  ],
  servePath: "/.netlify/functions/inngest-unified"
});

// Main handler function
const handler = async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const env = getEnvironment();
  
  // Handle GET requests with a detailed status page
  if (req.method === "GET" && !url.searchParams.has("fnId")) {
    return new Response(JSON.stringify({
      message: "Inngest endpoint is active",
      status: "active",
      endpoint: "/.netlify/functions/inngest-unified",
      environment: env,
      functions: [
        { id: "test-function", event: "test/hello" },
        { id: "capture-repository-sync-graphql", event: "capture/repository.sync.graphql" },
        { id: "capture-pr-details-graphql", event: "capture/pr.details.graphql" },
        { id: "capture-pr-details", event: "capture/pr.details" },
        { id: "capture-pr-reviews", event: "capture/pr.reviews" },
        { id: "capture-pr-comments", event: "capture/pr.comments" },
        { id: "capture-repository-sync", event: "capture/repository.sync" },
        { id: "classify-single-repository", event: "classify/repository.single" },
        { id: "classify-repository-size", event: "classify/repository.size" }
      ],
      usage: {
        testEvent: 'Send: { "name": "test/hello", "data": { "message": "Hello!" } }',
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

  // Pass all other requests to Inngest
  return inngestHandler(req, context);
};

// Export for Netlify Functions
export default handler;
export { handler };