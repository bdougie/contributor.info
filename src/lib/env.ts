/**
 * Secure environment variable access for client and server contexts
 * 
 * SECURITY RULES:
 * 1. Client code can only access VITE_* prefixed variables (public)
 * 2. Server code accesses both VITE_* and server-only variables
 * 3. Server secrets are never exposed to browser bundles
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

// Detect runtime environment
const isServer = typeof window === 'undefined';
const isBrowser = typeof window !== 'undefined';

/**
 * Universal environment access that works in both client and server contexts
 * In browser: Only accesses VITE_* prefixed variables (safe)
 * In server: Can access both VITE_* and server-only variables
 */
function getEnvVar(viteKey: string, serverKey?: string): string {
  if (isBrowser) {
    // Browser: Only access VITE_* prefixed variables via import.meta.env
    // Use optional chaining and fallback for production compatibility
    const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
    const value = metaEnv[viteKey];
    return typeof value === 'string' ? value : '';
  } else {
    // Server: Use process.env only (import.meta.env not available in CommonJS/Netlify Functions)
    return process.env[viteKey] || (serverKey ? process.env[serverKey] : '') || '';
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
  HYBRID_ROLLOUT_PERCENTAGE: getEnvVar('VITE_HYBRID_ROLLOUT_PERCENTAGE', 'HYBRID_ROLLOUT_PERCENTAGE'),
  HYBRID_EMERGENCY_STOP: getEnvVar('VITE_HYBRID_EMERGENCY_STOP', 'HYBRID_EMERGENCY_STOP'),
  HYBRID_ROLLOUT_STRATEGY: getEnvVar('VITE_HYBRID_ROLLOUT_STRATEGY', 'HYBRID_ROLLOUT_STRATEGY'),
  HYBRID_AUTO_ROLLBACK: getEnvVar('VITE_HYBRID_AUTO_ROLLBACK', 'HYBRID_AUTO_ROLLBACK'),
  HYBRID_MAX_ERROR_RATE: getEnvVar('VITE_HYBRID_MAX_ERROR_RATE', 'HYBRID_MAX_ERROR_RATE'),
  
  // Development mode detection
  get DEV() {
    if (isBrowser) {
      const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
      return metaEnv.DEV || false;
    }
    return process.env.NODE_ENV === 'development';
  },
  
  get PROD() {
    if (isBrowser) {
      const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
      return metaEnv.PROD || false;
    }
    return process.env.NODE_ENV === 'production';
  },
  
  get MODE() {
    if (isBrowser) {
      const metaEnv = (typeof import.meta !== 'undefined' && (import.meta as ImportMeta).env) || {};
      return metaEnv.MODE || 'development';
    }
    return process.env.NODE_ENV || 'development';
  },

  // Runtime context
  get isServer() { return isServer; },
  get isBrowser() { return isBrowser; },
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
  
  // Email service keys
  get RESEND_API_KEY() {
    if (isBrowser) {
      console.error('🚨 SECURITY: Attempted to access server key from browser!');
      return '';
    }
    return process.env.RESEND_API_KEY || '';
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

// Export the universal env as the main export - no duplicate needed

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