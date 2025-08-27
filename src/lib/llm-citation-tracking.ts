import { supabase } from './supabase';

export interface ReferralTrafficEvent {
  referrer_url?: string;
  referrer_domain?: string;
  referrer_type: 'ai_platform' | 'search_engine' | 'social_media' | 'direct' | 'other';
  ai_platform?: 'claude' | 'chatgpt' | 'perplexity' | 'gemini' | 'copilot' | 'other_ai';
  landing_page: string;
  repository?: string;
  session_id: string;
  user_agent?: string;
  country_code?: string;
  query_pattern?: string;
  citation_confidence?: number;
}

export interface CitationAlert {
  alert_source: 'google_alerts' | 'mention_tracker' | 'referral_spike' | 'manual';
  content_snippet?: string;
  source_url?: string;
  source_domain?: string;
  ai_platform?: string;
  citation_type?: 'direct_link' | 'data_reference' | 'methodology_mention' | 'tool_recommendation';
  confidence_score?: number;
  metadata?: Record<string, any>;
}

export interface QueryPattern {
  pattern_text: string;
  pattern_type:
    | 'contributor_lookup'
    | 'repository_analysis'
    | 'github_stats'
    | 'maintainer_info'
    | 'project_insights';
  ai_platforms?: string[];
  example_queries?: string[];
}

/**
 * LLM Citation Tracking System
 * Tracks when contributor.info is referenced by AI platforms
 */
class LLMCitationTracker {
  private sessionId: string;
  private isInitialized: boolean = false;
  private engagementInterval?: NodeJS.Timeout;
  private activityHandler?: () => void;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
  }

  /**
   * Initialize tracking on page load
   */
  public initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.isInitialized = true;

    // Track the current page view if it came from a referrer
    this.trackPageView();

    // Set up periodic referral tracking
    this.setupPeriodicTracking();
  }

  /**
   * Track a page view with referral information
   */
  private async trackPageView(): Promise<void> {
    try {
      const referrerInfo = this.analyzeReferrer();
      const landingPage = window.location.pathname + window.location.search;
      const repository = this.extractRepositoryFromPath(landingPage);

      const event: ReferralTrafficEvent = {
        ...referrerInfo,
        landing_page: landingPage,
        repository,
        session_id: this.sessionId,
        user_agent: navigator.userAgent,
        query_pattern: this.detectQueryPattern(referrerInfo.referrer_url, landingPage),
      };

      // Calculate citation confidence
      event.citation_confidence = this.calculateCitationConfidence(
        referrerInfo.referrer_url,
        navigator.userAgent,
        landingPage
      );

      // Only track if there's a referrer or high confidence of AI citation
      if (event.referrer_url || event.citation_confidence > 0.3) {
        await this.sendReferralEvent(event);
      }

      // Log for development
      if (process.env.NODE_ENV === 'development') {
        console.log('[LLM Citation Tracker] Page view tracked:', event);
      }
    } catch (error) {
      console.error('[LLM Citation Tracker] Failed to track page view:', error);
    }
  }

  /**
   * Analyze the current referrer to determine if it's from an AI platform
   */
  private analyzeReferrer() {
    const referrerUrl = document.referrer;

    if (!referrerUrl) {
      return {
        referrer_url: undefined,
        referrer_domain: undefined,
        referrer_type: 'direct' as const,
        ai_platform: undefined,
      };
    }

    // Parse URL safely to get hostname
    let referrerDomain: string | undefined;
    try {
      const parsedUrl = new URL(referrerUrl);
      referrerDomain = parsedUrl.hostname;
    } catch {
      // Invalid URL, treat as direct traffic
      return {
        referrer_url: referrerUrl,
        referrer_domain: undefined,
        referrer_type: 'direct' as const,
        ai_platform: undefined,
      };
    }

    let referrerType: ReferralTrafficEvent['referrer_type'] = 'direct';
    let aiPlatform: ReferralTrafficEvent['ai_platform'] = undefined;

    const domain = referrerDomain.toLowerCase();

    // AI Platform detection - check hostname only to prevent security issues
    if (domain === 'claude.ai' || domain === 'anthropic.com' || domain.endsWith('.anthropic.com')) {
      referrerType = 'ai_platform';
      aiPlatform = 'claude';
    } else if (
      domain === 'chat.openai.com' ||
      domain === 'chatgpt.com' ||
      domain.endsWith('.openai.com')
    ) {
      referrerType = 'ai_platform';
      aiPlatform = 'chatgpt';
    } else if (domain === 'perplexity.ai' || domain.endsWith('.perplexity.ai')) {
      referrerType = 'ai_platform';
      aiPlatform = 'perplexity';
    } else if (domain === 'gemini.google.com' || domain === 'bard.google.com') {
      referrerType = 'ai_platform';
      aiPlatform = 'gemini';
    } else if (
      domain === 'copilot.microsoft.com' ||
      (domain === 'bing.com' && referrerUrl.includes('/chat'))
    ) {
      referrerType = 'ai_platform';
      aiPlatform = 'copilot';
    } else if (domain === 'poe.com' || domain === 'you.com' || domain === 'character.ai') {
      referrerType = 'ai_platform';
      aiPlatform = 'other_ai';
    }
    // Search engines - check exact domains
    else if (domain.includes('google.') || domain === 'bing.com' || domain === 'duckduckgo.com') {
      referrerType = 'search_engine';
    }
    // Social media - check exact domains
    else if (
      domain === 'twitter.com' ||
      domain === 'x.com' ||
      domain === 'linkedin.com' ||
      domain.endsWith('.linkedin.com') ||
      domain === 'facebook.com' ||
      domain.endsWith('.facebook.com') ||
      domain === 'reddit.com' ||
      domain.endsWith('.reddit.com') ||
      domain === 'news.ycombinator.com' ||
      domain === 'github.com'
    ) {
      referrerType = 'social_media';
    }
    // Everything else
    else {
      referrerType = 'other';
    }

    return {
      referrer_url: referrerUrl,
      referrer_domain: referrerDomain,
      referrer_type: referrerType,
      ai_platform: aiPlatform,
    };
  }

  /**
   * Extract repository name from URL path
   */
  private extractRepositoryFromPath(path: string): string | undefined {
    // Match patterns like /owner/repo or /owner/repo/anything
    const match = path.match(/^\/([^\/]+\/[^\/]+)/);
    return match ? match[1] : undefined;
  }

  /**
   * Detect common query patterns that might indicate AI citations
   */
  private detectQueryPattern(referrerUrl?: string, landingPage?: string): string | undefined {
    if (!referrerUrl && !landingPage) return undefined;

    const url = (referrerUrl || '').toLowerCase();
    const path = (landingPage || '').toLowerCase();

    // Common patterns that indicate specific types of queries
    if (path.includes('/contributors') || url.includes('contributor')) {
      return 'contributor_lookup';
    } else if (path.includes('/insights') || url.includes('insight') || url.includes('analyt')) {
      return 'repository_analysis';
    } else if (url.includes('github') && (url.includes('stat') || url.includes('metric'))) {
      return 'github_stats';
    } else if (url.includes('maintainer') || path.includes('/maintainers')) {
      return 'maintainer_info';
    } else if (this.extractRepositoryFromPath(path)) {
      return 'project_insights';
    }

    return undefined;
  }

  /**
   * Calculate confidence that this is an AI platform citation
   */
  private calculateCitationConfidence(
    _referrerUrl?: string,
    userAgent?: string,
    landingPage?: string
  ): number {
    let confidence = 0;

    // Base confidence from AI platform detection
    const referrerInfo = this.analyzeReferrer();
    if (referrerInfo.referrer_type === 'ai_platform') {
      confidence += 0.5;
    }

    // Boost confidence for specific landing pages that are commonly cited
    if (landingPage) {
      if (landingPage.includes('/contributors') || landingPage.includes('/insights')) {
        confidence += 0.2;
      }

      // Direct repository pages are commonly cited by AI
      if (this.extractRepositoryFromPath(landingPage)) {
        confidence += 0.3;
      }
    }

    // User agent patterns that might indicate AI crawlers
    if (userAgent) {
      const ua = userAgent.toLowerCase();
      if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
        confidence += 0.1;
      }
    }

    // Ensure confidence is between 0 and 1
    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Send referral event to Supabase
   */
  private async sendReferralEvent(event: ReferralTrafficEvent): Promise<void> {
    try {
      const { error } = await supabase.from('referral_traffic').insert([event]);

      if (error) {
        console.error('[LLM Citation Tracker] Failed to send referral event:', error);
      }
    } catch (err) {
      console.error('[LLM Citation Tracker] Error sending referral event:', err);
    }
  }

  /**
   * Track a citation alert (usually called by backend systems)
   */
  public async trackCitationAlert(alert: CitationAlert): Promise<void> {
    try {
      const { error } = await supabase.from('citation_alerts').insert([alert]);

      if (error) {
        console.error('[LLM Citation Tracker] Failed to track citation alert:', error);
      }
    } catch (err) {
      console.error('[LLM Citation Tracker] Error tracking citation alert:', err);
    }
  }

  /**
   * Record a query pattern for analysis
   */
  public async recordQueryPattern(pattern: QueryPattern): Promise<void> {
    try {
      // First, try to update existing pattern
      const { data: existing, error: fetchError } = await supabase
        .from('query_patterns')
        .select('id, frequency_count')
        .eq('pattern_text', pattern.pattern_text)
        .maybeSingle();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // Not found error
        throw fetchError;
      }

      if (existing) {
        // Update existing pattern
        const { error } = await supabase
          .from('query_patterns')
          .update({
            frequency_count: existing.frequency_count + 1,
            last_seen_at: new Date().toISOString(),
            ai_platforms: pattern.ai_platforms,
            example_queries: pattern.example_queries,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new pattern
        const { error } = await supabase.from('query_patterns').insert([
          {
            ...pattern,
            frequency_count: 1,
            last_seen_at: new Date().toISOString(),
          },
        ]);

        if (error) throw error;
      }
    } catch (err) {
      console.error('[LLM Citation Tracker] Error recording query pattern:', err);
    }
  }

  /**
   * Get citation metrics for dashboard
   */
  public async getCitationMetrics(dateRange?: { start: Date; end: Date }) {
    try {
      let query = supabase.from('referral_traffic').select('*').eq('referrer_type', 'ai_platform');

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString());
      } else {
        // Default to last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query = query.gte('created_at', thirtyDaysAgo.toISOString());
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('[LLM Citation Tracker] Failed to get citation metrics:', error);
        return null;
      }

      // Aggregate the data
      const metrics = {
        totalCitations: data?.length || 0,
        uniqueRepositories: new Set(data?.map((d) => d.repository).filter(Boolean)).size,
        platformBreakdown: {} as Record<string, number>,
        repositoryBreakdown: {} as Record<string, number>,
        dailyTrend: {} as Record<string, number>,
        averageConfidence: data?.length
          ? data.reduce((sum, d) => sum + (d.citation_confidence || 0), 0) / data.length
          : 0,
      };

      data?.forEach((item) => {
        // Platform breakdown
        if (item.ai_platform) {
          metrics.platformBreakdown[item.ai_platform] =
            (metrics.platformBreakdown[item.ai_platform] || 0) + 1;
        }

        // Repository breakdown
        if (item.repository) {
          metrics.repositoryBreakdown[item.repository] =
            (metrics.repositoryBreakdown[item.repository] || 0) + 1;
        }

        // Daily trend
        const date = new Date(item.created_at).toISOString().split('T')[0];
        metrics.dailyTrend[date] = (metrics.dailyTrend[date] || 0) + 1;
      });

      return metrics;
    } catch (err) {
      console.error('[LLM Citation Tracker] Error getting citation metrics:', err);
      return null;
    }
  }

  /**
   * Set up periodic tracking for long-running sessions
   */
  private setupPeriodicTracking(): void {
    // Track engagement every 30 seconds for active sessions
    let lastActivity = Date.now();

    this.activityHandler = () => {
      lastActivity = Date.now();
    };

    // Listen for user activity
    ['click', 'scroll', 'keypress', 'mousemove'].forEach((event) => {
      document.addEventListener(event, this.activityHandler!, { passive: true });
    });

    // Periodic engagement tracking
    this.engagementInterval = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivity;

      // If user has been inactive for more than 5 minutes, stop tracking
      if (timeSinceActivity > 5 * 60 * 1000) {
        if (this.engagementInterval) {
          clearInterval(this.engagementInterval);
        }
        return;
      }

      // Track continued engagement for AI citation sessions
      const referrerInfo = this.analyzeReferrer();
      if (referrerInfo.referrer_type === 'ai_platform') {
        this.trackPageView();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Get or create session ID for tracking
   */
  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
      return `llm_tracker_ssr_${Date.now()}`;
    }

    const storageKey = 'contributor-info-llm-session';
    let sessionId = sessionStorage.getItem(storageKey);

    if (!sessionId) {
      const randomBytes = new Uint8Array(16);
      window.crypto.getRandomValues(randomBytes);
      const randomString = Array.from(randomBytes, (byte) => byte.toString(36))
        .join('')
        .substr(0, 9);
      sessionId = `llm_${Date.now()}_${randomString}`;
      sessionStorage.setItem(storageKey, sessionId);
    }

    return sessionId;
  }

  /**
   * Destroy the tracker and clean up
   */
  public destroy(): void {
    this.isInitialized = false;

    // Clean up event listeners
    if (this.activityHandler) {
      ['click', 'scroll', 'keypress', 'mousemove'].forEach((event) => {
        document.removeEventListener(event, this.activityHandler!);
      });
      this.activityHandler = undefined;
    }

    // Clear interval
    if (this.engagementInterval) {
      clearInterval(this.engagementInterval);
      this.engagementInterval = undefined;
    }
  }
}

// Singleton instance
let trackerInstance: LLMCitationTracker | null = null;

/**
 * Initialize LLM citation tracking
 */
export function initializeLLMCitationTracking(): LLMCitationTracker {
  if (!trackerInstance) {
    trackerInstance = new LLMCitationTracker();
    trackerInstance.initialize();
  }
  return trackerInstance;
}

/**
 * Get the LLM citation tracker instance
 */
export function getLLMCitationTracker(): LLMCitationTracker {
  if (!trackerInstance) {
    throw new Error(
      'LLM Citation Tracker not initialized. Call initializeLLMCitationTracking first.'
    );
  }
  return trackerInstance;
}
