import { Inngest } from "inngest";
import { env, serverEnv } from '../env';

// Detect development environment
const isDevelopment = () => {
  // Browser environment
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || env.DEV;
  }
  
  // Server environment
  return env.MODE === 'development';
};

// Get event key safely based on context
const getEventKey = () => {
  // In browser context, Inngest client only needs basic functionality
  // Event key is only needed for sending events, which happens server-side
  if (typeof window !== 'undefined') {
    return 'browser-client'; // Placeholder for browser client
  }
  
  // Server context - access the real event key securely
  return serverEnv.INNGEST_EVENT_KEY || 'dev-key';
};

// Create the Inngest client
export const inngest = new Inngest({ 
  id: env.INNGEST_APP_ID,
  // Set to development mode for local testing
  isDev: isDevelopment(),
  // Add event key from environment (server-side only)
  eventKey: getEventKey(),
});

// Define event schemas for type safety
export type DataCaptureEvents = {
  "capture/pr.details": {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  "capture/pr.details.graphql": {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  "capture/pr.reviews": {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      prGithubId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  "capture/pr.comments": {
    data: {
      repositoryId: string;
      prNumber: string;
      prId: string;
      prGithubId: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
    };
  };
  "capture/repository.sync": {
    data: {
      repositoryId: string;
      days: number;
      priority: 'critical' | 'high' | 'medium' | 'low';
      reason: string;
    };
  };
  "capture/repository.sync.graphql": {
    data: {
      repositoryId: string;
      days: number;
      priority: 'critical' | 'high' | 'medium' | 'low';
      reason: string;
    };
  };
  "capture/commits.analyze": {
    data: {
      repositoryId: string;
      commitSha: string;
      priority: 'high' | 'medium' | 'low';
      batchId: string;
    };
  };
  "capture/batch.completed": {
    data: {
      repositoryId: string;
      jobType: string;
      successCount: number;
      failureCount: number;
      totalCount: number;
    };
  };
};