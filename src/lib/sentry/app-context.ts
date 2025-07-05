import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setApplicationContext, setUserContext } from './data-tracking';

/**
 * Hook to automatically track route changes and application context in Sentry
 */
export function useSentryRouteTracking() {
  const location = useLocation();

  useEffect(() => {
    // Extract repository info from URL if present
    const pathParts = location.pathname.split('/');
    let repository: string | undefined;
    
    if (pathParts[1] === 'repo' && pathParts[2] && pathParts[3]) {
      repository = `${pathParts[2]}/${pathParts[3]}`;
    }

    // Extract time range from search params
    const searchParams = new URLSearchParams(location.search);
    const timeRange = searchParams.get('timeRange') || '30';

    // Set application context for better error tracking
    setApplicationContext({
      route: location.pathname,
      repository,
      timeRange,
      dataSource: 'database' // Default to database-first approach
    });
  }, [location.pathname, location.search]);
}

/**
 * Set user authentication context for Sentry
 */
export function setSentryUserContext(user: {
  id?: string;
  email?: string;
  username?: string;
  plan?: string;
}) {
  setUserContext({
    ...user,
    features: [
      'database_fallback',
      'progressive_capture',
      'smart_notifications',
      'analytics_tracking'
    ]
  });
}

/**
 * Track feature usage in Sentry
 */
export function trackFeatureUsage(feature: string, metadata?: Record<string, any>) {
  setApplicationContext({
    experimentalFeatures: [feature]
  });
  
  // Set metadata separately if provided
  if (metadata) {
    // Use a context name that doesn't conflict with the main application context
    // Using @sentry/react's setContext method directly
    import('@sentry/react').then(Sentry => {
      Sentry.setContext('feature_metadata', metadata);
    });
  }
}