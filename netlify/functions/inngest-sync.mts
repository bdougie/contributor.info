// Minimal alias endpoint for Inngest sync operations
// Provides /inngest-sync endpoint while reusing inngest-prod logic

import { Inngest } from "inngest";
import { serve } from "inngest/lambda";
import type { Context } from "@netlify/functions";

// Import the same functions that inngest-prod uses
import { createCaptureRepositorySyncGraphQL, createClassifySingleRepository } from "./inngest-prod-functions.mjs";
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

// Reuse the same Inngest client configuration as inngest-prod
const inngest = new Inngest({
  id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
  isDev: false,
});

// Create functions using the client
const captureRepositorySyncGraphQL = createCaptureRepositorySyncGraphQL(inngest);
const classifySingleRepository = createClassifySingleRepository(inngest);

// Serve at the inngest-sync path with the same functions as inngest-prod
export default serve({
  client: inngest,
  functions: [
    captureRepositorySyncGraphQL,
    capturePrDetailsGraphQL,
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureIssueComments,
    captureRepositoryIssues,
    captureRepositorySync,
    classifySingleRepository,
    classifyRepositorySize,
    discoverNewRepository
  ],
  servePath: "/.netlify/functions/inngest-sync"
});