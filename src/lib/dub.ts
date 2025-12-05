import { supabase } from './supabase';
import { logger } from './logger';

// Environment-specific configuration
const isDev = import.meta.env.DEV;

// Retry and timeout configuration
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds

logger.debug('Environment:', isDev ? 'Development' : 'Production', '- Using Dub API directly');

interface CreateShortUrlOptions {
  url: string;
  key?: string;
  title?: string;
  description?: string;
  expiresAt?: string;
  rewrite?: boolean;
}

interface ShortUrlResponse {
  id: string;
  domain: string;
  key: string;
  url: string;
  shortLink: string;
  qrCode: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  userId?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  clicks: number;
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on certain errors
      if (error instanceof Error) {
        // Don't retry on 4xx errors (except 429 rate limit)
        if (error.message.includes('status: 4') && !error.message.includes('status: 429')) {
          throw error;
        }
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: lastError.message,
        });
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Create a short URL for chart/metric sharing
 * Uses Dub API directly from client
 */
export async function createShortUrl({
  url,
  key,
  title,
  description,
  expiresAt,
  rewrite = false,
}: CreateShortUrlOptions): Promise<ShortUrlResponse | null> {
  // In development, skip API call and return original URL for faster development
  if (isDev) {
    logger.warn('Development mode: Skipping URL shortening, returning original URL');
    return {
      id: 'dev-mock',
      domain: 'localhost',
      key: key || 'dev-key',
      url: url,
      shortLink: url, // Return original URL in development
      qrCode: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clicks: 0,
      title: title || null,
      description: description || null,
    };
  }

  // API key is now handled securely in the Netlify function
  // No need to check it on the client side

  try {
    logger.log('Creating short URL via Netlify function:', {
      url,
      key,
      title,
      description,
    });

    // Call our Netlify serverless function (bypasses CORS, keeps API key secure)
    const data = await retryWithBackoff(async () => {
      const response = await fetchWithTimeout(
        '/api/create-short-url',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            key,
            title,
            description,
            expiresAt,
            rewrite,
          }),
        },
        REQUEST_TIMEOUT
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);

        // If API key not configured, gracefully fall back to original URL
        if (errorData?.fallback) {
          logger.warn('Dub.co API key not configured, returning original URL');
          return null;
        }

        const error = new Error(`Short URL API error: status: ${response.status}`);
        logger.error('Short URL API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          url,
        });
        throw error;
      }

      return response.json();
    });

    // If API returned null (fallback mode), return original URL
    if (!data) {
      logger.warn('Falling back to original URL (API key not configured)');
      return null;
    }

    logger.log('URL shortening success:', data.shortLink);

    // Track the short URL creation in Supabase for analytics
    await trackShortUrlCreation(data);

    return {
      id: data.id,
      domain: data.domain,
      key: data.key,
      url: data.url,
      shortLink: data.shortLink,
      qrCode: data.qrCode || '',
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      utmTerm: data.utmTerm,
      utmContent: data.utmContent,
      userId: data.userId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      expiresAt: data.expiresAt,
      clicks: data.clicks || 0,
      title: data.title,
      description: data.description,
      image: data.image,
    };
  } catch (error) {
    logger.error('Failed to create short URL after retries:', {
      error: error instanceof Error ? error.message : String(error),
      url,
    });
    return null;
  }
}

/**
 * Track short URL creation in Supabase for analytics
 */
async function trackShortUrlCreation(dubData: ShortUrlResponse) {
  try {
    // Store the short URL data in Supabase for our internal analytics
    const { error } = await supabase.from('short_urls').insert({
      dub_id: dubData.id,
      short_url: dubData.shortLink,
      original_url: dubData.url,
      domain: dubData.domain,
      key: dubData.key,
      title: dubData.title,
      description: dubData.description,
      utm_source: dubData.utmSource,
      utm_medium: dubData.utmMedium,
      utm_campaign: dubData.utmCampaign,
      created_at: dubData.createdAt,
    });

    if (error) {
      logger.error('Failed to track short URL creation:', error);
    } else {
      logger.log('Short URL tracked in Supabase analytics');
    }
  } catch (error) {
    logger.error('Error tracking short URL creation:', error);
  }
}

/**
 * Generate analytics URL for tracking
 */
export async function getUrlAnalytics(linkId: string) {
  if (isDev) {
    logger.warn('Development mode: Skipping analytics request');
    return null;
  }

  try {
    // Query Supabase for our internal analytics
    const { data, error } = await supabase
      .from('short_urls')
      .select('*')
      .eq('dub_id', linkId)
      .maybeSingle();

    if (error) {
      logger.error('Failed to get URL analytics:', error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error('Failed to get URL analytics:', error);
    return null;
  }
}

/**
 * Generate a custom key from URL (following your working pattern)
 */
function getCustomKey(url: string): string | undefined {
  try {
    const urlPath = new URL(url).pathname;

    // ex: /owner/repo (repository pages)
    const repoMatch = urlPath.match(/^\/([^/]+)\/([^/]+)(?:\/.*)?$/);
    if (repoMatch) {
      return `${repoMatch[1]}/${repoMatch[2]}`;
    }

    // ex: /u/username or /user/username
    const userMatch = urlPath.match(/^\/(u|user)\/(.+)$/);
    if (userMatch) {
      return userMatch[2];
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Validate URL for security (following your working pattern)
 */
function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);

    // Allow contributor.info domains and localhost for development
    return (
      urlObj.host.endsWith('contributor.info') ||
      urlObj.host.includes('localhost') ||
      urlObj.host.endsWith('netlify.app') // Allow Netlify preview deployments
    );
  } catch {
    return false;
  }
}

/**
 * Generate a short URL for a chart/metric page
 */
export async function createChartShareUrl(
  fullUrl: string,
  chartType: string,
  repository?: string
): Promise<string> {
  // Validate URL for security
  if (!validateUrl(fullUrl)) {
    logger.warn('Invalid URL for shortening:', fullUrl);
    return fullUrl;
  }

  // Generate custom key based on URL pattern
  const customKey = getCustomKey(fullUrl);

  const shortUrl = await createShortUrl({
    url: fullUrl,
    key: customKey,
    title: repository ? `${chartType} for ${repository}` : `${chartType} Chart`,
    description: repository
      ? `Interactive ${chartType} chart showing metrics for ${repository} repository`
      : `Interactive ${chartType} chart from contributor.info`,
  });

  return shortUrl?.shortLink || fullUrl;
}

/**
 * Get current environment info
 */
export function getDubConfig() {
  return {
    isDev,
    usesServerlessFunction: true, // Now using Netlify function for security
  };
}
