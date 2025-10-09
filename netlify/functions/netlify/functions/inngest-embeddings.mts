import { serve } from 'inngest/lambda';
import type { Context } from '@netlify/functions';
import { inngest } from '../../src/lib/inngest/client';
// Note: ALL embeddings functions moved to Supabase edge function (inngest-prod)
// to avoid 42MB @xenova/transformers bundle that causes cold start timeouts
// import { generateEmbeddings, batchGenerateEmbeddings } from '../../src/lib/inngest/functions/generate-embeddings';
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

// Create the Inngest serve handler for webhook bridges and workspace metrics
const inngestHandler = serve({
  client: inngest,
  functions: [
    // Note: All embeddings generation moved to Supabase edge function (inngest-prod)
    // to avoid 42MB @xenova/transformers bundle causing 502 cold start timeouts

    // Webhook bridge functions (lightweight, no heavy dependencies)
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
        message: 'Inngest Webhook Bridges & Workspace Metrics endpoint is active',
        endpoint: '/.netlify/functions/inngest-embeddings',
        note: 'Handles webhook bridges and workspace metrics. All embeddings functions moved to Supabase edge function to avoid 42MB bundle causing cold start timeouts.',
        functions: [
          // All embeddings generation moved to Supabase (inngest-prod)
          'handle-issue-embedding-webhook',
          'handle-pr-embedding-webhook',
          'handle-batch-embedding-webhook',
          'handle-similarity-recalculation',
          'aggregate-workspace-metrics',
          'scheduled-workspace-aggregation',
          'handle-workspace-repository-change',
          'cleanup-workspace-metrics-data',
        ],
        movedToSupabase: ['generate-embeddings', 'batch-generate-embeddings', 'compute-embeddings'],
        eventHandlers: {
          // Embeddings events now handled by Supabase inngest-prod
          // 'embeddings.generate' -> Supabase
          // 'cron (6h)' -> Supabase (batch-generate-embeddings)
          // 'embeddings/compute.requested' & 'cron (15m)' -> Supabase (compute-embeddings)
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
