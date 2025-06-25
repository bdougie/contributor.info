import { Dub } from "dub";

// Environment-specific configuration
const isDev = import.meta.env.DEV;
const DOMAIN = isDev ? "dub.co" : "oss.fyi";
const API_KEY = import.meta.env.VITE_DUB_CO_KEY;

if (!API_KEY) {
  console.warn("DUB_CO_KEY not found in environment variables");
}

// Initialize Dub client
export const dub = new Dub({
  token: API_KEY,
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
  } catch (error) {
    console.error("Failed to create short URL:", error);
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
  } catch (error) {
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