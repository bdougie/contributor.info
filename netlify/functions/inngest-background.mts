// Background Inngest function for long-running operations
// Background functions can run up to 15 minutes on Netlify Pro plans
import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import all capture functions
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

// Create Inngest client
const inngest = new Inngest({ 
  id: process.env.VITE_INNGEST_APP_ID || "contributor-info",
  isDev: process.env.NODE_ENV !== 'production',
  eventKey: process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY || process.env.INNGEST_PRODUCTION_SIGNING_KEY,
});

// Create handler with all functions
const handler = serve({ 
  client: inngest, 
  functions: [
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureRepositorySync,
    capturePrDetailsGraphQL,
    captureRepositorySyncGraphQL,
    classifyRepositorySize,
    classifySingleRepository,
    updatePrActivity,
    discoverNewRepository,
  ],
  servePath: '/.netlify/functions/inngest-background',
  signingKey: process.env.INNGEST_SIGNING_KEY || process.env.INNGEST_PRODUCTION_SIGNING_KEY,
  logLevel: 'info',
});

// Export as background function (note the different export syntax)
export default async (request: Request, context: Context) => {
  // Background functions receive a Request object
  return handler(request, context);
};

// This configuration tells Netlify this is a background function
export const config = {
  type: "background"
};