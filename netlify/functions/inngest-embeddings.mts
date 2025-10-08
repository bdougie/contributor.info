import { serve } from 'inngest/lambda';
import type { Context } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';
import {
  generateEmbeddings,
  batchGenerateEmbeddings,
} from '../../src/lib/inngest/functions/generate-embeddings';
// Note: computeEmbeddings moved to Supabase edge function for better performance
// import { computeEmbeddings } from '../../src/lib/inngest/functions/compute-embeddings';
import {
  handleIssueEmbeddingWebhook,
  handlePREmbeddingWebhook,
  handleBatchEmbeddingWebhook,
  handleSimilarityRecalculation,
} from '../../src/lib/inngest/functions/webhook-embeddings';
import {
  aggregateWorkspaceMetrics,
  scheduledWorkspaceAggregation,
  handleWorkspaceRepositoryChange,
  cleanupWorkspaceMetricsData,
} from '../../src/lib/inngest/functions/aggregate-workspace-metrics';

// Create the Inngest serve handler for embeddings and workspace metrics
const inngestHandler = serve({
  client: inngest,
  functions: [
    // Legacy embeddings functions (using @xenova/transformers)
    generateEmbeddings,
    batchGenerateEmbeddings,
    // Note: computeEmbeddings now runs on Supabase edge function (inngest-prod)
    // for better cold start performance and no 42MB bundle size
    // Webhook bridge functions
    handleIssueEmbeddingWebhook,
    handlePREmbeddingWebhook,
    handleBatchEmbeddingWebhook,
    handleSimilarityRecalculation,
    // Workspace metrics functions
    aggregateWorkspaceMetrics,
    scheduledWorkspaceAggregation,
    handleWorkspaceRepositoryChange,
    cleanupWorkspaceMetricsData,
  ],
  servePath: '/.netlify/functions/inngest-embeddings',
});

// Export the Netlify handler
export default async (req: Request, context: Context) => {
  // Handle GET requests with a status page
  if (req.method === 'GET' && !req.url.includes('?')) {
    return new Response(
      JSON.stringify({
        message: 'Inngest Embeddings & Workspace Metrics endpoint is active',
        endpoint: '/.netlify/functions/inngest-embeddings',
        note: 'Handles embeddings and workspace metrics functions that require Node.js dependencies',
        functions: [
          'generate-embeddings',
          'batch-generate-embeddings',
          // 'compute-embeddings', // Moved to Supabase (inngest-prod)
          'handle-issue-embedding-webhook',
          'handle-pr-embedding-webhook',
          'handle-batch-embedding-webhook',
          'handle-similarity-recalculation',
          'aggregate-workspace-metrics',
          'scheduled-workspace-aggregation',
          'handle-workspace-repository-change',
          'cleanup-workspace-metrics-data',
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
          'workspace.metrics.aggregate': 'aggregate-workspace-metrics',
          'cron (5m)': 'scheduled-workspace-aggregation',
          'workspace.repository.changed': 'handle-workspace-repository-change',
          'cron (daily 3am)': 'cleanup-workspace-metrics-data',
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
