import { Dub } from "dub";

// Environment-specific configuration
const isDev = import.meta.env.DEV;
const DOMAIN = isDev ? "dub.sh" : "oss.fyi";
const API_KEY = import.meta.env.VITE_DUB_CO_KEY;

// Use proxy in development to avoid CORS issues
const API_BASE_URL = isDev ? "/api/dub" : "https://api.dub.co";

// Enhanced debugging for API key issues
if (!API_KEY) {
  console.warn("DUB_CO_KEY not found in environment variables");
  console.warn("Available env vars:", Object.keys(import.meta.env));
} else {
  console.log("Dub API Key loaded:", API_KEY.substring(0, 8) + "...");
  console.log("API Key format valid:", API_KEY.startsWith('dub_'));
}

console.log("Dub API Base URL:", API_BASE_URL);
console.log("Environment:", isDev ? "Development (using proxy)" : "Production");

// Custom fetcher that rewrites URLs for proxy
const customFetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let url: string;
  let finalInput: RequestInfo | URL = input;
  
  // Extract URL from various input types
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.toString();
  } else if (input instanceof Request) {
    url = input.url;
  } else {
    url = String(input);
  }
  
  const originalUrl = url;
  
  // In development, replace the base URL to use our proxy
  if (isDev && url.startsWith('https://api.dub.co')) {
    const newUrl = url.replace('https://api.dub.co', '/api/dub');
    console.log(`Dub fetch: ${originalUrl} → ${newUrl} (using proxy)`);
    
    // Create appropriate input based on original type
    if (input instanceof Request) {
      // Clone the request with new URL
      const cloneOptions: RequestInit = {
        method: input.method,
        headers: input.headers,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        referrerPolicy: input.referrerPolicy,
        integrity: input.integrity,
        signal: input.signal,
      };
      
      // Handle body and duplex for streaming requests
      if (input.body) {
        cloneOptions.body = input.body;
        // Add duplex for streaming bodies
        if (input.body instanceof ReadableStream) {
          (cloneOptions as any).duplex = 'half';
        }
      }
      
      finalInput = new Request(newUrl, cloneOptions);
    } else {
      finalInput = newUrl;
    }
  } else {
    console.log(`Dub fetch: ${originalUrl} (direct)`);
  }
  
  return fetch(finalInput, init);
};

// Create a minimal HTTPClient implementation that matches the SDK's expectations
const createHTTPClient = () => {
  return {
    request: async (request: Request): Promise<Response> => {
      return customFetcher(request);
    },
    addHook: function() { return this; },
    removeHook: function() { return this; },
    clone: function() { return this; }
  };
};

// Initialize Dub client
export const dub = new Dub({
  token: API_KEY,
  httpClient: createHTTPClient() as any,
});

interface CreateShortUrlOptions {
  url: string;
  key?: string;
  title?: string;
  description?: string;
  // tags?: string[]; // Not supported in current dub API
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
  // tags?: string[]; // Not supported in current dub API
  title?: string | null;
  description?: string | null;
  image?: string | null;
}

/**
 * Create a short URL for chart/metric sharing
 * Uses dub.co for dev, oss.fyi for production
 */
export async function createShortUrl({
  url,
  key,
  title,
  description,
  expiresAt,
  rewrite = false
}: CreateShortUrlOptions): Promise<ShortUrlResponse | null> {
  if (!API_KEY) {
    console.error("Dub.co API key not configured");
    return null;
  }

  try {
    console.log("Creating short URL with Dub.co:", {
      url,
      domain: DOMAIN,
      key,
      hasApiKey: !!API_KEY,
      apiKeyPrefix: API_KEY?.substring(0, 8)
    });
    
    const result = await dub.links.create({
      url,
      domain: DOMAIN,
      key,
      title,
      description,
      expiresAt,
      rewrite,
      // Add UTM parameters for tracking
      utmSource: "contributor-info",
      utmMedium: "chart-share",
      utmCampaign: "social-sharing"
    });
    
    console.log("Dub.co API success:", result.shortLink);

    // Map the response to our interface
    return {
      id: result.id,
      domain: result.domain,
      key: result.key,
      url: result.url,
      shortLink: result.shortLink,
      qrCode: result.qrCode,
      utmSource: result.utmSource,
      utmMedium: result.utmMedium,
      utmCampaign: result.utmCampaign,
      utmTerm: result.utmTerm,
      utmContent: result.utmContent,
      userId: result.userId,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      expiresAt: result.expiresAt,
      clicks: result.clicks || 0,
      title: result.title,
      description: result.description,
      image: result.image
    };
  } catch (error: any) {
    console.error("Failed to create short URL - Full error:", error);
    console.error("Error type:", typeof error);
    console.error("Error message:", error?.message);
    console.error("Error status:", error?.status);
    console.error("Error response:", error?.response?.data || error?.response);
    
    // Check for specific authorization errors
    if (error?.message?.includes('Missing Authorization header') || 
        error?.message?.includes('Authorization') ||
        error?.status === 401) {
      console.error("Authorization error detected. API Key status:", {
        hasKey: !!API_KEY,
        keyLength: API_KEY?.length,
        keyPrefix: API_KEY?.substring(0, 8),
        keyFormat: API_KEY?.startsWith('dub_')
      });
    }
    
    return null;
  }
}

/**
 * Generate analytics URL for tracking
 */
export async function getUrlAnalytics(linkId: string) {
  if (!API_KEY) {
    console.error("Dub.co API key not configured");
    return null;
  }

  try {
    const analytics = await dub.analytics.retrieve({
      linkId,
      interval: "24h"
    });
    return analytics;
  } catch (error: any) {
    console.error("Failed to get URL analytics:", error);
    return null;
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
  // If no API key, return original URL
  if (!API_KEY) {
    return fullUrl;
  }

  // Generate a meaningful key based on the content
  
  // Create a descriptive key: repo-owner-charttype-timestamp
  const timestamp = Date.now().toString(36); // Base36 for shorter strings
  const repoKey = repository ? repository.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase() : '';
  const chartKey = chartType.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  
  const key = repoKey 
    ? `${repoKey}-${chartKey}-${timestamp}`
    : `${chartKey}-${timestamp}`;

  const shortUrl = await createShortUrl({
    url: fullUrl,
    key: key.substring(0, 50), // Limit key length
    title: repository 
      ? `${chartType} for ${repository}`
      : `${chartType} Chart`,
    description: repository
      ? `Interactive ${chartType} chart showing metrics for ${repository} repository`
      : `Interactive ${chartType} chart from contributor.info`
  });

  return shortUrl?.shortLink || fullUrl;
}

/**
 * Track a click event for analytics
 */
export async function trackClick(shortUrl: string, metadata?: Record<string, any>) {
  // This will be automatically tracked by dub.co when the link is clicked
  // Additional custom tracking can be added here if needed
  console.log("Click tracked for:", shortUrl, metadata);
}

/**
 * Get current environment info
 */
export function getDubConfig() {
  return {
    domain: DOMAIN,
    isDev,
    hasApiKey: !!API_KEY
  };
}