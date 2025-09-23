import { Inngest } from 'inngest';
import { env, serverEnv } from '../env';

/**
 * Configuration for Inngest client based on environment
 */
export interface InngestClientConfig {
  id: string;
  isDev: boolean;
  eventKey: string;
  signingKey?: string;
}

/**
 * Detect development environment
 */
export const isDevelopment = (): boolean => {
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

/**
 * Get event key based on context
 */
export const getEventKey = (): string => {
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

/**
 * Get signing key for production
 */
export const getSigningKey = (): string | undefined => {
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

/**
 * Get default client configuration
 */
export const getDefaultClientConfig = (): InngestClientConfig => {
  return {
    id: env.INNGEST_APP_ID || 'contributor-info',
    isDev: isDevelopment(),
    eventKey: getEventKey(),
    signingKey: getSigningKey(),
  };
};

/**
 * Create an Inngest client with the default configuration
 */
export const createDefaultClient = (): Inngest => {
  const config = getDefaultClientConfig();
  return new Inngest(config);
};

/**
 * Create an Inngest client for local development
 * This always uses development mode and local keys
 */
export const createLocalClient = (): Inngest => {
  return new Inngest({
    id: process.env.VITE_INNGEST_APP_ID || 'contributor-info-local',
    isDev: true, // Always dev mode for local
    eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key',
    // Don't use signing key in dev mode - it causes sync issues
    // signingKey: process.env.INNGEST_SIGNING_KEY,
  });
};
