import { serve } from 'inngest/lambda';
import type { Context } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';
import {
  generateEmbeddings,
  batchGenerateEmbeddings,
} from '../../src/lib/inngest/functions/generate-embeddings';
import { computeEmbeddings } from '../../src/lib/inngest/functions/compute-embeddings';
import {
  handleIssueEmbeddingWebhook,
  handlePREmbeddingWebhook,
  handleBatchEmbeddingWebhook,
  handleSimilarityRecalculation,
} from '../../src/lib/inngest/functions/webhook-embeddings';

// Create the Inngest serve handler for embeddings only
const inngestHandler = serve({
  client: inngest,
  functions: [
    // Legacy embeddings functions (using @xenova/transformers)
    generateEmbeddings,
    batchGenerateEmbeddings,
    // Modern embeddings function (using OpenAI API)
    computeEmbeddings,
    // Webhook bridge functions
    handleIssueEmbeddingWebhook,
    handlePREmbeddingWebhook,
    handleBatchEmbeddingWebhook,
    handleSimilarityRecalculation,
  ],
  servePath: '/.netlify/functions/inngest-embeddings',
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  // Handle GET requests with a status page
  if (req.method === 'GET' && !req.url.includes('?')) {
    return new Response(
      JSON.stringify({
        message: 'Inngest Embeddings endpoint is active',
        endpoint: '/.netlify/functions/inngest-embeddings',
        note: 'Handles embeddings-related functions that require Node.js dependencies',
        functions: [
          'generate-embeddings',
          'batch-generate-embeddings',
          'compute-embeddings',
          'handle-issue-embedding-webhook',
          'handle-pr-embedding-webhook',
          'handle-batch-embedding-webhook',
          'handle-similarity-recalculation',
        ],
        eventHandlers: {
          'embeddings.generate': 'generate-embeddings',
          'cron (6h)': 'batch-generate-embeddings',
          'embeddings/compute.requested': 'compute-embeddings',
          'cron (15m)': 'compute-embeddings',
          'embedding/issue.generate': 'handle-issue-embedding-webhook',
          'embedding/pr.generate': 'handle-pr-embedding-webhook',
          'embedding/batch.process': 'handle-batch-embedding-webhook',
          'similarity/repository.recalculate': 'handle-similarity-recalculation',
        },
        environment: {
          context: process.env.CONTEXT || 'unknown',
          hasEventKey: !!process.env.INNGEST_EVENT_KEY,
          hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
          hasOpenAIKey: !!process.env.VITE_OPENAI_API_KEY || !!process.env.OPENAI_API_KEY,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Pass all other requests to Inngest
  return inngestHandler(req, context);
};

// Also export as handler for compatibility
export const handler = inngestHandler;
