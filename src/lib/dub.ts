import { Dub } from "dub";

// Environment-specific configuration
const isDev = import.meta.env.DEV;
const DOMAIN = isDev ? "dub.sh" : "oss.fyi";
const API_KEY = import.meta.env.VITE_DUB_CO_KEY;

// Enhanced debugging for API key issues
if (!API_KEY) {
  console.warn("DUB_CO_KEY not found in environment variables");
  console.warn("Available env vars:", Object.keys(import.meta.env));
} else {
  console.log("Dub API Key loaded:", API_KEY.substring(0, 8) + "...");
  console.log("API Key format valid:", API_KEY.startsWith('dub_'));
}

console.log("Environment:", isDev ? "Development (API mocked)" : "Production (using Netlify function)");

// Custom fetcher for production (uses Netlify function)
const createHTTPClient = () => {
  return {
    request: async (request: Request): Promise<Response> => {
      // In production, route through Netlify function
      const newUrl = '/.netlify/functions/dub-proxy';
      console.log(`Dub fetch: ${request.url} → ${newUrl} (using Netlify function)`);
      
      // Remove auth header since Netlify function will add it
      const headers = new Headers(request.headers);
      headers.delete('authorization');
      
      return fetch(newUrl, {
        method: request.method,
        headers: headers,
        body: request.body,
      });
    },
    addHook: function() { return this; },
    removeHook: function() { return this; },
    clone: function() { return this; }
  };
};

// Initialize Dub client (only used in production)
export const dub = new Dub({
  token: API_KEY,
  ...(isDev ? {} : { httpClient: createHTTPClient() as any }),
});

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

  // In development, skip API call and return original URL due to CORS/proxy issues
  if (isDev) {
    console.warn("Development mode: Skipping dub.co API call, returning original URL");
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

  try {
    console.log("Creating short URL with Dub.co:", {
      url,
      domain: DOMAIN,
      key,
      hasApiKey: !!API_KEY,
      apiKeyPrefix: API_KEY?.substring(0, 8)
    });
    
    // Use upsert to prevent duplicate key errors (following your working pattern)
    const result = await dub.links.upsert({
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

  if (isDev) {
    console.warn("Development mode: Skipping analytics request");
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
 * Generate a custom key from URL (following your working pattern)
 */
function getCustomKey(url: string): string | undefined {
  try {
    const urlPath = new URL(url).pathname;
    
    // ex: /owner/repo (repository pages)
    const repoMatch = urlPath.match(/^\/([^\/]+)\/([^\/]+)(?:\/.*)?$/);
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
      urlObj.host.endsWith("contributor.info") ||
      urlObj.host.includes("localhost") ||
      urlObj.host.endsWith("netlify.app") // Allow Netlify preview deployments
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
  // If no API key, return original URL
  if (!API_KEY) {
    return fullUrl;
  }
  
  // Validate URL for security
  if (!validateUrl(fullUrl)) {
    console.warn("Invalid URL for shortening:", fullUrl);
    return fullUrl;
  }

  // Generate custom key based on URL pattern
  const customKey = getCustomKey(fullUrl);
  
  const shortUrl = await createShortUrl({
    url: fullUrl,
    key: customKey,
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