import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const DUB_API_KEY = import.meta.env.VITE_DUB_CO_KEY;
const DUB_API_BASE = 'https://api.dub.co';

interface DubClickAnalytics {
  clicks: number;
  uniqueClicks?: number;
  country?: Record<string, number>;
  city?: Record<string, number>;
  device?: Record<string, number>;
  browser?: Record<string, number>;
  os?: Record<string, number>;
  referer?: Record<string, number>;
}

interface DubAnalyticsResponse {
  clicks: number;
  leads: number;
  sales: number;
  saleAmount: number;
  [key: string]: number | Record<string, number>;
}

/**
 * Fetch click analytics from Dub API for a specific link
 */
export async function fetchDubAnalytics(
  linkId: string,
  interval: '24h' | '7d' | '30d' | '90d' | 'all' = '7d'
): Promise<DubClickAnalytics | null> {
  if (!DUB_API_KEY) {
    logger.warn('DUB_API_KEY not configured, skipping analytics fetch');
    return null;
  }

  try {
    const response = await fetch(
      `${DUB_API_BASE}/analytics?linkId=${linkId}&interval=${interval}`,
      {
        headers: {
          Authorization: `Bearer ${DUB_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Failed to fetch Dub analytics:', {
        linkId,
        status: response.status,
        error: errorText,
      });
      return null;
    }

    const data: DubAnalyticsResponse = await response.json();

    return {
      clicks: data.clicks || 0,
      uniqueClicks: data.clicks || 0, // Dub API might provide this separately
      country: typeof data.country === 'object' ? data.country : undefined,
      city: typeof data.city === 'object' ? data.city : undefined,
      device: typeof data.device === 'object' ? data.device : undefined,
      browser: typeof data.browser === 'object' ? data.browser : undefined,
      os: typeof data.os === 'object' ? data.os : undefined,
      referer: typeof data.referer === 'object' ? data.referer : undefined,
    };
  } catch (error) {
    logger.error('Error fetching Dub analytics:', error);
    return null;
  }
}

/**
 * Sync click analytics from Dub to Supabase
 */
export async function syncClickAnalytics(
  dubLinkId: string,
  shareEventId?: string
): Promise<boolean> {
  try {
    // Fetch analytics from Dub
    const analytics = await fetchDubAnalytics(dubLinkId);

    if (!analytics) {
      logger.warn('No analytics data received from Dub', { dubLinkId });
      return false;
    }

    // Update clicks count in short_urls table
    const { error: updateError } = await supabase
      .from('short_urls')
      .update({ clicks: analytics.clicks })
      .eq('dub_id', dubLinkId);

    if (updateError) {
      logger.error('Failed to update short_urls clicks:', updateError);
      return false;
    }

    // Store detailed click analytics
    const { error: insertError } = await supabase.from('share_click_analytics').insert({
      share_event_id: shareEventId || null,
      dub_link_id: dubLinkId,
      total_clicks: analytics.clicks,
      unique_clicks: analytics.uniqueClicks ?? analytics.clicks,
      click_data: {
        country: analytics.country,
        city: analytics.city,
        device: analytics.device,
        browser: analytics.browser,
        os: analytics.os,
        referer: analytics.referer,
      },
      period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      period_end: new Date().toISOString(),
    });

    if (insertError) {
      // Check if it's a duplicate key error (which is acceptable)
      const isDuplicateError =
        insertError.code === '23505' || insertError.message?.includes('duplicate');
      if (isDuplicateError) {
        logger.debug('Analytics already exists for period:', { dubLinkId });
      } else {
        logger.error('Failed to insert click analytics:', {
          dubLinkId,
          error: insertError.message,
        });
        return false;
      }
    }

    logger.log('Click analytics synced successfully', {
      dubLinkId,
      clicks: analytics.clicks,
    });

    return true;
  } catch (error) {
    logger.error('Error syncing click analytics:', error);
    return false;
  }
}

/**
 * Sync analytics for all tracked short URLs
 */
export async function syncAllAnalytics(): Promise<{
  total: number;
  synced: number;
  failed: number;
}> {
  try {
    // Get all short URLs from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: shortUrls, error } = await supabase
      .from('short_urls')
      .select('dub_id, id')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch short URLs for analytics sync:', error);
      return { total: 0, synced: 0, failed: 0 };
    }

    if (!shortUrls || shortUrls.length === 0) {
      logger.log('No short URLs to sync analytics for');
      return { total: 0, synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    // Sync analytics for each URL (with rate limiting)
    for (const url of shortUrls) {
      const success = await syncClickAnalytics(url.dub_id);
      if (success) {
        synced++;
      } else {
        failed++;
      }

      // Rate limit: wait 100ms between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    logger.log('Bulk analytics sync complete', {
      total: shortUrls.length,
      synced,
      failed,
    });

    return {
      total: shortUrls.length,
      synced,
      failed,
    };
  } catch (error) {
    logger.error('Error in bulk analytics sync:', error);
    return { total: 0, synced: 0, failed: 0 };
  }
}

/**
 * Get analytics summary for a specific repository
 */
export async function getRepositoryAnalyticsSummary(repository: string): Promise<{
  totalShares: number;
  totalClicks: number;
  clickThroughRate: number;
  topLinks: Array<{
    shortUrl: string;
    clicks: number;
    createdAt: string;
  }>;
} | null> {
  try {
    const { data: shortUrls, error } = await supabase
      .from('short_urls')
      .select('short_url, clicks, created_at, original_url')
      .ilike('original_url', `%${repository}%`)
      .order('clicks', { ascending: false })
      .limit(10);

    if (error) {
      logger.error('Failed to fetch repository analytics:', error);
      return null;
    }

    if (!shortUrls || shortUrls.length === 0) {
      return {
        totalShares: 0,
        totalClicks: 0,
        clickThroughRate: 0,
        topLinks: [],
      };
    }

    const totalShares = shortUrls.length;
    const totalClicks = shortUrls.reduce((sum, url) => sum + (url.clicks || 0), 0);
    const clickThroughRate = totalShares > 0 ? (totalClicks / totalShares) * 100 : 0;

    return {
      totalShares,
      totalClicks,
      clickThroughRate: Math.round(clickThroughRate * 100) / 100,
      topLinks: shortUrls.slice(0, 5).map((url) => ({
        shortUrl: url.short_url,
        clicks: url.clicks || 0,
        createdAt: url.created_at,
      })),
    };
  } catch (error) {
    logger.error('Error fetching repository analytics summary:', error);
    return null;
  }
}

/**
 * Schedule automatic analytics sync (call this on app initialization)
 */
export function scheduleAnalyticsSync(intervalMinutes: number = 60): number {
  logger.log('Scheduling analytics sync', { intervalMinutes });

  return window.setInterval(
    async () => {
      logger.log('Running scheduled analytics sync');
      await syncAllAnalytics();
    },
    intervalMinutes * 60 * 1000
  );
}
