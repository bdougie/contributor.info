import { createClient } from '@supabase/supabase-js';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export class RateLimiter {
  private supabase: any;
  private config: RateLimitConfig;

  constructor(supabaseUrl: string, supabaseKey: string, config: RateLimitConfig) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      maxRequests: config.maxRequests || 100,
      windowMs: config.windowMs || 60000, // 1 minute default
      keyPrefix: config.keyPrefix || 'rate_limit'
    };
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    try {
      // Get current request count from database
      const { data: rateLimitData, error: fetchError } = await this.supabase
        .from('rate_limits')
        .select('request_count, window_start, last_request')
        .eq('key', key)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // Error other than "not found"
        console.error('Rate limit check error:', fetchError);
        // Allow request on error to avoid blocking legitimate traffic
        return {
          allowed: true,
          remaining: this.config.maxRequests,
          resetTime: now + this.config.windowMs
        };
      }

      let requestCount = 0;
      let currentWindowStart = now;

      if (rateLimitData) {
        // Check if we're in the same window
        const dataWindowStart = new Date(rateLimitData.window_start).getTime();
        
        if (dataWindowStart > windowStart) {
          // Same window, increment counter
          requestCount = rateLimitData.request_count;
          currentWindowStart = dataWindowStart;
        } else {
          // New window, reset counter
          currentWindowStart = now;
        }
      }

      // Check if limit exceeded
      if (requestCount >= this.config.maxRequests) {
        const resetTime = currentWindowStart + this.config.windowMs;
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          retryAfter: Math.ceil((resetTime - now) / 1000)
        };
      }

      // Increment counter
      requestCount++;
      
      // Upsert rate limit record
      const { error: upsertError } = await this.supabase
        .from('rate_limits')
        .upsert({
          key,
          request_count: requestCount,
          window_start: new Date(currentWindowStart).toISOString(),
          last_request: new Date(now).toISOString()
        }, {
          onConflict: 'key'
        });

      if (upsertError) {
        console.error('Rate limit update error:', upsertError);
      }

      return {
        allowed: true,
        remaining: this.config.maxRequests - requestCount,
        resetTime: currentWindowStart + this.config.windowMs
      };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Allow request on error
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }
  }

  async reset(identifier: string): Promise<void> {
    const key = `${this.config.keyPrefix}:${identifier}`;
    
    try {
      await this.supabase
        .from('rate_limits')
        .delete()
        .eq('key', key);
    } catch (error) {
      console.error('Rate limit reset error:', error);
    }
  }
}

// Helper function to extract rate limit key from request
export function getRateLimitKey(req: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }
  
  // Fallback to IP-based rate limiting
  const forwardedFor = req.headers.get('x-forwarded-for');
  const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
  return `ip:${ip}`;
}

// Helper function to apply rate limit headers to response
export function applyRateLimitHeaders(
  response: Response, 
  rateLimitResult: RateLimitResult
): Response {
  const headers = new Headers(response.headers);
  
  headers.set('X-RateLimit-Limit', String(rateLimitResult.remaining + (rateLimitResult.allowed ? 1 : 0)));
  headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
  headers.set('X-RateLimit-Reset', String(Math.floor(rateLimitResult.resetTime / 1000)));
  
  if (!rateLimitResult.allowed && rateLimitResult.retryAfter) {
    headers.set('Retry-After', String(rateLimitResult.retryAfter));
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}