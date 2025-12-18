import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './styles/cls-fixes.css'; // Global CLS fixes
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { logger } from './lib/logger';
import { initSentryAfterLoad, setupGlobalErrorHandlers } from './lib/sentry-lazy';
import { queryClient } from './lib/query-client';
import { shouldHydrate, markHydrationComplete, isSSRPage } from './lib/ssr-hydration';

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

// Initialize app with proper provider pattern
const rootElement = document.getElementById('root')!;

// App component wrapped with providers
const AppWithProviders = (
  <StrictMode>
    <ErrorBoundary context="Root Mount">
      <QueryClientProvider client={queryClient}>
        <MetaTagsProvider>
          <SchemaMarkup />
          <App />
        </MetaTagsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

// Use hydrateRoot for SSR pages, createRoot for SPA navigation
if (shouldHydrate()) {
  logger.debug('[SSR] Hydrating SSR content');
  hydrateRoot(rootElement, AppWithProviders, {
    onRecoverableError: (error) => {
      // Log hydration errors but don't crash
      logger.warn('[SSR] Hydration error (recovered):', error);
    },
  });
  // Mark hydration complete after React has finished initial render
  // Using requestIdleCallback to ensure React's async work completes first
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => markHydrationComplete());
  } else {
    setTimeout(() => markHydrationComplete(), 100);
  }
} else {
  // Standard SPA rendering
  if (isSSRPage()) {
    logger.debug('[SSR] SSR data detected but content empty, using createRoot');
  }
  const root = createRoot(rootElement);
  root.render(AppWithProviders);
}

// Initialize Sentry after app is rendered (non-blocking)
// This ensures Sentry doesn't impact initial page load
initSentryAfterLoad();
