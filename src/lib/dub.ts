import { supabase } from './supabase';

// Environment-specific configuration
const isDev = import.meta.env.DEV;
const DOMAIN = isDev ? 'dub.sh' : 'oss.fyi';
const DUB_API_KEY = import.meta.env.VITE_DUB_CO_KEY;

console.log('Environment:', isDev ? 'Development' : 'Production', '- Using Dub API directly');

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
    console.warn('Development mode: Skipping URL shortening, returning original URL');
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

  // Check if API key is available
  if (!DUB_API_KEY) {
    console.warn('DUB_API_KEY not configured, returning original URL');
    return {
      id: 'no-api-key',
      domain: 'original',
      key: key || 'original',
      url: url,
      shortLink: url,
      qrCode: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clicks: 0,
      title: title || null,
      description: description || null,
    };
  }

  try {
    console.log('Creating short URL via Dub API:', {
      url,
      domain: DOMAIN,
      key,
      title,
      description,
    });

    // Call Dub API directly
    const response = await fetch('https://api.dub.co/links', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${DUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        domain: DOMAIN,
        key,
        title,
        description,
        expiresAt,
        rewrite,
        utmSource: 'contributor-info',
        utmMedium: 'chart-share',
        utmCampaign: 'social-sharing',
      }),
    });

    if (!response.ok) {
      const _ = await response.text();
      console.error('Dub API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      return null;
    }

    const _ = await response.json();
    console.log('URL shortening success:', _data.shortLink);

    // Track the short URL creation in Supabase for analytics
    await trackShortUrlCreation(_data);

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
  } catch (_error: unknown) {
    console.error('Failed to create short URL:', _error);
    return null;
  }
}

/**
 * Track short URL creation in Supabase for analytics
 */
async function trackShortUrlCreation(dubData: unknown) {
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

    if (_error) {
      console.error('Failed to track short URL creation:', _error);
    } else {
      console.log('Short URL tracked in Supabase analytics');
    }
  } catch () {
    console.error('Error tracking short URL creation:', _error);
  }
}

/**
 * Generate analytics URL for tracking
 */
export async function getUrlAnalytics(linkId: string) {
  if (isDev) {
    console.warn('Development mode: Skipping analytics request');
    return null;
  }

  try {
    // Query Supabase for our internal analytics
    const { data, error } = await supabase
      .from('short_urls')
      .select('*')
      .eq('dub_id', linkId)
      .maybeSingle();

    if (_error) {
      console.error('Failed to get URL analytics:', _error);
      return null;
    }

    return data;
  } catch (_error: unknown) {
    console.error('Failed to get URL analytics:', _error);
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
  repository?: string,
): Promise<string> {
  // Validate URL for security
  if (!validateUrl(fullUrl)) {
    console.warn('Invalid URL for shortening:', fullUrl);
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
 * Track a click event for analytics
 */
export async function trackClick(shortUrl: string, meta_data?: Record<string, unknown>) {
  // This will be automatically tracked by dub.co when the link is clicked
  // Additional custom tracking can be added here if needed
  console.log('Click tracked for:', shortUrl, meta_data);
}

/**
 * Get current environment info
 */
export function getDubConfig() {
  return {
    domain: DOMAIN,
    isDev,
    hasApiKey: !!DUB_API_KEY,
  };
}
