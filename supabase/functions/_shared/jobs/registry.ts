/**
 * Job type → handler. `capture/*` is handled separately by the worker (each
 * one is a gh-datapipe Fly machine, see ../datapipe-capture.ts) and retired
 * events never reach the queue (see ./retired.ts).
 */

import { classifyRepositoryBatch, classifySingleRepository } from './classify-repositories.ts';
import { discoverRepository } from './discover-repository.ts';
import {
  computeRequested,
  generateForRepository,
  issueEmbedding,
  prEmbedding,
  repositoryEmbeddings,
} from './embeddings.ts';
import { refreshRepositoryMetadata } from './refresh-repository-metadata.ts';
import { sendSlackAssigneeReports } from './slack-assignee-report.ts';
import {
  prDetailsBatchJob,
  syncRepositoryBasicJob,
  syncRepositoryGraphQLJob,
  webhookFallbackJob,
} from './sync-router.ts';
import type { JobHandler } from './types.ts';
import { syncWorkspacePriorities } from './workspace-priorities.ts';

export const JOB_HANDLERS: Record<string, JobHandler> = {
  // Classification
  'classify/repository.single': classifySingleRepository,
  'classify/repository.size': classifyRepositoryBatch,

  // Discovery
  'discover/repository.new': discoverRepository,
  'capture/repository.discover': discoverRepository,

  // Embeddings
  'embeddings/compute.requested': computeRequested,
  'embeddings.generate': generateForRepository,
  'embedding/issue.generate': issueEmbedding,
  'embedding/pr.generate': prEmbedding,
  'embedding/batch.process': repositoryEmbeddings,
  'similarity/repository.recalculate': repositoryEmbeddings,

  // Workspaces
  'workspace/priorities.sync': syncWorkspacePriorities,

  // Former Inngest crons with no event-driven twin
  'cron/refresh-repository-metadata': refreshRepositoryMetadata,
  'cron/slack-assignee-report': sendSlackAssigneeReports,

  // Netlify sync-router
  'sync-router/repository.sync': syncRepositoryBasicJob,
  'sync-router/repository.sync.graphql': syncRepositoryGraphQLJob,
  'sync-router/pr.details.batch': prDetailsBatchJob,

  // Fallback for webhook rows that were meant for process-webhook
  'webhook/pull_request': webhookFallbackJob,
  'webhook/issues': webhookFallbackJob,
  'webhook/push': webhookFallbackJob,
  'webhook/repository': webhookFallbackJob,
};

export function hasHandler(type: string): boolean {
  return type in JOB_HANDLERS;
}
