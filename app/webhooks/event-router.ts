import type { IssuesEvent, PullRequestEvent } from '../types/github';
import { eventPriorityService, EventPriority } from '../services/event-priority';
import { embeddingQueueService } from '../services/webhook/embedding-queue';
import { supabase } from '../../src/lib/supabase';

export type WebhookEvent = IssuesEvent | PullRequestEvent;

interface EventMetadata {
  eventId: string;
  eventType: 'issues' | 'pull_request';
  action: string;
  repositoryId: string | number;
  itemId: string | number;
  timestamp: number;
  priority: EventPriority;
}

interface DebouncedEvent {
  event: WebhookEvent;
  metadata: EventMetadata;
  timer: NodeJS.Timeout;
}

/**
 * EventRouter - Smart routing and prioritization for webhook events
 *
 * Features:
 * - Priority classification (critical/high/medium/low)
 * - Event debouncing for rapid changes
 * - Rate limit handling with exponential backoff
 * - Event deduplication
 * - Queue management by priority
 */
export class EventRouter {
  private static instance: EventRouter;

  // Debouncing: Track recent events to prevent spam
  private recentEvents = new Map<string, EventMetadata>();
  private debouncedEvents = new Map<string, DebouncedEvent>();
  private readonly DEBOUNCE_WINDOW = 5000; // 5 seconds
  private readonly EVENT_HISTORY_TTL = 60000; // 1 minute

  // Rate limiting: Track API calls and backoff
  private rateLimitStatus = {
    remaining: 5000,
    resetAt: Date.now(),
    isLimited: false,
  };
  private retryQueue: Array<{ event: WebhookEvent; retryCount: number }> = [];
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_BACKOFF = 2000; // 2 seconds

  private constructor() {
    // Cleanup old events periodically
    setInterval(() => this.cleanupOldEvents(), 60000); // Every minute
  }

  static getInstance(): EventRouter {
    if (!EventRouter.instance) {
      EventRouter.instance = new EventRouter();
    }
    return EventRouter.instance;
  }

  /**
   * Route incoming webhook event with priority and debouncing
   */
  async routeEvent(event: WebhookEvent): Promise<void> {
    try {
      // Extract event metadata
      const metadata = this.extractMetadata(event);

      // Check if event should be debounced
      if (this.shouldDebounce(metadata)) {
        await this.debounceEvent(event, metadata);
        return;
      }

      // Classify priority
      const priority = await this.classifyPriority(event);
      metadata.priority = priority.priority;

      console.log(
        '📨 Routing event: %s %s (priority: %s, score: %d)',
        metadata.eventType,
        metadata.action,
        priority.priority,
        priority.score
      );

      // Track event
      this.trackEvent(metadata);

      // Route based on priority
      await this.processEvent(event, metadata);
    } catch (error) {
      console.error('Error routing event:', error);
      // Queue for retry if it's a rate limit error
      if (this.isRateLimitError(error)) {
        await this.handleRateLimitError(event, error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Extract metadata from webhook event
   */
  private extractMetadata(event: WebhookEvent): EventMetadata {
    const eventType = 'issue' in event ? 'issues' : 'pull_request';
    const item = 'issue' in event ? event.issue : event.pull_request;

    return {
      eventId: `${event.repository.id}-${eventType}-${item.id}-${event.action}`,
      eventType,
      action: event.action,
      repositoryId: event.repository.id,
      itemId: item.id,
      timestamp: Date.now(),
      priority: 'medium', // Will be updated by classification
    };
  }

  /**
   * Classify event priority using EventPriorityService
   */
  private async classifyPriority(event: WebhookEvent) {
    const eventType = 'issue' in event ? 'issues' : 'pull_request';
    const item = 'issue' in event ? event.issue : event.pull_request;

    return await eventPriorityService.classifyEvent(
      eventType,
      event.action,
      item,
      event.repository
    );
  }

  /**
   * Check if event should be debounced
   * Returns true if similar event happened recently
   */
  private shouldDebounce(metadata: EventMetadata): boolean {
    // Don't debounce "opened" events - always process immediately
    if (metadata.action === 'opened') {
      return false;
    }

    // Don't debounce critical events
    if (metadata.priority === 'critical') {
      return false;
    }

    // Check if similar event happened recently
    const recentEvent = this.recentEvents.get(metadata.eventId);
    if (recentEvent) {
      const timeSinceLastEvent = Date.now() - recentEvent.timestamp;
      if (timeSinceLastEvent < this.DEBOUNCE_WINDOW) {
        console.log('⏱️  Debouncing rapid event: %s', metadata.eventId);
        return true;
      }
    }

    return false;
  }

  /**
   * Debounce event - delay processing until no more similar events arrive
   */
  private async debounceEvent(event: WebhookEvent, metadata: EventMetadata): Promise<void> {
    // Cancel existing debounced event if any
    const existing = this.debouncedEvents.get(metadata.eventId);
    if (existing) {
      clearTimeout(existing.timer);
    }

    // Schedule new debounced processing
    const timer = setTimeout(async () => {
      console.log('⏰ Processing debounced event: %s', metadata.eventId);
      this.debouncedEvents.delete(metadata.eventId);
      await this.processEvent(event, metadata);
    }, this.DEBOUNCE_WINDOW);

    // Store debounced event
    this.debouncedEvents.set(metadata.eventId, {
      event,
      metadata,
      timer,
    });
  }

  /**
   * Process event based on priority
   */
  private async processEvent(event: WebhookEvent, metadata: EventMetadata): Promise<void> {
    const eventType = 'issue' in event ? 'issues' : 'pull_request';
    const item = 'issue' in event ? event.issue : event.pull_request;

    // Queue embedding generation with appropriate priority
    if (metadata.action === 'opened' || metadata.action === 'edited') {
      const embeddingPriority = this.mapToEmbeddingPriority(metadata.priority);

      if (eventType === 'issues') {
        // Issue needs repository ID - get it from database
        const { data: repo } = await supabase
          .from('repositories')
          .select('id')
          .eq('github_id', event.repository.id)
          .maybeSingle();

        if (repo) {
          await embeddingQueueService.queueIssueEmbedding(
            item.id.toString(),
            repo.id,
            embeddingPriority
          );
        }
      } else {
        // PR embedding
        const { data: repo } = await supabase
          .from('repositories')
          .select('id')
          .eq('github_id', event.repository.id)
          .maybeSingle();

        if (repo) {
          await embeddingQueueService.queuePREmbedding(
            item.id.toString(),
            repo.id,
            embeddingPriority
          );
        }
      }
    }
  }

  /**
   * Map event priority to embedding priority
   */
  private mapToEmbeddingPriority(
    eventPriority: EventPriority
  ): 'critical' | 'high' | 'medium' | 'low' {
    return eventPriority; // Direct mapping for now
  }

  /**
   * Track event in recent events
   */
  private trackEvent(metadata: EventMetadata): void {
    this.recentEvents.set(metadata.eventId, metadata);
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('429')
      );
    }
    return false;
  }

  /**
   * Handle rate limit error with exponential backoff
   */
  private async handleRateLimitError(event: WebhookEvent, error: unknown): Promise<void> {
    console.warn('⚠️  Rate limit encountered, queueing for retry');

    // Mark as rate limited
    this.rateLimitStatus.isLimited = true;

    // Find existing retry or create new one
    const existingRetry = this.retryQueue.find((r) => {
      const eventType = 'issue' in event ? 'issues' : 'pull_request';
      const rEventType = 'issue' in r.event ? 'issues' : 'pull_request';
      const eventItem = 'issue' in event ? event.issue : event.pull_request;
      const rEventItem = 'issue' in r.event ? r.event.issue : r.event.pull_request;

      return (
        eventType === rEventType &&
        eventItem.id === rEventItem.id &&
        event.action === r.event.action
      );
    });

    if (existingRetry) {
      existingRetry.retryCount++;
      if (existingRetry.retryCount >= this.MAX_RETRIES) {
        console.error('❌ Max retries reached for event, dropping');
        this.retryQueue = this.retryQueue.filter((r) => r !== existingRetry);
        return;
      }
    } else {
      this.retryQueue.push({ event, retryCount: 0 });
    }

    // Schedule retry with exponential backoff
    const retryDelay = this.INITIAL_BACKOFF * Math.pow(2, existingRetry?.retryCount || 0);
    console.log('⏳ Scheduling retry in %dms', retryDelay);

    setTimeout(async () => {
      await this.processRetryQueue();
    }, retryDelay);
  }

  /**
   * Process queued retry events
   */
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) {
      this.rateLimitStatus.isLimited = false;
      return;
    }

    console.log('🔄 Processing %d queued events', this.retryQueue.length);

    // Process one event at a time to avoid hitting rate limits again
    const { event } = this.retryQueue.shift()!;

    try {
      await this.routeEvent(event);
      // Success - mark as no longer rate limited
      this.rateLimitStatus.isLimited = false;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        // Still rate limited, put back in queue
        this.retryQueue.unshift({ event, retryCount: 0 });
        console.warn('⚠️  Still rate limited, will retry later');
      } else {
        console.error('❌ Error processing retry:', error);
      }
    }
  }

  /**
   * Cleanup old events from tracking
   */
  private cleanupOldEvents(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [eventId, metadata] of this.recentEvents.entries()) {
      if (now - metadata.timestamp > this.EVENT_HISTORY_TTL) {
        toDelete.push(eventId);
      }
    }

    toDelete.forEach((eventId) => this.recentEvents.delete(eventId));

    if (toDelete.length > 0) {
      console.log('🧹 Cleaned up %d old events', toDelete.length);
    }
  }

  /**
   * Get current router statistics
   */
  getStats() {
    return {
      recentEventsCount: this.recentEvents.size,
      debouncedEventsCount: this.debouncedEvents.size,
      retryQueueLength: this.retryQueue.length,
      isRateLimited: this.rateLimitStatus.isLimited,
    };
  }

  /**
   * Clear all state (useful for testing)
   */
  clear(): void {
    // Cancel all debounced timers
    for (const debounced of this.debouncedEvents.values()) {
      clearTimeout(debounced.timer);
    }

    this.recentEvents.clear();
    this.debouncedEvents.clear();
    this.retryQueue = [];
    this.rateLimitStatus.isLimited = false;
  }
}

// Export singleton instance
export const eventRouter = EventRouter.getInstance();
