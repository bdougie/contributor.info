/**
 * Server-only environment variable access
 * This file is specifically for Netlify functions and Inngest functions
 * It avoids any import.meta references that cause bundling issues
 */

// Server environment - always use process.env
const hasProcess = typeof process !== 'undefined' && process.env;

if (!hasProcess) {
  throw new Error('env-server.ts should only be used in server contexts');
}

/**
 * Get environment variable from process.env
 */
function getEnvVar(viteKey: string, serverKey?: string): string {
  const primaryValue = process.env[viteKey];
  if (primaryValue) return primaryValue;

  if (serverKey) {
    const secondaryValue = process.env[serverKey];
    if (secondaryValue) return secondaryValue;
  }

  return '';
}

/**
 * Server environment variables
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

  // Other configuration
  OPENAI_API_KEY: getEnvVar('VITE_OPENAI_API_KEY', 'OPENAI_API_KEY'),
  RESEND_API_KEY: getEnvVar('VITE_RESEND_API_KEY', 'RESEND_API_KEY'),

  // Environment detection
  DEV: process.env.NODE_ENV === 'development',
  PROD: process.env.NODE_ENV === 'production',
  MODE: process.env.NODE_ENV || 'development',

  // Runtime context
  isServer: true,
  isBrowser: false,
};

/**
 * Server-side only environment variables
 */
export const serverEnv = {
  // Supabase admin/service keys
  SUPABASE_SERVICE_ROLE_KEY:
    process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_TOKEN: process.env.SUPABASE_TOKEN || '',
  SUPABASE_MCP_TOKEN: process.env.SUPABASE_MCP_TOKEN || '',

  // Inngest server keys
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY || '',
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY || '',
  INNGEST_SERVE_HOST: process.env.INNGEST_SERVE_HOST || '',
  INNGEST_SERVE_PATH: process.env.INNGEST_SERVE_PATH || '/api/inngest',

  // Other server keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  DUB_API_KEY: process.env.DUB_API_KEY || '',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  CHROMATIC_PROJECT_TOKEN: process.env.CHROMATIC_PROJECT_TOKEN || '',

  // Environment detection
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
};

// Alias for compatibility
export const clientEnv = env;
