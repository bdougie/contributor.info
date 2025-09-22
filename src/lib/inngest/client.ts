import { createDefaultClient } from './client-config';

// Create the Inngest client using the shared configuration
// This ensures consistency across all uses
export const inngest = createDefaultClient();

// Define event schemas for type safety
export type DataCaptureEvents = {
  'capture/pr.details': {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  'capture/pr.details.graphql': {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  'capture/pr.reviews': {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      prGithubId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  'capture/pr.comments': {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      prGithubId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  'capture/repository.sync': {
    data: {
      repositoryId: string;
      days: number;
      priority: 'critical' | 'high' | 'medium' | 'low';
      reason: string;
    };
  };
  'capture/repository.sync.graphql': {
    data: {
      repositoryId: string;
      days: number;
      priority: 'critical' | 'high' | 'medium' | 'low';
      reason: string;
    };
  };
  'capture/commits.analyze': {
    data: {
      repositoryId: string;
      commitSha: string;
      priority: 'high' | 'medium' | 'low';
      batchId: string;
    };
  };
  'capture/batch.completed': {
    data: {
      repositoryId: string;
      jobType: string;
      successCount: number;
      failureCount: number;
      totalCount: number;
    };
  };
  'classify/repository.size': {
    data: Record<string, never>; // No data needed for scheduled job
  };
  'classify/repository.single': {
    data: {
      repositoryId: string;
      owner: string;
      repo: string;
    };
  };
};
