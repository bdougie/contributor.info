// Production Inngest function for contributor.info
import { Inngest } from 'inngest';
import { serve } from 'inngest/lambda';
import type { Context } from '@netlify/functions';

// Import real Inngest function implementations (without embeddings to avoid import.meta issues)
import {
  capturePrDetails,
  capturePrDetailsGraphQL,
  capturePrReviews,
  capturePrComments,
  captureRepositorySync,
  captureRepositorySyncGraphQL,
  classifyRepositorySize,
  classifySingleRepository,
} from '../../src/lib/inngest/functions/index-without-embeddings';
import { discoverNewRepository } from '../../src/lib/inngest/functions/discover-new-repository';
import { captureIssueComments } from '../../src/lib/inngest/functions/capture-issue-comments';
import { captureRepositoryIssues } from '../../src/lib/inngest/functions/capture-repository-issues';
import { updatePrActivity } from '../../src/lib/inngest/functions/update-pr-activity';

// Environment detection - treat deploy previews as production for signing
const isProduction = () => {
  const context = process.env.CONTEXT;
  const nodeEnv = process.env.NODE_ENV;

  // Deploy previews should use production mode for proper signing
  return (
    context === 'production' ||
    context === 'deploy-preview' ||
    nodeEnv === 'production' ||
    process.env.NETLIFY === 'true'
  ); // All Netlify environments use production mode
};

// Get production environment variables
const getProductionEnvVar = (key: string, fallbackKey?: string): string => {
  // For production, use production-specific keys first
  if (isProduction()) {
    return (
      process.env[`INNGEST_PRODUCTION_${key}`] ||
      process.env[key] ||
      (fallbackKey ? process.env[fallbackKey] : '') ||
      ''
    );
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

// Create the serve handler with real function implementations
const inngestHandler = serve({
  client: inngest,
  functions: [
    // Real implementations that update job status
    captureRepositorySyncGraphQL,
    capturePrDetails,
    capturePrDetailsGraphQL,
    capturePrReviews,
    capturePrComments,
    captureRepositorySync,
    classifyRepositorySize,
    classifySingleRepository,
    updatePrActivity,
    discoverNewRepository,
    captureIssueComments,
    captureRepositoryIssues,
  ],
  servePath: '/.netlify/functions/inngest-prod',
});

// Create the main handler function
const mainHandler = async (req: Request, context: Context) => {
  // Pass ALL requests directly to Inngest SDK
  // This allows proper handling of:
  // - GET requests with fnId for function introspection
  // - PUT requests for sync operations (important for Supabase edge functions)
  // - POST requests for event processing
  // The Inngest SDK handles all these internally including its own status endpoints
  return inngestHandler(req, context);
};

// Export default as the wrapper and handler as the raw inngest handler
export default mainHandler;
export const handler = inngestHandler;
