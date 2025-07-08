import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { PHProvider } from './lib/posthog';
import { MetaTagsProvider } from './components/common/layout';
import { trackWebVitals, trackCustomMetrics } from './lib/web-vitals';

// Dynamically import and initialize Sentry only when needed
const initializeSentry = async () => {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  
  try {
    // Dynamic import to exclude from initial bundle
    const { init, browserTracingIntegration, replayIntegration, addIntegration } = await import("@sentry/react");
    
    init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        browserTracingIntegration(),
        // Replay integration will be added later
      ],
      // Optimize performance monitoring
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.01 : 1.0,
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 0.1,
      sendDefaultPii: false,
      environment: import.meta.env.MODE,
      beforeSend: (event) => {
        // Filter out events that might impact performance
        return event;
      }
    });

    // Further defer replay integration initialization
    setTimeout(() => {
      addIntegration(replayIntegration());
    }, 3000); // Increased delay for replay integration
  } catch (error) {
    console.warn('Failed to initialize Sentry:', error);
  }
};

// Initialize Sentry after all critical resources have loaded
const deferSentryInit = () => {
  // Use requestIdleCallback if available for better performance
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      setTimeout(initializeSentry, 2000);
    }, { timeout: 10000 });
  } else {
    setTimeout(initializeSentry, 8000);
  }
};

// Wait for the page to be fully interactive before loading Sentry
if (document.readyState === 'complete') {
  deferSentryInit();
} else {
  window.addEventListener('load', deferSentryInit, { once: true });
}

// Register service worker for performance optimization
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Initialize performance tracking (defer slightly to not block initial render)
setTimeout(() => {
  trackWebVitals();
  trackCustomMetrics();
}, 100);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MetaTagsProvider>
      <PHProvider>
        <App />
      </PHProvider>
    </MetaTagsProvider>
  </StrictMode>
);
