// Inngest sync endpoint - production endpoint for Inngest sync
// Uses factory pattern for consistent client configuration

import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import factory functions for consistent client usage
import { createInngestFunctions } from "../../src/lib/inngest/functions/factory";

// Environment detection
const isProduction = () => {
  const context = process.env.CONTEXT;
  const nodeEnv = process.env.NODE_ENV;

  return context === 'production' ||
         context === 'deploy-preview' ||
         nodeEnv === 'production' ||
         process.env.NETLIFY === 'true';
};

// Get production environment variables
const getProductionEnvVar = (key: string, fallbackKey?: string): string => {
  if (isProduction()) {
    return process.env[`INNGEST_PRODUCTION_${key}`] || process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
  }
  return process.env[key] || (fallbackKey ? process.env[fallbackKey] : '') || '';
};

// Ensure GITHUB_TOKEN is available
if (!process.env.GITHUB_TOKEN && process.env.VITE_GITHUB_TOKEN) {
  process.env.GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN;
}

// Create Inngest client
const inngest = new Inngest({
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false,
  eventKey: getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  signingKey: getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
});

// Log configuration for debugging
console.log('Inngest Sync Configuration:', {
  appId: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  hasEventKey: !!getProductionEnvVar('EVENT_KEY', 'INNGEST_EVENT_KEY'),
  hasSigningKey: !!getProductionEnvVar('SIGNING_KEY', 'INNGEST_SIGNING_KEY'),
  hasSupabaseUrl: !!process.env.SUPABASE_URL || !!process.env.VITE_SUPABASE_URL,
  hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY || !!process.env.VITE_SUPABASE_ANON_KEY,
  hasGithubToken: !!process.env.GITHUB_TOKEN || !!process.env.VITE_GITHUB_TOKEN,
  environment: isProduction() ? "production" : "preview",
});

// Create functions using the factory with production client
const functions = createInngestFunctions(inngest);

// Create the serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [
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
  servePath: "/.netlify/functions/inngest-sync"
});

// Main handler wrapper for Netlify - passes all requests to Inngest SDK
const mainHandler = async (req: Request, context: Context) => {
  // Pass ALL requests to Inngest SDK without any filtering
  // This allows the SDK to handle GET, PUT, POST and all query params including fnId
  return inngestHandler(req, context);
};

// Export the wrapped handler for Netlify
export default mainHandler;