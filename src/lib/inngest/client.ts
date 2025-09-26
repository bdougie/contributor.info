import { createDefaultClient } from './client-config';
import type { Inngest } from 'inngest';

// Lazy initialization to ensure browser context is available
let _inngestClient: Inngest | null = null;

// Create the Inngest client using the shared configuration
// This ensures consistency across all uses
export const inngest = new Proxy({} as Inngest, {
  get(_target, prop, receiver) {
    if (!_inngestClient) {
      _inngestClient = createDefaultClient();
    }
    return Reflect.get(_inngestClient, prop, receiver);
  },
});

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
