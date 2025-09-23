// Production Inngest function for contributor.info
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import factory functions for consistent client usage
import { createInngestFunctions } from "../../src/lib/inngest/functions/factory";

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

// Create functions using the factory with production client
const functions = createInngestFunctions(inngest);

// Create the serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [
    // All factory-created functions
    functions.captureRepositorySyncGraphQL,
    functions.capturePrDetails,
    functions.capturePrDetailsGraphQL,
    functions.capturePrReviews,
    functions.capturePrComments,
    functions.captureRepositorySync,
    functions.classifyRepositorySize,
    functions.classifySingleRepository,
    functions.updatePrActivity,
    functions.discoverNewRepository,
    functions.captureIssueComments,
    functions.captureRepositoryIssues,
  ],
  servePath: "/.netlify/functions/inngest-prod"
});

// Create the main handler function
const mainHandler = async (req: Request, context: Context) => {
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
        { id: "capture-repository-sync-graphql", event: "capture/repository.sync.graphql" },
        { id: "capture-pr-details", event: "capture/pr.details" },
        { id: "capture-pr-details-graphql", event: "capture/pr.details.graphql" },
        { id: "capture-pr-reviews", event: "capture/pr.reviews" },
        { id: "capture-pr-comments", event: "capture/pr.comments" },
        { id: "capture-repository-sync", event: "capture/repository.sync" },
        { id: "classify-repository-size", event: "classify/repository.size" },
        { id: "classify-single-repository", event: "classify/repository.single" },
        { id: "update-pr-activity", event: "update/pr.activity" },
        { id: "discover-new-repository", event: "discover/repository.new" },
        { id: "capture-issue-comments", event: "capture/issue.comments" },
        { id: "capture-repository-issues", event: "capture/repository.issues" }
      ],
      usage: {
        syncEvent: 'Send: { "name": "capture/repository.sync.graphql", "data": { "repositoryId": "123", "days": 30 } }',
        prEvent: 'Send: { "name": "capture/pr.details", "data": { "pull_request_id": "123", "repository_id": "456" } }',
        classifyEvent: 'Send: { "name": "classify/repository.single", "data": { "repositoryId": "123" } }'
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

// Export default as the wrapper and handler as the raw inngest handler
export default mainHandler;
export const handler = inngestHandler;