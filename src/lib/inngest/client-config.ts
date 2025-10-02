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
    // Check if we're on localhost/127.0.0.1
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // In production domains (netlify.app, contributor.info, etc), it's NOT development
    if (!isLocalhost) {
      return false;
    }

    return isLocalhost || env.DEV;
  }

  // Server environment - check multiple indicators
  const nodeEnv = process.env.NODE_ENV;
  const netlifyContext = process.env.CONTEXT;

  // Explicitly check for production context
  if (netlifyContext === 'production' || nodeEnv === 'production') {
    return false;
  }

  // Only return true for development if explicitly set
  return env.MODE === 'development' || nodeEnv === 'development';
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

  // Check for missing or invalid event key in production
  // 'dev-key' is not valid for production environments
  if (!isDevelopment() && (!config.eventKey || config.eventKey === 'dev-key')) {
    console.warn('• Inngest background jobs: Service disabled or configuration missing');
    return null;
  }

  // In browser context during LOCAL development ONLY, add local baseUrl
  if (typeof window !== 'undefined') {
    const isLocalhost =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost && isDevelopment()) {
      // Only use local baseUrl when actually on localhost IN BROWSER CONTEXT
      return new Inngest({
        ...config,
        eventKey: config.eventKey || undefined, // Convert null to undefined for Inngest
        baseUrl: 'http://127.0.0.1:8288',
      });
    }

    // Browser in production - no baseUrl override
    if (!config.eventKey || config.eventKey === 'dev-key') {
      console.warn('• Inngest background jobs: Service disabled or configuration missing');
      return null;
    }

    return new Inngest({
      ...config,
      eventKey: config.eventKey || undefined, // Convert null to undefined for Inngest
    });
  }

  // For server context (including Netlify functions)
  // NEVER use localhost baseUrl in server context as it won't be reachable
  // Let Inngest SDK determine the correct URL based on environment
  if (!config.eventKey || (!isDevelopment() && config.eventKey === 'dev-key')) {
    console.warn('• Inngest background jobs: Service disabled or configuration missing');
    return null;
  }

  // Don't specify baseUrl for server context - let Inngest SDK handle it
  return new Inngest({
    ...config,
    eventKey: config.eventKey || undefined, // Convert null to undefined for Inngest
    // NO baseUrl here - this allows Inngest SDK to use cloud endpoints correctly
  });
};

/**
 * Create an Inngest client for local development
 * This always uses development mode and local keys
 */
export const createLocalClient = (): Inngest => {
  // Only use baseUrl in browser context, not in server/function context
  const config: {
    id: string;
    isDev: boolean;
    eventKey: string;
    baseUrl?: string;
  } = {
    id: process.env.VITE_INNGEST_APP_ID || 'contributor-info',
    isDev: true, // Always dev mode for local
    eventKey: process.env.INNGEST_EVENT_KEY || 'local-dev-key',
  };

  // Only add baseUrl when in browser context on localhost
  // Never in server/Netlify function context as it won't be reachable
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    config.baseUrl = 'http://127.0.0.1:8288';
  }
  // For server context (including Netlify functions), don't specify baseUrl
  // Let the Inngest SDK use its default behavior

  return new Inngest(config);
};
