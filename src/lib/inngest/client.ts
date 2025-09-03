import { Inngest } from 'inngest';
import { env, serverEnv } from '../env';

// Detect development environment
const isDevelopment = () => {
  // Browser environment
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'localhost' || env.DEV;
  }

  // Server environment - check multiple indicators
  const nodeEnv = process.env.NODE_ENV;
  const netlifyContext = process.env.CONTEXT;

  // Explicitly check for production context
  if (netlifyContext === 'production' || nodeEnv === 'production') {
    return false;
  }

  // Default to development for safety
  return env.MODE === 'development' || nodeEnv !== 'production';
};

// Get event key safely based on context
const getEventKey = () => {
  // In browser context, we need the production event key for sending events
  if (typeof window !== 'undefined') {
    // Try to get a production event key from environment
    const prodKey = env.VITE_INNGEST_EVENT_KEY;
    if (prodKey) {
      return prodKey;
    }

    // Fall back to a placeholder, but warn that events won't work
    console.warn(
      '[Inngest] No production event key found for browser client. Event sending will fail.'
    );
    return 'browser-client-no-key';
  }

  // Server context - prefer production keys to match production endpoint
  const eventKey =
    process.env.INNGEST_PRODUCTION_EVENT_KEY ||
    serverEnv.INNGEST_EVENT_KEY ||
    process.env.INNGEST_EVENT_KEY;

  // In production, ensure we have a real key
  if (!isDevelopment() && (!eventKey || eventKey === 'dev-key')) {
    console.warn('[Inngest] Production environment detected but no valid event key found');
  }

  return eventKey || 'dev-key';
};

// Get signing key for production
const getSigningKey = () => {
  if (typeof window !== 'undefined') {
    return undefined; // Not needed in browser
  }

  // Prefer production signing key to match production endpoint
  const signingKey =
    process.env.INNGEST_PRODUCTION_SIGNING_KEY ||
    serverEnv.INNGEST_SIGNING_KEY ||
    process.env.INNGEST_SIGNING_KEY;

  // In production, we need a signing key
  if (!isDevelopment() && !signingKey) {
    console.warn('[Inngest] Production environment detected but no signing key found');
  }

  return signingKey;
};

// Create the Inngest client
export const inngest = new Inngest({
  id: env.INNGEST_APP_ID,
  // Set to development mode for local testing
  isDev: isDevelopment(),
  // Add event key from environment (server-side only)
  eventKey: getEventKey(),
  // Add signing key for production verification
  signingKey: getSigningKey(),
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
