import { Inngest } from 'inngest';
import { env, serverEnv } from '../env';

/**
 * Configuration for Inngest client based on environment
 */
export interface InngestClientConfig {
  id: string;
  isDev: boolean;
  eventKey: string | null;
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
export const getEventKey = (): string | null => {
  // In browser context, check if we're in development
  if (typeof window !== 'undefined') {
    // If we're on localhost, use local dev key
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'local-dev-key';
    }

    // In production browser context, we need the production event key
    const prodKey = env.VITE_INNGEST_EVENT_KEY;
    if (prodKey) {
      return prodKey;
    }

    // In production without a key, return null to disable Inngest entirely
    if (!isDevelopment()) {
      console.warn('• Inngest background jobs: Service disabled or configuration missing');
      return null;
    }

    // In development, fall back to dev key
    console.warn('• Inngest background jobs: Using local development mode');
    return 'dev-key';
  }

  // Server context - prefer production keys to match production endpoint
  const eventKey =
    process.env.INNGEST_PRODUCTION_EVENT_KEY ||
    serverEnv.INNGEST_EVENT_KEY ||
    process.env.INNGEST_EVENT_KEY;

  // In production, ensure we have a real key
  if (!isDevelopment() && (!eventKey || eventKey === 'dev-key')) {
    console.warn('• Inngest background jobs: Service disabled or configuration missing');
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
    console.warn('• Inngest background jobs: Service disabled or configuration missing');
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
 * Returns null if configuration is invalid (missing keys in production)
 */
export const createDefaultClient = (): Inngest | null => {
  const config = getDefaultClientConfig();

  // If no event key and not in development, return null to disable Inngest
  if (!config.eventKey && !isDevelopment()) {
    console.warn('• Inngest background jobs: Service disabled or configuration missing');
    return null;
  }

  // In browser context during development, add local baseUrl
  if (typeof window !== 'undefined' && isDevelopment()) {
    return new Inngest({
      ...config,
      eventKey: config.eventKey || undefined, // Convert null to undefined for Inngest
      baseUrl: 'http://127.0.0.1:8288',
    });
  }

  // For production or server context
  if (!config.eventKey) {
    console.warn('• Inngest background jobs: Service disabled or configuration missing');
    return null;
  }

  return new Inngest({
    ...config,
    eventKey: config.eventKey || undefined, // Convert null to undefined for Inngest
  });
};

/**
 * Create an Inngest client for local development
 * This always uses development mode and local keys
 */
export const createLocalClient = (): Inngest => {
  return new Inngest({
    id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
    isDev: true, // Always dev mode for local
    eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key',
    // Don't use signing key in dev mode - it causes sync issues
    // signingKey: process.env.INNGEST_SIGNING_KEY,
  });
};
