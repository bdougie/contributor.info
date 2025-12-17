import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StartClient } from '@tanstack/react-start/client';
import { router } from './router';
import './index.css';
import './styles/cls-fixes.css'; // Global CLS fixes
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { logger } from './lib/logger';
import { initSentryAfterLoad, setupGlobalErrorHandlers } from './lib/sentry-lazy';
import { queryClient } from './lib/query-client';

// Set up lightweight global error handlers (non-blocking)
setupGlobalErrorHandlers();

// Import service worker client for enhanced caching
import { swClient } from './lib/service-worker-client';

// Enable enhanced service worker for optimal performance (production only)
// Disabled in development to prevent caching issues
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // The service worker client handles registration internally
    // It will use sw-enhanced.js with aggressive caching strategies

    // Set up connection change handler for offline support
    swClient.onConnectionChange((online) => {
      if (online) {
        logger.info('Connection restored');
        // Could show a toast notification here
      } else {
        logger.info('Connection lost - offline mode active');
        // Could show offline indicator
      }
    });

    // Listen for cache updates
    swClient.on('CACHE_UPDATED', (message) => {
      if (message.type === 'CACHE_UPDATED') {
        // Cache updates happen silently in the background
        // Could trigger a subtle UI update here if needed
      }
    });

    // Listen for background sync
    swClient.on('BACKGROUND_SYNC', (message) => {
      if (message.type === 'BACKGROUND_SYNC') {
        logger.debug('Background sync:', message.status);
      }
    });
  });
}

// In development, unregister any existing service worker
if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      logger.debug('SW unregistered for development');
    });
  });
}

// Web vitals tracking removed - was causing React hooks conflicts

// Initialize app with TanStack Start
const rootElement = document.getElementById('root')!;

// Check if we're hydrating SSR content or doing client-side rendering
if (rootElement.hasChildNodes()) {
  // Hydrate SSR content
  hydrateRoot(
    rootElement,
    <StrictMode>
      <ErrorBoundary context="Root Mount">
        <QueryClientProvider client={queryClient}>
          <MetaTagsProvider>
            <SchemaMarkup />
            <StartClient router={router} />
          </MetaTagsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  // Client-side rendering
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary context="Root Mount">
        <QueryClientProvider client={queryClient}>
          <MetaTagsProvider>
            <SchemaMarkup />
            <StartClient router={router} />
          </MetaTagsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

// Initialize Sentry after app is rendered (non-blocking)
// This ensures Sentry doesn't impact initial page load
initSentryAfterLoad();
