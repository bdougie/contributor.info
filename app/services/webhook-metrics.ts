/**
 * WebhookMetricsService - PostHog-powered webhook analytics
 *
 * Tracks webhook processing metrics using PostHog events for real-time monitoring:
 * - Processing time and latency
 * - Event types and priorities
 * - Error rates and rate limiting
 * - Cache performance
 * - Event routing decisions
 */

import type { EventPriority } from './event-priority';

export interface WebhookMetrics {
  eventType: 'issues' | 'pull_request';
  action: string;
  priority: EventPriority;
  processingTimeMs: number;
  repositoryId: string | number;
  installationId?: number;
  cached?: boolean;
  debounced?: boolean;
  rateLimited?: boolean;
  error?: string;
}

export interface SimilaritySearchMetrics {
  searchType: 'issue' | 'pr';
  itemId: string | number;
  repositoryId: string | number;
  searchTimeMs: number;
  resultsCount: number;
  cacheHit: boolean;
  semanticSearch: boolean;
  embeddingCached: boolean;
}

export interface EventRouterMetrics {
  eventId: string;
  routingDecision: 'immediate' | 'debounced' | 'queued';
  priority: EventPriority;
  routingTimeMs: number;
  queueDepth?: number;
}

/**
 * Lightweight PostHog client for server-side tracking
 */
class PostHogClient {
  private apiKey: string | undefined;
  private host: string;
  private enabled: boolean;

  constructor() {
    // Server-side environment variables
    this.apiKey = process.env.POSTHOG_API_KEY;
    this.host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      console.warn('PostHog webhook metrics disabled: POSTHOG_API_KEY not set');
    }
  }

  /**
   * Capture event in PostHog
   */
  async capture(
    distinctId: string,
    event: string,
    properties: Record<string, unknown>
  ): Promise<void> {
    if (!this.enabled || !this.apiKey) {
      return;
    }

    try {
      const response = await fetch(`${this.host}/capture/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          distinct_id: distinctId,
          event,
          properties: {
            ...properties,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      if (!response.ok) {
        console.error('PostHog capture failed:', response.status);
      }
    } catch (error) {
      console.error('Error capturing PostHog event:', error);
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * WebhookMetricsService - Singleton service for webhook analytics
 */
export class WebhookMetricsService {
  private static instance: WebhookMetricsService;
  private posthog: PostHogClient;

  private constructor() {
    this.posthog = new PostHogClient();
  }

  static getInstance(): WebhookMetricsService {
    if (!WebhookMetricsService.instance) {
      WebhookMetricsService.instance = new WebhookMetricsService();
    }
    return WebhookMetricsService.instance;
  }

  /**
   * Track webhook processing metrics
   */
  async trackWebhookProcessing(metrics: WebhookMetrics): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `installation-${metrics.installationId || 'anonymous'}`;

    await this.posthog.capture(distinctId, 'webhook_processed', {
      // Event classification
      event_type: metrics.eventType,
      action: metrics.action,
      priority: metrics.priority,

      // Performance metrics
      processing_time_ms: metrics.processingTimeMs,
      debounced: metrics.debounced || false,
      cached: metrics.cached || false,

      // Rate limiting
      rate_limited: metrics.rateLimited || false,

      // Context
      repository_id: metrics.repositoryId,
      installation_id: metrics.installationId,

      // Error tracking
      has_error: !!metrics.error,
      error_message: metrics.error,

      // Feature flag
      feature: 'webhook-processing',
    });

    // Track errors separately
    if (metrics.error) {
      await this.posthog.capture(distinctId, 'webhook_error', {
        event_type: metrics.eventType,
        action: metrics.action,
        error_message: metrics.error,
        repository_id: metrics.repositoryId,
        installation_id: metrics.installationId,
      });
    }
  }

  /**
   * Track similarity search performance
   */
  async trackSimilaritySearch(metrics: SimilaritySearchMetrics): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `repo-${metrics.repositoryId}`;

    await this.posthog.capture(distinctId, 'similarity_search', {
      // Search metadata
      search_type: metrics.searchType,
      item_id: metrics.itemId,
      repository_id: metrics.repositoryId,

      // Performance
      search_time_ms: metrics.searchTimeMs,
      results_count: metrics.resultsCount,

      // Cache performance
      cache_hit: metrics.cacheHit,
      embedding_cached: metrics.embeddingCached,

      // Search configuration
      semantic_search: metrics.semanticSearch,

      // Feature flag
      feature: 'similarity-search',
    });
  }

  /**
   * Track event router decisions
   */
  async trackEventRouting(metrics: EventRouterMetrics): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `event-${metrics.eventId}`;

    await this.posthog.capture(distinctId, 'event_routed', {
      // Routing decision
      routing_decision: metrics.routingDecision,
      priority: metrics.priority,

      // Performance
      routing_time_ms: metrics.routingTimeMs,
      queue_depth: metrics.queueDepth,

      // Context
      event_id: metrics.eventId,

      // Feature flag
      feature: 'event-routing',
    });
  }

  /**
   * Track rate limit events
   */
  async trackRateLimit(
    repositoryId: string | number,
    installationId: number,
    retryCount: number
  ): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `installation-${installationId}`;

    await this.posthog.capture(distinctId, 'rate_limit_hit', {
      repository_id: repositoryId,
      installation_id: installationId,
      retry_count: retryCount,
      feature: 'rate-limiting',
    });
  }

  /**
   * Track cache performance
   */
  async trackCachePerformance(
    cacheType: 'similarity' | 'embedding' | 'repository',
    operation: 'hit' | 'miss' | 'invalidate',
    itemId: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.posthog.isEnabled()) return;

    const distinctId = `cache-${cacheType}`;

    await this.posthog.capture(distinctId, 'cache_operation', {
      cache_type: cacheType,
      operation,
      item_id: itemId,
      ...metadata,
      feature: 'caching',
    });
  }

  /**
   * Check if tracking is enabled
   */
  isTrackingEnabled(): boolean {
    return this.posthog.isEnabled();
  }
}

// Export singleton instance
export const webhookMetricsService = WebhookMetricsService.getInstance();
