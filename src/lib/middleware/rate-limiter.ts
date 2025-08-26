/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API endpoints
 */

// Rate limit storage can be extended to use external storage like Redis or Supabase
// For now, using in-memory storage for simplicity

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
  message?: string;      // Custom error message
}

/**
 * In-memory store for rate limit data
 */
class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetTime < now) {
      // Create new entry
      const resetTime = now + windowMs;
      const newEntry = { count: 1, resetTime };
      this.store.set(key, newEntry);
      return newEntry;
    } else {
      // Increment existing entry
      entry.count++;
      return entry;
    }
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (entry && entry.resetTime < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime < now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

/**
 * Default key generator - uses IP address or user ID
 */
function defaultKeyGenerator(req: Request): string {
  // Try to get IP from various headers
  const headers = req.headers;
  const ip = headers.get('x-forwarded-for')?.split(',')[0] ||
             headers.get('x-real-ip') ||
             headers.get('cf-connecting-ip') ||
             'unknown';
  
  // Include path in key to have per-endpoint limits
  const url = new URL(req.url);
  const path = url.pathname;
  
  return `${ip}:${path}`;
}

/**
 * Rate limiter middleware factory
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    message = 'Too many requests, please try again later'
  } = config;

  return async function rateLimiter(
    req: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    const key = keyGenerator(req);
    
    // Check current rate limit
    const current = store.get(key) || { count: 0, resetTime: Date.now() + windowMs };
    
    if (current.count >= maxRequests) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((current.resetTime - Date.now()) / 1000);
      
      return new Response(JSON.stringify({ 
        error: message,
        retryAfter 
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(current.resetTime).toISOString(),
          'Retry-After': retryAfter.toString()
        }
      });
    }

    // Increment counter before processing request
    const updated = store.increment(key, windowMs);
    
    try {
      // Process request
      const response = await next();
      
      // Optionally don't count successful requests
      if (skipSuccessfulRequests && response.status < 400) {
        store.reset(key);
      }
      
      // Add rate limit headers to response
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-RateLimit-Limit', maxRequests.toString());
      newHeaders.set('X-RateLimit-Remaining', Math.max(0, maxRequests - updated.count).toString());
      newHeaders.set('X-RateLimit-Reset', new Date(updated.resetTime).toISOString());
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    } catch (_error) {
      // Optionally don't count failed requests
      if (skipFailedRequests) {
        store.reset(key);
      }
      throw error;
    }
  };
}

/**
 * Preset rate limiters for different operations
 */
export const rateLimiters = {
  // Standard API rate limit: 100 requests per minute
  standard: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100
  }),
  
  // Strict rate limit for expensive operations: 10 requests per minute
  strict: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Rate limit exceeded for this operation'
  }),
  
  // Auth rate limit: 5 attempts per 15 minutes
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many authentication attempts'
  }),
  
  // Creation rate limit: 20 creates per hour
  create: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 20,
    message: 'Creation rate limit exceeded'
  })
};

/**
 * Apply rate limiter to a request handler
 */
export function withRateLimit(
  handler: (req: Request, context: unknown) => Promise<Response>,
  config: RateLimitConfig
) {
  const limiter = createRateLimiter(config);
  
  return async (req: Request, context: unknown): Promise<Response> => {
    return limiter(req, () => handler(req, context));
  };
}

/**
 * User-specific rate limiter using auth token
 */
export function createUserRateLimiter(config: RateLimitConfig) {
  return createRateLimiter({
    ...config,
    keyGenerator: (req: Request) => {
      const authHeader = req.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        // Use user token as key for authenticated requests
        const token = authHeader.replace('Bearer ', '');
        const url = new URL(req.url);
        return `user:${token}:${url.pathname}`;
      }
      // Fall back to IP for unauthenticated requests
      return defaultKeyGenerator(req);
    }
  });
}

// Cleanup on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => store.destroy());
  process.on('SIGINT', () => {
    store.destroy();
    process.exit(0);
  });
}