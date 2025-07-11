import { serve } from "inngest/netlify";
import type { Context } from "@netlify/functions";
import { inngest } from "../../src/lib/inngest/client";
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureRepositorySync,
  capturePrDetailsGraphQL,
  captureRepositorySyncGraphQL,
} from "../../src/lib/inngest/functions";

// Create the Inngest serve handler
const inngestHandler = serve({
  client: inngest,
  functions: [
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureRepositorySync,
    // GraphQL versions for improved efficiency
    capturePrDetailsGraphQL,
    captureRepositorySyncGraphQL,
  ],
  servePath: "/.netlify/functions/inngest",
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  // Handle GET requests with a status page
  if (req.method === "GET" && !req.url.includes("?")) {
    return new Response(JSON.stringify({
      message: "Inngest endpoint is active",
      endpoint: "/.netlify/functions/inngest",
      functions: [
        "capture-pr-details",
        "capture-pr-reviews", 
        "capture-pr-comments",
        "capture-repository-sync",
        "capture-pr-details-graphql",
        "capture-repository-sync-graphql"
      ],
      environment: {
        context: process.env.CONTEXT || "unknown",
        hasEventKey: !!process.env.INNGEST_EVENT_KEY,
        hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }

  // Pass all other requests to Inngest
  return inngestHandler(req, context);
};

// Also export as handler for compatibility
export const handler = inngestHandler;