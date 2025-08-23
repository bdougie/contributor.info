/**
 * Configuration for API endpoints
 * Centralizes all environment variables and configuration values
 */

export interface ApiConfig {
  supabase: {
    url: string;
    serviceKey: string;
  };
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
    allowCredentials: boolean;
  };
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  pagination: {
    defaultLimit: number;
    maxLimit: number;
  };
}

// Helper to safely get environment variables
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    console.error(`Missing required environment variable: ${name}`);
    throw new Error(`Configuration error: ${name} is required`);
  }
  return value || defaultValue || '';
}

// Helper to parse allowed origins
function parseAllowedOrigins(): string[] {
  const origins = getEnvVar('ALLOWED_ORIGINS', '');
  if (!origins) {
    // Default to restrictive CORS in production
    if (process.env.NODE_ENV === 'production') {
      return ['https://contributor.info'];
    }
    // Allow localhost in development
    return [
      'http://localhost:3000',
      'http://localhost:8888',
      'https://contributor.info'
    ];
  }
  return origins.split(',').map(origin => origin.trim());
}

export function getApiConfig(): ApiConfig {
  return {
    supabase: {
      url: getEnvVar('VITE_SUPABASE_URL'),
      serviceKey: getEnvVar('SUPABASE_SERVICE_KEY')
    },
    cors: {
      allowedOrigins: parseAllowedOrigins(),
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      allowCredentials: true
    },
    rateLimit: {
      enabled: getEnvVar('RATE_LIMIT_ENABLED', 'true') === 'true',
      maxRequests: parseInt(getEnvVar('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
      windowMs: parseInt(getEnvVar('RATE_LIMIT_WINDOW_MS', '60000'), 10)
    },
    pagination: {
      defaultLimit: parseInt(getEnvVar('PAGINATION_DEFAULT_LIMIT', '10'), 10),
      maxLimit: parseInt(getEnvVar('PAGINATION_MAX_LIMIT', '100'), 10)
    }
  };
}

// Validate configuration at startup
export function validateConfig(config: ApiConfig): void {
  // Validate Supabase configuration
  if (!config.supabase.url || !config.supabase.url.startsWith('http')) {
    throw new Error('Invalid VITE_SUPABASE_URL');
  }
  
  if (!config.supabase.serviceKey || config.supabase.serviceKey.length < 32) {
    throw new Error('Invalid SUPABASE_SERVICE_KEY');
  }
  
  // Validate rate limit configuration
  if (config.rateLimit.maxRequests < 1 || config.rateLimit.maxRequests > 10000) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be between 1 and 10000');
  }
  
  if (config.rateLimit.windowMs < 1000 || config.rateLimit.windowMs > 3600000) {
    throw new Error('RATE_LIMIT_WINDOW_MS must be between 1000 and 3600000');
  }
  
  // Validate pagination configuration
  if (config.pagination.defaultLimit < 1 || config.pagination.defaultLimit > config.pagination.maxLimit) {
    throw new Error('Invalid pagination limits');
  }
}