import { useEffect, useState } from 'react';
import { isPostHogEnabled, getRateLimiterStats } from '@/lib/posthog-lazy';
import { env } from '@/lib/env';

interface PostHogHealth {
  enabled: boolean;
  configured: boolean;
  rateLimits: {
    eventCounts: Map<string, number>;
    limits: { perMinute: number; perHour: number };
  };
  lastError?: string;
}

/**
 * Component to monitor PostHog integration health
 * Only renders in development mode
 */
export function PostHogHealthMonitor() {
  const [health, setHealth] = useState<PostHogHealth | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (!env.DEV) return;

    const checkHealth = () => {
      try {
        const stats = getRateLimiterStats();
        setHealth({
          enabled: isPostHogEnabled(),
          configured: !!env.POSTHOG_KEY,
          rateLimits: stats,
        });
      } catch (_error) {
        setHealth({
          enabled: false,
          configured: !!env.POSTHOG_KEY,
          rateLimits: {
            eventCounts: new Map(),
            limits: { perMinute: 0, perHour: 0 },
          },
          lastError: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    // Check health immediately
    checkHealth();

    // Update every 5 seconds
    const interval = setInterval(checkHealth, 5000);

    return () => clearInterval(interval);
  }, []);

  // Don't render in production
  if (!env.DEV || !health) return null;

  const eventCountsArray = Array.from(health.rateLimits.eventCounts.entries());
  const totalEvents = eventCountsArray.reduce((sum, [, count]) => sum + count, 0);
  const isNearLimit = totalEvents > health.rateLimits.limits.perMinute * 0.8;

  const getButtonClassName = (): string => {
    if (health.lastError) {
      return 'bg-red-500 hover:bg-red-600';
    }
    if (isNearLimit) {
      return 'bg-yellow-500 hover:bg-yellow-600';
    }
    if (health.enabled) {
      return 'bg-green-500 hover:bg-green-600';
    }
    return 'bg-gray-500 hover:bg-gray-600';
  };

  const getStatusClassName = (): string => {
    if (health.lastError) {
      return 'text-red-600';
    }
    if (health.enabled) {
      return 'text-green-600';
    }
    return 'text-gray-600';
  };

  const getStatusText = (): string => {
    if (health.lastError) {
      return 'Error';
    }
    if (health.enabled) {
      return 'Active';
    }
    return 'Inactive';
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`rounded-full p-2 shadow-lg transition-colors ${getButtonClassName()}`}
        title="PostHog Health Monitor"
        aria-label="Toggle PostHog Health Monitor"
      >
        <svg
          className="h-6 w-6 text-white"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      {isVisible && (
        <div className="absolute bottom-12 right-0 w-80 rounded-lg bg-white p-4 shadow-xl dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">
            PostHog Health Monitor
          </h3>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Status:</span>
              <span className={`font-medium ${getStatusClassName()}`}>{getStatusText()}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Configured:</span>
              <span
                className={`font-medium ${health.configured ? 'text-green-600' : 'text-red-600'}`}
              >
                {health.configured ? 'Yes' : 'No'}
              </span>
            </div>

            {health.lastError && (
              <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-900/20">
                Error: {health.lastError}
              </div>
            )}

            <div className="mt-3 border-t pt-3 dark:border-gray-700">
              <div className="mb-2 font-medium text-gray-900 dark:text-gray-100">Rate Limits</div>

              <div className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400">Per Minute:</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {totalEvents} / {health.rateLimits.limits.perMinute}
                </span>
              </div>

              <div className="mt-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-full transition-all ${
                      isNearLimit ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (totalEvents / health.rateLimits.limits.perMinute) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>

              {eventCountsArray.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Events by Type:
                  </div>
                  {eventCountsArray.map(([name, count]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{name}:</span>
                      <span className="text-gray-900 dark:text-gray-100">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 border-t pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <div>PostHog integration for Web Vitals</div>
              <div>Monitoring real user performance</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
