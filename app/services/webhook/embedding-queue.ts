import { inngest } from '../../../src/lib/inngest/client';

/**
 * Priority levels for embedding generation
 */
export type EmbeddingPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * EmbeddingQueueService - Unified event queueing for embeddings
 *
 * Provides consistent event naming and priority handling across all
 * webhook handlers for embedding generation tasks.
 */
export class EmbeddingQueueService {
  /**
   * Queue an issue for embedding generation
   */
  async queueIssueEmbedding(
    issueId: string,
    repositoryId: string,
    priority: EmbeddingPriority = 'high'
  ): Promise<void> {
    try {
      await inngest.send({
        name: 'embedding/issue.generate',
        data: {
          issueId,
          repositoryId,
          priority,
        },
      });

      console.log('Queued issue embedding: %s (priority: %s)', issueId, priority);
    } catch (error) {
      console.error('Error queueing issue embedding: %o', error);
      throw error;
    }
  }

  /**
   * Queue a pull request for embedding generation
   */
  async queuePREmbedding(
    prId: string,
    repositoryId: string,
    priority: EmbeddingPriority = 'high'
  ): Promise<void> {
    try {
      await inngest.send({
        name: 'embedding/pr.generate',
        data: {
          prId,
          repositoryId,
          priority,
        },
      });

      console.log('Queued PR embedding: %s (priority: %s)', prId, priority);
    } catch (error) {
      console.error('Error queueing PR embedding: %o', error);
      throw error;
    }
  }

  /**
   * Queue a batch of items for processing (for installations)
   */
  async queueBatchProcessing(
    installationId: string,
    repositoryId: string,
    items: Array<{ type: 'issue' | 'pr'; id: string }>
  ): Promise<void> {
    try {
      await inngest.send({
        name: 'embedding/batch.process',
        data: {
          installationId,
          repositoryId,
          items,
        },
      });

      console.log(
        'Queued batch processing for installation %s: %s items',
        installationId,
        items.length
      );
    } catch (error) {
      console.error('Error queueing batch processing: %o', error);
      throw error;
    }
  }

  /**
   * Update progress for an embedding job
   */
  async updateProgress(
    jobId: string,
    processed: number,
    total: number,
    status: 'processing' | 'completed' | 'failed'
  ): Promise<void> {
    try {
      await inngest.send({
        name: 'embedding/progress.update',
        data: {
          jobId,
          processed,
          total,
          status,
        },
      });
    } catch (error) {
      console.error('Error updating embedding progress: %o', error);
      throw error;
    }
  }

  /**
   * Queue similarity recalculation for a repository
   * Triggered when new issues are created or edited
   */
  async queueSimilarityRecalculation(
    repositoryId: string,
    triggerType: 'issue_created' | 'issue_edited' | 'pr_opened'
  ): Promise<void> {
    try {
      await inngest.send({
        name: 'similarity/repository.recalculate',
        data: {
          repositoryId,
          triggerType,
          priority: 'medium' as EmbeddingPriority,
        },
      });

      console.log('Queued similarity recalculation for repository: %s', repositoryId);
    } catch (error) {
      console.error('Error queueing similarity recalculation: %o', error);
      throw error;
    }
  }
}

// Export singleton instance
export const embeddingQueueService = new EmbeddingQueueService();
