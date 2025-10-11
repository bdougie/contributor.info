import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './styles/cls-fixes.css'; // Global CLS fixes
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';
import { ErrorBoundary } from '@/components/error-boundary';
import { logger } from './lib/logger';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes default stale time
    },
  },
});

// Sentry removed - was causing React hooks conflicts

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
        logger.debug('Cache updated for:', message.url);
        // Could trigger a subtle UI update here
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
const root = createRoot(rootElement);

// Render app with React Query provider
root.render(
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
