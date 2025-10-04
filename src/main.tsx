import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/cls-fixes.css'; // Global CLS fixes
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';
import { ErrorBoundary } from '@/components/error-boundary';

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
        console.log('Connection restored');
        // Could show a toast notification here
      } else {
        console.log('Connection lost - offline mode active');
        // Could show offline indicator
      }
    });

    // Listen for cache updates
    swClient.on('CACHE_UPDATED', (message) => {
      if (message.type === 'CACHE_UPDATED') {
        console.log('Cache updated for:', message.url);
        // Could trigger a subtle UI update here
      }
    });

    // Listen for background sync
    swClient.on('BACKGROUND_SYNC', (message) => {
      if (message.type === 'BACKGROUND_SYNC') {
        console.log('Background sync:', message.status);
      }
    });
  });
}

// In development, unregister any existing service worker
if ('serviceWorker' in navigator && !import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('SW unregistered for development');
    });
  });
}

// Web vitals tracking removed - was causing React hooks conflicts

// Initialize app with proper provider pattern
const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

// Render app without analytics
root.render(
  <StrictMode>
    <ErrorBoundary context="Root Mount">
      <MetaTagsProvider>
        <SchemaMarkup />
        <App />
      </MetaTagsProvider>
    </ErrorBoundary>
  </StrictMode>
);
