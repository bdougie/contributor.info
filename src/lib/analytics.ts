import { supabase } from "./supabase";

export interface ShareEvent {
  user_id?: string;
  session_id?: string;
  original_url: string;
  short_url?: string;
  dub_link_id?: string;
  chart_type: string;
  repository?: string;
  page_path: string;
  action: 'create' | 'share' | 'copy' | 'download';
  share_type: 'url' | 'image' | 'native';
  platform?: string;
  domain?: string;
  user_agent?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Track a sharing event in Supabase
 */
export async function trackShareEvent(event: ShareEvent): Promise<void> {
  try {
    // Get current session info
    const sessionId = getSessionId();
    const userAgent = navigator.userAgent;
    const referrer = document.referrer;

    const { error: _error } = await supabase
      .from('share_events')
      .insert([{
        ...event,
        session_id: event.session_id || sessionId,
        user_agent: event.user_agent || userAgent,
        referrer: event.referrer || referrer,
        page_path: event.page_path || window.location.pathname
      }]);

    if (_error) {
      console.error('Failed to track share event:', _error);
    }
  } catch (err) {
    console.error('Error tracking share event:', err);
  }
}

/**
 * Get or create a session ID for anonymous tracking
 */
function getSessionId(): string {
  const storageKey = 'contributor-info-session-id';
  let sessionId = sessionStorage.getItem(storageKey);
  
  if (!sessionId) {
    const randomBytes = new Uint8Array(16);
    window.crypto.getRandomValues(randomBytes);
    const randomString = Array.from(randomBytes, byte => byte.toString(36)).join('').substr(0, 9);
    sessionId = `session_${Date.now()}_${randomString}`;
    sessionStorage.setItem(storageKey, sessionId);
  }
  
  return sessionId;
}

/**
 * Get share analytics for a repository
 */
export async function getRepositoryShareAnalytics(repository: string) {
  try {
    const { data, error: _error } = await supabase
      .from('share_analytics_summary')
      .select('*')
      .eq('repository', repository)
      .order('created_at', { ascending: false });

    if (_error) {
      console.error('Failed to get repository share analytics:', _error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error getting repository share analytics:', err);
    return [];
  }
}

/**
 * Get aggregated share metrics
 */
export async function getShareMetrics(filters: {
  repository?: string;
  chartType?: string;
  dateRange?: { start: Date; end: Date };
}) {
  try {
    let query = supabase
      .from('share_events')
      .select('action, share_type, chart_type, created_at');

    if (filters.repository) {
      query = query.eq('repository', filters.repository);
    }

    if (filters.chartType) {
      query = query.eq('chart_type', filters.chartType);
    }

    if (filters.dateRange) {
      query = query
        .gte('created_at', filters.dateRange.start.toISOString())
        .lte('created_at', filters.dateRange.end.toISOString());
    }

    const { data, error: _error } = await query;

    if (_error) {
      console.error('Failed to get share metrics:', _error);
      return null;
    }

    // Aggregate the data
    const metrics = {
      totalShares: data?.length || 0,
      sharesByAction: {} as Record<string, number>,
      sharesByType: {} as Record<string, number>,
      sharesByChart: {} as Record<string, number>,
      dailyShares: {} as Record<string, number>
    };

    data?.forEach(event => {
      // Count by action
      metrics.sharesByAction[event.action] = (metrics.sharesByAction[event.action] || 0) + 1;
      
      // Count by share type
      metrics.sharesByType[event.share_type] = (metrics.sharesByType[event.share_type] || 0) + 1;
      
      // Count by chart type
      metrics.sharesByChart[event.chart_type] = (metrics.sharesByChart[event.chart_type] || 0) + 1;
      
      // Count by day
      const day = new Date(event.created_at).toISOString().split('T')[0];
      metrics.dailyShares[day] = (metrics.dailyShares[day] || 0) + 1;
    });

    return metrics;
  } catch (err) {
    console.error('Error getting share metrics:', err);
    return null;
  }
}

/**
 * Update click analytics from dub.co API
 */
export async function updateClickAnalytics(dubLinkId: string): Promise<void> {
  try {
    // Since getUrlAnalytics now returns null, we'll skip the complex analytics processing
    // Click analytics are tracked automatically by Dub when users click links
    console.log('Click analytics are tracked automatically by Dub for link:', dubLinkId);
    
    // Future enhancement: Could call a Supabase function to fetch analytics from Dub API
    // For now, we rely on Dub's built-in analytics dashboard
    
  } catch (err) {
    console.error('Error updating click analytics:', err);
  }
}

/**
 * Get top shared repositories
 */
export async function getTopSharedRepositories(limit: number = 10) {
  try {
    const { data, error: _error } = await supabase
      .from('share_events')
      .select('repository')
      .not('repository', 'is', null);

    if (_error) {
      console.error('Failed to get top shared repositories:', _error);
      return [];
    }

    // Count shares by repository
    const counts: Record<string, number> = {};
    data?.forEach(event => {
      if (event.repository) {
        counts[event.repository] = (counts[event.repository] || 0) + 1;
      }
    });

    // Sort by count and return top N
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([repository, count]) => ({ repository, count }));
  } catch (err) {
    console.error('Error getting top shared repositories:', err);
    return [];
  }
}

/**
 * Calculate share rate for a repository
 */
export async function getShareRate(repository: string, viewsCount?: number): Promise<number> {
  try {
    const { data, error: _error } = await supabase
      .from('share_events')
      .select('id')
      .eq('repository', repository)
      .eq('action', 'share');

    if (_error) {
      console.error('Failed to get share count:', _error);
      return 0;
    }

    const shareCount = data?.length || 0;
    
    // If we don't have views count, we can't calculate rate
    if (!viewsCount) {
      return shareCount;
    }

    return (shareCount / viewsCount) * 100;
  } catch (err) {
    console.error('Error calculating share rate:', err);
    return 0;
  }
}