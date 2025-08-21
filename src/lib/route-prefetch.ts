/**
 * Route prefetching utility for optimizing navigation performance
 * Preloads likely next routes to enable near-instant transitions
 */

// Cache to track already prefetched routes
const prefetchedRoutes = new Set<string>();

/**
 * Prefetch a route's code chunk for faster navigation
 * Uses requestIdleCallback to avoid blocking main thread
 */
export const prefetchRoute = (routePath: string) => {
  // Skip if already prefetched
  if (prefetchedRoutes.has(routePath)) {
    return;
  }

  // Skip external URLs
  if (routePath.startsWith('http')) {
    return;
  }

  // Use requestIdleCallback for non-critical loading
  const prefetchFn = () => {
    // Map routes to their lazy-loaded chunks
    // These imports trigger Vite to download the chunks but don't execute them
    switch (routePath) {
      case '/':
        // Home page is already loaded
        break;
      case '/changelog':
        import('@/components/features/changelog/changelog-page');
        break;
      case '/docs':
        import('@/components/features/docs/docs-list');
        break;
      case '/feed':
        import('@/components/features/feed/feed-page');
        break;
      case '/settings':
        import('@/components/features/settings/settings-page');
        break;
      case '/login':
        import('@/components/features/auth/login-page');
        break;
      case '/privacy':
        import('@/components/features/privacy/privacy-policy-page');
        break;
      case '/terms':
        import('@/components/features/privacy/terms-page');
        break;
      case '/data-request':
        import('@/components/features/privacy/data-request-page');
        break;
      default:
        // For dynamic routes like /owner/repo, prefetch the main repo view
        if (routePath.match(/^\/[^/]+\/[^/]+$/)) {
          import('@/components/features/repository/repo-view').catch(() => {
            // Fallback if not found
          });
        }
        // For org routes
        if (routePath.match(/^\/orgs\/[^/]+$/)) {
          import('@/pages/org-view').catch(() => {
            // Fallback if not found  
          });
        }
        break;
    }

    // Mark as prefetched
    prefetchedRoutes.add(routePath);
  };

  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(prefetchFn, { timeout: 2000 });
  } else {
    setTimeout(prefetchFn, 100);
  }
};

/**
 * Prefetch multiple routes in batch
 * Useful for prefetching common navigation targets
 */
export const prefetchRoutes = (routes: string[]) => {
  routes.forEach(route => prefetchRoute(route));
};

/**
 * Hook to prefetch routes on hover/focus
 * Provides immediate feedback when user shows intent to navigate
 */
export const usePrefetchOnIntent = (route: string) => {
  const handleIntent = () => {
    prefetchRoute(route);
  };

  return {
    onMouseEnter: handleIntent,
    onFocus: handleIntent,
    onTouchStart: handleIntent,
  };
};

/**
 * Prefetch critical routes after initial page load
 * These are the most likely navigation targets
 */
export const prefetchCriticalRoutes = () => {
  // Wait for main thread to be idle
  const criticalRoutes = [
    '/changelog',
    '/docs',
    '/feed',
  ];

  // Delay prefetching to avoid competing with initial render
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      prefetchRoutes(criticalRoutes);
    }, { timeout: 5000 });
  } else {
    setTimeout(() => {
      prefetchRoutes(criticalRoutes);
    }, 2000);
  }
};