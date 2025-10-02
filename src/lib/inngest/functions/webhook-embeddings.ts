import { inngest } from '../client';
import { supabase } from '../supabase-server';
import { NonRetriableError } from 'inngest';

/**
 * Handle embedding generation triggered by issue webhooks
 * Bridges webhook events to compute-embeddings function
 */
export const handleIssueEmbeddingWebhook = inngest.createFunction(
  {
    id: 'handle-issue-embedding-webhook',
    name: 'Handle Issue Embedding from Webhook',
    retries: 2,
  },
  { event: 'embedding/issue.generate' },
  async ({ event, step }) => {
    const { issueId, priority } = event.data;

    // Verify issue exists
    const issue = await step.run('verify-issue', async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, repository_id, title, body')
        .eq('id', issueId)
        .maybeSingle();

      if (error || !data) {
        throw new NonRetriableError(`Issue ${issueId} not found`);
      }

      return data;
    });

    // Trigger compute embeddings for this repository
    await step.run('trigger-compute', async () => {
      await inngest.send({
        name: 'embeddings/compute.requested',
        data: {
          repositoryId: issue.repository_id,
          itemTypes: ['issues'],
        },
      });
    });

    return {
      issueId,
      repositoryId: issue.repository_id,
      priority,
      status: 'queued_for_computation',
    };
  }
);

/**
 * Handle embedding generation triggered by PR webhooks
 * Bridges webhook events to compute-embeddings function
 */
export const handlePREmbeddingWebhook = inngest.createFunction(
  {
    id: 'handle-pr-embedding-webhook',
    name: 'Handle PR Embedding from Webhook',
    retries: 2,
  },
  { event: 'embedding/pr.generate' },
  async ({ event, step }) => {
    const { prId, priority } = event.data;

    // Verify PR exists
    const pr = await step.run('verify-pr', async () => {
      const { data, error } = await supabase
        .from('pull_requests')
        .select('id, repository_id, title, body')
        .eq('id', prId)
        .maybeSingle();

      if (error || !data) {
        throw new NonRetriableError(`PR ${prId} not found`);
      }

      return data;
    });

    // Trigger compute embeddings for this repository
    await step.run('trigger-compute', async () => {
      await inngest.send({
        name: 'embeddings/compute.requested',
        data: {
          repositoryId: pr.repository_id,
          itemTypes: ['pull_requests'],
        },
      });
    });

    return {
      prId,
      repositoryId: pr.repository_id,
      priority,
      status: 'queued_for_computation',
    };
  }
);

/**
 * Handle batch embedding processing (from installations)
 * Bridges webhook events to compute-embeddings function
 */
export const handleBatchEmbeddingWebhook = inngest.createFunction(
  {
    id: 'handle-batch-embedding-webhook',
    name: 'Handle Batch Embedding from Webhook',
    retries: 2,
  },
  { event: 'embedding/batch.process' },
  async ({ event, step }) => {
    const { installationId, repositoryId, items } = event.data;

    // Trigger compute embeddings for this repository
    await step.run('trigger-compute', async () => {
      await inngest.send({
        name: 'embeddings/compute.requested',
        data: {
          repositoryId,
          itemTypes: ['issues', 'pull_requests'],
        },
      });
    });

    return {
      installationId,
      repositoryId,
      itemsQueued: items.length,
      status: 'queued_for_computation',
    };
  }
);

/**
 * Handle similarity recalculation requests
 * Triggers compute embeddings for the repository
 */
export const handleSimilarityRecalculation = inngest.createFunction(
  {
    id: 'handle-similarity-recalculation',
    name: 'Handle Similarity Recalculation',
    retries: 2,
  },
  { event: 'similarity/repository.recalculate' },
  async ({ event, step }) => {
    const { repositoryId, triggerType, priority } = event.data;

    // Trigger compute embeddings for this repository
    await step.run('trigger-compute', async () => {
      await inngest.send({
        name: 'embeddings/compute.requested',
        data: {
          repositoryId,
          itemTypes: ['issues', 'pull_requests'],
        },
      });
    });

    return {
      repositoryId,
      triggerType,
      priority,
      status: 'queued_for_computation',
    };
  }
);
