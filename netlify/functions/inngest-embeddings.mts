import { serve } from 'inngest/lambda';
import type { Context } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';
import {
  generateEmbeddings,
  batchGenerateEmbeddings,
} from '../../src/lib/inngest/functions/generate-embeddings';

// Create the Inngest serve handler for embeddings only
const inngestHandler = serve({
  client: inngest,
  functions: [generateEmbeddings, batchGenerateEmbeddings],
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
        functions: ['generate-embeddings', 'batch-generate-embeddings'],
        environment: {
          context: process.env.CONTEXT || 'unknown',
          hasEventKey: !!process.env.INNGEST_EVENT_KEY,
          hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
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
