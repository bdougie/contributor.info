// Mock environment variables for testing
export const env = {
  // Supabase configuration
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  
  // GitHub tokens
  GITHUB_TOKEN: 'test-github-token',
  
  // Inngest configuration
  INNGEST_APP_ID: 'test-contributor-info',
  
  // Other public configuration
  OPENAI_API_KEY: '',
  POSTHOG_KEY: '',
  POSTHOG_HOST: '',
  SENTRY_DSN: '',
  DUB_CO_KEY: '',
  DUB_DOMAIN_DEV: '',
  DUB_DOMAIN_PROD: '',
  
  // Email configuration
  RESEND_API_KEY: '',
  
  // Hybrid rollout configuration
  HYBRID_ROLLOUT_PERCENTAGE: '',
  HYBRID_EMERGENCY_STOP: '',
  HYBRID_ROLLOUT_STRATEGY: '',
  HYBRID_AUTO_ROLLBACK: '',
  HYBRID_MAX_ERROR_RATE: '',
  
  // Development mode detection
  DEV: true,
  PROD: false,
  MODE: 'test',

  // Runtime context
  isServer: false,
  isBrowser: true,
};

export const clientEnv = env;

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: '',
  SUPABASE_TOKEN: '',
  SUPABASE_MCP_TOKEN: '',
  INNGEST_EVENT_KEY: '',
  INNGEST_SIGNING_KEY: '',
  INNGEST_SERVE_HOST: '',
  INNGEST_SERVE_PATH: '/api/inngest',
  OPENAI_API_KEY: '',
  DUB_API_KEY: '',
  RESEND_API_KEY: '',
  CHROMATIC_PROJECT_TOKEN: '',
  NODE_ENV: 'test',
  IS_DEVELOPMENT: false
};

export function validateEnvironment(context: 'client' | 'server') {
  // Mock validation - always returns true in tests
  return true;
}