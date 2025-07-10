import { Inngest } from "inngest";

// Detect development environment
const isDevelopment = () => {
  // Browser environment
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost';
  }
  
  // Environment variables - direct access
  const eventKey = ((import.meta as any).env?.VITE_INNGEST_EVENT_KEY || process.env.VITE_INNGEST_EVENT_KEY) || 'dev-key';
  
  return eventKey === 'dev-event-key' || eventKey === 'dev-key';
};

// Create the Inngest client
export const inngest = new Inngest({ 
  id: "contributor-info",
  // Set to development mode for local testing
  isDev: isDevelopment(),
  // Add event key from environment
  eventKey: ((import.meta as any).env?.VITE_INNGEST_EVENT_KEY || process.env.VITE_INNGEST_EVENT_KEY) || 'dev-key',
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