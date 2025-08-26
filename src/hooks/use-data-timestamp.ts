import { useState, useEffect, useCallback } from 'react';

interface DataTimestampState {
  /**
   * When the data was last fetched/updated
   */
  lastUpdated: Date;
  /**
   * Whether the data is currently being refreshed
   */
  isRefreshing: boolean;
}

interface UseDataTimestampOptions {
  /**
   * Initial timestamp (defaults to current time)
   */
  initialTimestamp?: Date;
  /**
   * Whether to automatically update the timestamp when dependencies change
   */
  autoUpdate?: boolean;
}

/**
 * Hook to track when data was last updated/fetched.
 * Provides utilities for managing data freshness timestamps.
 */
export function useDataTimestamp(
  dependencies: unknown[] = [],
  options: UseDataTimestampOptions = {}
) {
  const { initialTimestamp = new Date(), autoUpdate = true } = options;
  
  const [state, setState] = useState<DataTimestampState>({
    lastUpdated: initialTimestamp,
    isRefreshing: false
  });

  // Update timestamp when dependencies change (if autoUpdate is enabled)
  useEffect(() => {
    if (autoUpdate && dependencies.length > 0) {
      // Check if any dependency has actually changed by comparing with previous
      // This is a simple implementation - could be enhanced for deep comparison
      setState(prev => ({
        ...prev,
        lastUpdated: new Date()
      }));
    }
  }, dependencies);

  /**
   * Manually update the timestamp (useful for marking _data refresh)
   */
  const updateTimestamp = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastUpdated: new Date()
    }));
  }, []);

  /**
   * Mark data as being refreshed
   */
  const startRefresh = useCallback(() => {
    setState(prev => ({
      ...prev,
      isRefreshing: true
    }));
  }, []);

  /**
   * Mark data refresh as complete and update timestamp
   */
  const endRefresh = useCallback(() => {
    setState({
      lastUpdated: new Date(),
      isRefreshing: false
    });
  }, []);

  /**
   * Set a specific timestamp (useful when you know the actual _data timestamp)
   */
  const setTimestamp = useCallback((timestamp: Date) => {
    setState(prev => ({
      ...prev,
      lastUpdated: timestamp
    }));
  }, []);

  return {
    lastUpdated: state.lastUpdated,
    isRefreshing: state.isRefreshing,
    updateTimestamp,
    startRefresh,
    endRefresh,
    setTimestamp
  };
}

/**
 * Hook specifically for tracking page load/mount timestamp
 */
export function usePageTimestamp() {
  const [mountTimestamp] = useState(() => new Date());
  
  return {
    pageLoadedAt: mountTimestamp
  };
}