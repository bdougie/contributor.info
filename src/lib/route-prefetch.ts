/**
 * Route prefetching utility for optimizing navigation performance
 * Preloads likely next routes to enable near-instant transitions
 */

// Cache to track already prefetched routes with memory management
const prefetchedRoutes = new Set<string>();
const MAX_PREFETCH_CACHE_SIZE = 50; // Prevent unbounded growth

/**
 * Validate route pattern for security
 */
const isValidRoute = (route: string): boolean => {
  // Allow only alphanumeric, hyphens, underscores, and forward slashes
  // Prevent directory traversal and other malicious patterns
  return /^\/[\w-]*(\/[\w-]+)*\/?$/.test(route) && !route.includes('..');
};

/**
 * Safely import a module with error handling
 */
const validateImport = async (
  importFn: () => Promise<any>,
  moduleName: string
): Promise<boolean> => {
  try {
    await importFn();
    return true;
  } catch (err) {
    console.warn(`Failed to prefetch ${moduleName}:`, err);
    return false;
  }
};

/**
 * Prefetch a route's code chunk for faster navigation
 * Uses requestIdleCallback to avoid blocking main thread
 */
export const prefetchRoute = (routePath: string) => {
  // Validate route for security
  if (!isValidRoute(routePath)) {
    console.warn(`Invalid route pattern: ${routePath}`);
    return;
  }

  // Skip if already prefetched
  if (prefetchedRoutes.has(routePath)) {
    return;
  }

  // Skip external URLs
  if (routePath.startsWith('http')) {
    return;
  }

  // Manage cache size to prevent memory leaks
  if (prefetchedRoutes.size >= MAX_PREFETCH_CACHE_SIZE) {
    // Remove the oldest entry (first item in Set)
    const firstKey = prefetchedRoutes.values().next().value;
    if (firstKey) {
      prefetchedRoutes.delete(firstKey);
    }
  }

  // Use requestIdleCallback for non-critical loading
  const prefetchFn = async () => {
    let success = false;

    // Map routes to their lazy-loaded chunks with validation
    switch (routePath) {
      case '/':
        // Home page is already loaded
        success = true;
        break;
      case '/changelog':
        success = await validateImport(
          () => import('@/components/features/changelog/changelog-page'),
          'changelog-page'
        );
        break;
      case '/docs':
        success = await validateImport(
          () => import('@/components/features/docs/docs-list'),
          'docs-list'
        );
        break;
      case '/feed':
        success = await validateImport(
          () => import('@/components/features/feed/feed-page'),
          'feed-page'
        );
        break;
      case '/settings':
        success = await validateImport(
          () => import('@/components/features/settings/settings-page'),
          'settings-page'
        );
        break;
      case '/login':
        success = await validateImport(
          () => import('@/components/features/auth/login-page'),
          'login-page'
        );
        break;
      case '/privacy':
        success = await validateImport(
          () => import('@/components/features/privacy/privacy-policy-page'),
          'privacy-policy-page'
        );
        break;
      case '/terms':
        success = await validateImport(
          () => import('@/components/features/privacy/terms-page'),
          'terms-page'
        );
        break;
      case '/data-request':
        success = await validateImport(
          () => import('@/components/features/privacy/data-request-page'),
          'data-request-page'
        );
        break;
      default:
        // For dynamic routes like /owner/repo, prefetch the main repo view
        if (routePath.match(/^\/[\w-]+\/[\w-]+$/)) {
          success = await validateImport(
            () => import('@/components/features/repository/repo-view'),
            'repo-view'
          );
        }
        // For org routes
        else if (routePath.match(/^\/orgs\/[\w-]+$/)) {
          success = await validateImport(() => import('@/pages/org-view'), 'org-view');
        }
        break;
    }

    // Only mark as prefetched if successful
    if (success) {
      prefetchedRoutes.add(routePath);
    }
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
  routes.forEach((route) => prefetchRoute(route));
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
  const criticalRoutes = ['/changelog', '/docs', '/feed'];

  // Delay prefetching to avoid competing with initial render
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      () => {
        prefetchRoutes(criticalRoutes);
      },
      { timeout: 5000 }
    );
  } else {
    setTimeout(() => {
      prefetchRoutes(criticalRoutes);
    }, 2000);
  }
};

/**
 * Clear the prefetch cache
 * Useful for memory management in long-running sessions
 */
export const clearPrefetchCache = () => {
  prefetchedRoutes.clear();
};

/**
 * Get current cache size for monitoring
 */
export const getPrefetchCacheSize = () => {
  return prefetchedRoutes.size;
};
