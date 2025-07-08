import { serve } from "inngest/lambda";
import { inngest } from "../../src/lib/inngest/client";
import {
  capturePrDetails,
  capturePrReviews,
  capturePrComments,
  captureRepositorySync,
} from "../../src/lib/inngest/functions";

// Create and export the Netlify handler
export const handler = serve({
  client: inngest,
  functions: [
    capturePrDetails,
    capturePrReviews,
    capturePrComments,
    captureRepositorySync,
  ],
});