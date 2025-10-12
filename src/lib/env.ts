/**
 * Secure environment variable access for client and server contexts
 *
 * CRITICAL SECURITY RULES:
 * 1. Browser context: ONLY access VITE_* prefixed variables (public)
 * 2. Browser context: NEVER read non-prefixed env vars (may contain secrets)
 * 3. Server context: Can access both VITE_* and non-prefixed variables
 * 4. Server secrets must NEVER be exposed to browser bundles
 *
 * This prevents accidental exposure of server secrets like API keys,
 * service tokens, and other sensitive configuration.
 */

// Type for import.meta.env
interface ImportMetaEnv {
  DEV?: boolean;
  PROD?: boolean;
  MODE?: string;
  [key: string]: string | boolean | undefined;
}

interface ImportMeta {
  env?: ImportMetaEnv;
}

// Detect runtime environment - check for window first to avoid Vite externalization issues
const isBrowser = typeof window !== 'undefined';
const isServer = !isBrowser;

// Safe process access - only access in server context to avoid Vite externalization
const hasProcess = isServer && typeof process !== 'undefined' && typeof process.env !== 'undefined';

/**
 * Universal environment access that works in both client and server contexts
 * In browser: Only accesses VITE_* prefixed variables (safe)
 * In server: Can access both VITE_* and server-only variables
 */
function getEnvVar(viteKey: string, serverKey?: string): string {
  // Security check: Ensure viteKey always starts with VITE_ for browser safety
  if (!viteKey.startsWith('VITE_')) {
    console.error('🚨 SECURITY WARNING: Env key "%s" must start with VITE_ prefix', viteKey);
  }
  // For tests, provide default local Supabase values
  const isTest = hasProcess && (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');

  if (isTest && (viteKey === 'VITE_SUPABASE_URL' || serverKey === 'SUPABASE_URL')) {
    return 'http://127.0.0.1:54321';
  }

  if (isTest && (viteKey === 'VITE_SUPABASE_ANON_KEY' || serverKey === 'SUPABASE_ANON_KEY')) {
    return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  }

  if (isBrowser) {
    // Browser: ONLY access VITE_* prefixed variables for security
    // NEVER read non-prefixed variables as they may contain secrets

    // 1. Try import.meta.env first (Vite's way)
    const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
    const metaValue = metaEnv[viteKey];
    if (typeof metaValue === 'string' && metaValue) {
      return metaValue;
    }

    // 2. Try window.env (for runtime injection) - VITE_* keys only
    const windowEnv = (window as Window & { env?: Record<string, string> }).env || {};
    const windowValue = windowEnv[viteKey];
    if (typeof windowValue === 'string' && windowValue) {
      return windowValue;
    }

    // 3. Try process.env as fallback (some bundlers expose this) - VITE_* keys only
    if (hasProcess) {
      const processValue = process.env[viteKey];
      if (typeof processValue === 'string' && processValue) {
        return processValue;
      }
    }

    // Do NOT check for non-prefixed variables in browser context
    // This prevents accidental exposure of server secrets

    return '';
  } else {
    // Server: Use process.env only (import.meta.env not available in CommonJS/Netlify Functions)
    if (!hasProcess) return '';

    const primaryValue = process.env[viteKey];
    if (primaryValue) return primaryValue;

    if (serverKey) {
      const secondaryValue = process.env[serverKey];
      if (secondaryValue) return secondaryValue;
    }

    return '';
  }
}

/**
 * Universal environment variables (safe for both client and server)
 */
export const env = {
  // Supabase configuration
  SUPABASE_URL: getEnvVar('VITE_SUPABASE_URL', 'SUPABASE_URL'),
  SUPABASE_ANON_KEY: getEnvVar('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'),

  // GitHub tokens
  GITHUB_TOKEN: getEnvVar('VITE_GITHUB_TOKEN', 'GITHUB_TOKEN'),

  // Inngest configuration
  INNGEST_APP_ID: getEnvVar('VITE_INNGEST_APP_ID') || 'contributor-info',
  VITE_INNGEST_EVENT_KEY: getEnvVar('VITE_INNGEST_EVENT_KEY'),

  // Other public configuration
  OPENAI_API_KEY: getEnvVar('VITE_OPENAI_API_KEY', 'OPENAI_API_KEY'),
  POSTHOG_KEY: getEnvVar('VITE_POSTHOG_KEY'),
  POSTHOG_HOST: getEnvVar('VITE_POSTHOG_HOST'),
  SENTRY_DSN: getEnvVar('VITE_SENTRY_DSN'),
  DUB_CO_KEY: getEnvVar('VITE_DUB_CO_KEY', 'DUB_API_KEY'),
  DUB_DOMAIN_DEV: getEnvVar('VITE_DUB_DOMAIN_DEV'),
  DUB_DOMAIN_PROD: getEnvVar('VITE_DUB_DOMAIN_PROD'),

  // Email configuration
  RESEND_API_KEY: getEnvVar('VITE_RESEND_API_KEY', 'RESEND_API_KEY'),

  // Hybrid rollout configuration
  HYBRID_ROLLOUT_PERCENTAGE: getEnvVar(
    'VITE_HYBRID_ROLLOUT_PERCENTAGE',
    'HYBRID_ROLLOUT_PERCENTAGE'
  ),
  HYBRID_EMERGENCY_STOP: getEnvVar('VITE_HYBRID_EMERGENCY_STOP', 'HYBRID_EMERGENCY_STOP'),
  HYBRID_ROLLOUT_STRATEGY: getEnvVar('VITE_HYBRID_ROLLOUT_STRATEGY', 'HYBRID_ROLLOUT_STRATEGY'),
  HYBRID_AUTO_ROLLBACK: getEnvVar('VITE_HYBRID_AUTO_ROLLBACK', 'HYBRID_AUTO_ROLLBACK'),
  HYBRID_MAX_ERROR_RATE: getEnvVar('VITE_HYBRID_MAX_ERROR_RATE', 'HYBRID_MAX_ERROR_RATE'),

  // Commit capture configuration (keep as strings, parse at usage)
  VITE_COMMITS_INITIAL_DAYS: getEnvVar('VITE_COMMITS_INITIAL_DAYS'),
  VITE_COMMITS_UPDATE_DAYS: getEnvVar('VITE_COMMITS_UPDATE_DAYS'),
  VITE_COMMITS_MAX_PER_RUN: getEnvVar('VITE_COMMITS_MAX_PER_RUN'),
  VITE_GITHUB_COMMITS_BATCH_SIZE: getEnvVar('VITE_GITHUB_COMMITS_BATCH_SIZE'),
  VITE_GITHUB_COMMITS_MAX_PAGES: getEnvVar('VITE_GITHUB_COMMITS_MAX_PAGES'),

  // Netlify deployment context variables
  DEPLOY_PRIME_URL: getEnvVar('VITE_DEPLOY_PRIME_URL', 'DEPLOY_PRIME_URL'),
  DEPLOY_URL: getEnvVar('VITE_DEPLOY_URL', 'DEPLOY_URL'),
  URL: getEnvVar('VITE_URL', 'URL'),
  CONTEXT: getEnvVar('VITE_CONTEXT', 'CONTEXT'),
  DEPLOY_ID: getEnvVar('VITE_DEPLOY_ID', 'DEPLOY_ID'),
  BUILD_ID: getEnvVar('VITE_BUILD_ID', 'BUILD_ID'),

  // Development mode detection
  get DEV() {
    if (isBrowser) {
      const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
      return metaEnv.DEV || false;
    }
    return hasProcess && process.env.NODE_ENV === 'development';
  },

  get PROD() {
    if (isBrowser) {
      const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
      return metaEnv.PROD || false;
    }
    return hasProcess && process.env.NODE_ENV === 'production';
  },

  get MODE() {
    if (isBrowser) {
      const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
      return metaEnv.MODE || 'development';
    }
    return hasProcess ? process.env.NODE_ENV || 'development' : 'development';
  },

  // Runtime context
  get isServer() {
    return isServer;
  },
  get isBrowser() {
    return isBrowser;
  },
};

/**
 * Legacy client-side environment variables (for backwards compatibility)
 * @deprecated Use `env` instead for universal access
 */
export const clientEnv = env;

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
    return hasProcess
      ? process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      : '';
  },

  get SUPABASE_TOKEN() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.SUPABASE_TOKEN || '' : '';
  },

  get SUPABASE_MCP_TOKEN() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.SUPABASE_MCP_TOKEN || '' : '';
  },

  // Inngest server keys (NEVER expose to browser)
  get INNGEST_EVENT_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.INNGEST_EVENT_KEY || '' : '';
  },

  get INNGEST_SIGNING_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.INNGEST_SIGNING_KEY || '' : '';
  },

  get INNGEST_SERVE_HOST() {
    if (isBrowser) return '';
    return hasProcess ? process.env.INNGEST_SERVE_HOST || '' : '';
  },

  get INNGEST_SERVE_PATH() {
    if (isBrowser) return '';
    return hasProcess ? process.env.INNGEST_SERVE_PATH || '/api/inngest' : '/api/inngest';
  },

  // OpenAI server key
  get OPENAI_API_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.OPENAI_API_KEY || '' : '';
  },

  // Other server keys
  get DUB_API_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.DUB_API_KEY || '' : '';
  },

  // Email service keys
  get RESEND_API_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return hasProcess ? process.env.RESEND_API_KEY || '' : '';
  },

  get CHROMATIC_PROJECT_TOKEN() {
    if (isBrowser) return '';
    return hasProcess ? process.env.CHROMATIC_PROJECT_TOKEN || '' : '';
  },

  // Environment detection for server
  get NODE_ENV() {
    if (isBrowser) return clientEnv.MODE;
    return hasProcess ? process.env.NODE_ENV || 'development' : 'development';
  },

  get IS_DEVELOPMENT() {
    if (isBrowser) return clientEnv.DEV;
    return hasProcess && process.env.NODE_ENV === 'development';
  },
};

// Export the universal env as the main export - no duplicate needed

/**
 * Validate that required environment variables are present
 */
export function validateEnvironment(context: 'client' | 'server') {
  const missing: string[] = [];

  if (context === 'client') {
    if (!clientEnv.SUPABASE_URL) missing.push('VITE_SUPABASE_URL or SUPABASE_URL');
    if (!clientEnv.SUPABASE_ANON_KEY) missing.push('VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  }

  if (context === 'server') {
    if (!serverEnv.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!serverEnv.INNGEST_EVENT_KEY) missing.push('INNGEST_EVENT_KEY');
    if (!serverEnv.INNGEST_SIGNING_KEY) missing.push('INNGEST_SIGNING_KEY');
  }

  if (missing.length > 0) {
    console.error('❌ Missing required %s environment variables:', missing, context);
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
  if (hasProcess && (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME)) {
    validateEnvironment('server');
  }
}
