// Local development Inngest function with all capture functions
import { serve } from "inngest/lambda";
import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

// Import the shared client configuration
import { createLocalClient } from "../../src/lib/inngest/client-config";

// Import factory functions instead of pre-created functions
import { createInngestFunctions } from "../../src/lib/inngest/functions/factory";

// Ensure GITHUB_TOKEN is available
if (!process.env.GITHUB_TOKEN && process.env.VITE_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
}

// Create Inngest client for local development using shared config
const inngest = createLocalClient();

// Log configuration only on first load
if (!process.env._INNGEST_CONFIG_LOGGED) {
  console.log('Inngest Local Configuration:', {
    appId: process.env.VITE_INNGEST_APP_ID || "contributor-info",
    hasEventKey: !!process.env.INNGEST_EVENT_KEY,
    hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
    hasGithubToken: !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN,
    hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
    isDev: true,
    endpoint: "http://localhost:8888/.netlify/functions/inngest-local-full"
  });
  process.env._INNGEST_CONFIG_LOGGED = 'true';
}

// Create functions using the factory with the local client
const factoryFunctions = createInngestFunctions(inngest);

// Create the Inngest serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [
    // All factory-created functions
    factoryFunctions.captureRepositorySyncGraphQL,
    factoryFunctions.capturePrDetails,
    factoryFunctions.capturePrDetailsGraphQL,
    factoryFunctions.capturePrReviews,
    factoryFunctions.capturePrComments,
    factoryFunctions.captureRepositorySync,
    factoryFunctions.classifyRepositorySize,
    factoryFunctions.classifySingleRepository,
    factoryFunctions.updatePrActivity,
    factoryFunctions.discoverNewRepository,
    factoryFunctions.captureIssueComments,
    factoryFunctions.captureRepositoryIssues,
  ],
  landingPage: true,
  serveHost: "http://localhost:8888",
  servePath: "/.netlify/functions/inngest-local-full"
});

// Export the handler directly
export const handler = inngestHandler;

// Default export for compatibility
export default handler;