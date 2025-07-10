/**
 * Secure environment variable access for client and server contexts
 * 
 * SECURITY RULES:
 * 1. Client code can only access VITE_* prefixed variables (public)
 * 2. Server code accesses non-VITE_* variables via process.env (private)
 * 3. Never expose server keys to the browser
 */

// Detect runtime environment
const isServer = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

/**
 * Client-side environment variables (SAFE for browser)
 * Only VITE_* prefixed variables are accessible
 */
export const clientEnv = {
  // Supabase public configuration
  SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || '',
  
  // GitHub public token (read-only)
  GITHUB_TOKEN: import.meta.env?.VITE_GITHUB_TOKEN || '',
  
  // Inngest public configuration (app identification only)
  INNGEST_APP_ID: import.meta.env?.VITE_INNGEST_APP_ID || 'contributor-info',
  
  // Other public keys
  OPENAI_API_KEY: import.meta.env?.VITE_OPENAI_API_KEY || '',
  POSTHOG_KEY: import.meta.env?.VITE_POSTHOG_KEY || '',
  POSTHOG_HOST: import.meta.env?.VITE_POSTHOG_HOST || '',
  SENTRY_DSN: import.meta.env?.VITE_SENTRY_DSN || '',
  DUB_CO_KEY: import.meta.env?.VITE_DUB_CO_KEY || '',
  DUB_DOMAIN_DEV: import.meta.env?.VITE_DUB_DOMAIN_DEV || '',
  DUB_DOMAIN_PROD: import.meta.env?.VITE_DUB_DOMAIN_PROD || '',
  
  // Development mode detection
  DEV: import.meta.env?.DEV || false,
  PROD: import.meta.env?.PROD || false,
  MODE: import.meta.env?.MODE || 'development',
};

/**
 * Server-side environment variables (PRIVATE - never exposed to browser)
 * Accessed via process.env in server contexts only
 */
export const serverEnv = {
  // Supabase admin/service keys
  get SUPABASE_SERVICE_ROLE_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  },
  
  get SUPABASE_TOKEN() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.SUPABASE_TOKEN || '';
  },
  
  get SUPABASE_MCP_TOKEN() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.SUPABASE_MCP_TOKEN || '';
  },
  
  // Inngest server keys (NEVER expose to browser)
  get INNGEST_EVENT_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.INNGEST_EVENT_KEY || '';
  },
  
  get INNGEST_SIGNING_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.INNGEST_SIGNING_KEY || '';
  },
  
  get INNGEST_SERVE_HOST() {
    if (isBrowser) return '';
    return process.env.INNGEST_SERVE_HOST || '';
  },
  
  get INNGEST_SERVE_PATH() {
    if (isBrowser) return '';
    return process.env.INNGEST_SERVE_PATH || '/api/inngest';
  },
  
  // OpenAI server key
  get OPENAI_API_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.OPENAI_API_KEY || '';
  },
  
  // Other server keys
  get DUB_API_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.DUB_API_KEY || '';
  },
  
  get CHROMATIC_PROJECT_TOKEN() {
    if (isBrowser) return '';
    return process.env.CHROMATIC_PROJECT_TOKEN || '';
  },
  
  // Environment detection for server
  get NODE_ENV() {
    if (isBrowser) return clientEnv.MODE;
    return process.env.NODE_ENV || 'development';
  },
  
  get IS_DEVELOPMENT() {
    if (isBrowser) return clientEnv.DEV;
    return process.env.NODE_ENV === 'development';
  }
};

/**
 * Context-aware environment access
 * Automatically chooses the right environment based on runtime context
 */
export const env = {
  // Always safe to access (public)
  ...clientEnv,
  
  // Server-only getters (throw errors in browser)
  get SUPABASE_SERVICE_ROLE_KEY() { return serverEnv.SUPABASE_SERVICE_ROLE_KEY; },
  get INNGEST_EVENT_KEY() { return serverEnv.INNGEST_EVENT_KEY; },
  get INNGEST_SIGNING_KEY() { return serverEnv.INNGEST_SIGNING_KEY; },
  
  // Environment detection
  get isServer() { return isServer; },
  get isBrowser() { return isBrowser; },
  get isDevelopment() { 
    return isBrowser ? clientEnv.DEV : serverEnv.IS_DEVELOPMENT; 
  }
};

/**
 * Validate that required environment variables are present
 */
export function validateEnvironment(context: 'client' | 'server') {
  const missing: string[] = [];
  
  if (context === 'client') {
    if (!clientEnv.SUPABASE_URL) missing.push('VITE_SUPABASE_URL');
    if (!clientEnv.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY');
  }
  
  if (context === 'server') {
    if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!serverEnv.INNGEST_EVENT_KEY) missing.push('INNGEST_EVENT_KEY');
    if (!serverEnv.INNGEST_SIGNING_KEY) missing.push('INNGEST_SIGNING_KEY');
  }
  
  if (missing.length > 0) {
    console.error(`❌ Missing required ${context} environment variables:`, missing);
    return false;
  }
  
  return true;
}

// Auto-validate on import
if (typeof window !== 'undefined') {
  // Browser context
  validateEnvironment('client');
} else {
  // Server context - only validate if we're actually in a server function
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    validateEnvironment('server');
  }
}