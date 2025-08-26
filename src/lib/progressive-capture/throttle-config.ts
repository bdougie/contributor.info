/**
 * Throttle configuration for smart throttling system
 * These values can be overridden via environment variables
 */

// Helper to safely access environment variables
const getEnvNumber = (key: string, defaultValue: number): number => {
  if (typeof process !== 'undefined' && process.env[key]) {
    return Number(process.env[key]);
  }
  // @ts-ignore - import.meta.env may not exist in all environments
  if (typeof import.meta !== 'undefined' && import.meta.env?.[key]) {
    // @ts-ignore
    return Number(import.meta.env[key]);
  }
  return defaultValue;
};

// Default throttle durations in hours
export const THROTTLE_CONFIG = {
  // Manual sync: 5 minutes (allowing frequent manual refreshes)
  manual: getEnvNumber('VITE_THROTTLE_MANUAL_HOURS', 0.083),
  
  // Auto-fix: 1 hour (for automatic data quality improvements)
  'auto-fix': getEnvNumber('VITE_THROTTLE_AUTO_FIX_HOURS', 1),
  
  // Scheduled: 24 hours (for regular background updates)
  scheduled: getEnvNumber('VITE_THROTTLE_SCHEDULED_HOURS', 24),
  
  // Automatic: 4 hours (for automatic tracking)
  automatic: getEnvNumber('VITE_THROTTLE_AUTOMATIC_HOURS', 4),
  
  // Default: 12 hours (fallback for unknown sources)
  default: getEnvNumber('VITE_THROTTLE_DEFAULT_HOURS', 12)
};

// Polling configuration
export const POLLING_CONFIG = {
  // Poll every 2 seconds when checking for completion
  interval: getEnvNumber('VITE_POLL_INTERVAL_MS', 2000),
  
  // Maximum number of polls (30 polls * 2 seconds = 1 minute)
  maxPolls: getEnvNumber('VITE_POLL_MAX_COUNT', 30),
  
  // Consider sync complete if updated within last 30 seconds
  completionThreshold: getEnvNumber('VITE_POLL_COMPLETION_THRESHOLD_SECONDS', 30)
};

// Queue configuration
export const QUEUE_CONFIG = {
  // Maximum PRs to sync per repository
  maxPrsPerSync: getEnvNumber('VITE_MAX_PRS_PER_SYNC', 100),
  
  // Batch size for queue operations
  batchSize: getEnvNumber('VITE_QUEUE_BATCH_SIZE', 50),
  
  // Telemetry flush interval in milliseconds (30 seconds)
  telemetryFlushInterval: getEnvNumber('VITE_TELEMETRY_FLUSH_INTERVAL_MS', 30000)
};

// Rate limit thresholds
export const RATE_LIMIT_CONFIG = {
  // Warn when usage exceeds this percentage
  warningThreshold: getEnvNumber('VITE_RATE_LIMIT_WARNING_THRESHOLD', 80),
  
  // Critical threshold for immediate action
  criticalThreshold: getEnvNumber('VITE_RATE_LIMIT_CRITICAL_THRESHOLD', 95)
};

/**
 * Get throttle hours for a specific trigger source
 */
export function getThrottleHours(triggerSource?: string): number {
  if (!triggerSource) return THROTTLE_CONFIG.default;
  return THROTTLE_CONFIG[triggerSource as keyof typeof THROTTLE_CONFIG] || THROTTLE_CONFIG.default;
}

/**
 * Check if sync is allowed based on last update time
 */
export function isSyncAllowed(lastUpdated?: Date | string, triggerSource?: string): boolean {
  if (!lastUpdated) return true;
  
  const lastUpdateTime = new Date(lastUpdated);
  const hoursSinceUpdate = (Date.now() - lastUpdateTime.getTime()) / (1000 * 60 * 60);
  const throttleHours = getThrottleHours(triggerSource);
  
  return hoursSinceUpdate >= throttleHours;
}