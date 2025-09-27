/**
 * Edge Function Configuration
 *
 * Centralized configuration for Edge Function concurrency management
 * and circuit breaker settings.
 */

export interface EdgeFunctionConfig {
  concurrency: {
    tiers: {
      free: ConcurrencyTier;
      pro: ConcurrencyTier;
      enterprise: ConcurrencyTier;
    };
    metrics: {
      flushIntervalMs: number;
      bufferSize: number;
      retentionDays: number;
    };
  };
  circuitBreaker: {
    failureThreshold: number;
    successThreshold: number;
    timeoutMs: number;
    volumeThreshold: number;
    errorThresholdPercentage: number;
    windowDurationMs: number;
  };
  queue: {
    maxRetries: number;
    baseBackoffMs: number;
    maxBackoffMs: number;
    deadLetterAfterDays: number;
  };
}

export interface ConcurrencyTier {
  maxConcurrent: number;
  burstCapacity: number;
  cooldownPeriodMs: number;
  queueCapacity: number;
}

export interface QueuePayload {
  eventName: string;
  data: Record<string, unknown>;
  metadata?: {
    source?: string;
    timestamp?: string;
    correlationId?: string;
    userId?: string;
    [key: string]: unknown;
  };
}

export interface WebhookQueueItem {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';
  priority: 'high' | 'medium' | 'low';
  eventType: string;
  payload: QueuePayload;
  headers?: Record<string, string>;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  scheduledFor: Date;
  idempotencyKey?: string;
  correlationId?: string;
  userId?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: EdgeFunctionConfig = {
  concurrency: {
    tiers: {
      free: {
        maxConcurrent: 10,
        burstCapacity: 15,
        cooldownPeriodMs: 5000,
        queueCapacity: 100,
      },
      pro: {
        maxConcurrent: 40,
        burstCapacity: 50,
        cooldownPeriodMs: 2000,
        queueCapacity: 500,
      },
      enterprise: {
        maxConcurrent: 100,
        burstCapacity: 150,
        cooldownPeriodMs: 1000,
        queueCapacity: 1000,
      },
    },
    metrics: {
      flushIntervalMs: 10000, // 10 seconds
      bufferSize: 6,
      retentionDays: 30,
    },
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 3,
    timeoutMs: 60000, // 1 minute
    volumeThreshold: 10,
    errorThresholdPercentage: 50,
    windowDurationMs: 60000, // 1 minute
  },
  queue: {
    maxRetries: 3,
    baseBackoffMs: 60000, // 1 minute
    maxBackoffMs: 3600000, // 1 hour
    deadLetterAfterDays: 7,
  },
};

/**
 * Get configuration with optional overrides
 */
export function getConfig(overrides?: Partial<EdgeFunctionConfig>): EdgeFunctionConfig {
  if (!overrides) {
    return DEFAULT_CONFIG;
  }

  return {
    ...DEFAULT_CONFIG,
    ...overrides,
    concurrency: {
      ...DEFAULT_CONFIG.concurrency,
      ...overrides.concurrency,
      tiers: {
        ...DEFAULT_CONFIG.concurrency.tiers,
        ...overrides.concurrency?.tiers,
      },
      metrics: {
        ...DEFAULT_CONFIG.concurrency.metrics,
        ...overrides.concurrency?.metrics,
      },
    },
    circuitBreaker: {
      ...DEFAULT_CONFIG.circuitBreaker,
      ...overrides.circuitBreaker,
    },
    queue: {
      ...DEFAULT_CONFIG.queue,
      ...overrides.queue,
    },
  };
}

/**
 * Calculate exponential backoff with jitter
 */
export function calculateBackoff(
  retryCount: number,
  baseMs: number = DEFAULT_CONFIG.queue.baseBackoffMs,
  maxMs: number = DEFAULT_CONFIG.queue.maxBackoffMs
): number {
  // Exponential backoff with jitter
  const exponentialMs = Math.min(baseMs * Math.pow(2, retryCount), maxMs);
  const jitter = Math.random() * 0.3 * exponentialMs; // Up to 30% jitter
  return Math.floor(exponentialMs + jitter);
}

/**
 * Determine if a queue item should be moved to dead letter
 */
export function shouldDeadLetter(item: WebhookQueueItem): boolean {
  // Check retry count
  if (item.retryCount >= item.maxRetries) {
    return true;
  }

  // Check age
  const ageInDays = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays >= DEFAULT_CONFIG.queue.deadLetterAfterDays) {
    return true;
  }

  return false;
}
