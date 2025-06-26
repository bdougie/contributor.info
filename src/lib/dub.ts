import { supabase } from './supabase';

// Environment-specific configuration
const isDev = import.meta.env.DEV;
const DOMAIN = isDev ? "dub.sh" : "oss.fyi";

console.log("Environment:", isDev ? "Development" : "Production", "- Using Supabase Edge Function for URL shortening");

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
 * Uses Supabase Edge Function to call Dub API
 */
export async function createShortUrl({
  url,
  key,
  title,
  description,
  expiresAt,
  rewrite = false
}: CreateShortUrlOptions): Promise<ShortUrlResponse | null> {
  // In development, skip API call and return original URL for faster development
  if (isDev) {
    console.warn("Development mode: Skipping URL shortening, returning original URL");
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
    console.log("Creating short URL via Supabase Edge Function:", {
      url,
      domain: DOMAIN,
      key,
      title,
      description
    });
    
    // Call Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('url-shortener', {
      body: {
        url,
        domain: DOMAIN,
        key,
        title,
        description,
        expiresAt,
        rewrite,
        utmSource: "contributor-info",
        utmMedium: "chart-share",
        utmCampaign: "social-sharing"
      }
    });

    if (error) {
      console.error("Supabase function error:", error);
      return null;
    }

    if (data?.error) {
      console.error("URL shortening service error:", data.error);
      return null;
    }
    
    console.log("URL shortening success:", data.shortLink);
    return data;
    
  } catch (error: any) {
    console.error("Failed to create short URL:", error);
    return null;
  }
}

/**
 * Generate analytics URL for tracking
 */
export async function getUrlAnalytics(linkId: string) {
  if (isDev) {
    console.warn("Development mode: Skipping analytics request");
    return null;
  }

  try {
    // This could be extended to call a Supabase function for analytics
    // For now, analytics are tracked via Dub's automatic click tracking
    console.log("Analytics tracking for link:", linkId);
    return null;
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
    hasApiKey: true // Always true now since we use Supabase function
  };
}