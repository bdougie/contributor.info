import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { MetaTagsProvider } from './components/common/layout';
import { PHProvider } from './lib/posthog';
// Web vitals tracking loaded dynamically

// Dynamically import and initialize Sentry only in production
const initializeSentry = async () => {
  // Only initialize Sentry in production
  if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) {
    console.log('Sentry disabled in development mode');
    return;
  }
  
  try {
    // Dynamic import to exclude from initial bundle
    const { init, browserTracingIntegration, replayIntegration, addIntegration } = await import("@sentry/react");
    
    init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        browserTracingIntegration(),
        // Replay integration will be added later
      ],
      // Optimize performance monitoring for production
      tracesSampleRate: 0.01,
      replaysSessionSampleRate: 0.01,
      replaysOnErrorSampleRate: 0.1,
      sendDefaultPii: false,
      environment: 'production',
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

// Initialize Sentry after all critical resources have loaded (production only)
const deferSentryInit = () => {
  // Only defer Sentry initialization in production
  if (!import.meta.env.PROD) {
    return;
  }
  
  // Use requestIdleCallback if available for better performance
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      setTimeout(initializeSentry, 2000);
    }, { timeout: 10000 });
  } else {
    setTimeout(initializeSentry, 8000);
  }
};

// Wait for the page to be fully interactive before loading Sentry (production only)
if (import.meta.env.PROD) {
  if (document.readyState === 'complete') {
    deferSentryInit();
  } else {
    window.addEventListener('load', deferSentryInit, { once: true });
  }
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

// Initialize performance tracking after page interactive (non-blocking)
const initializeWebVitals = async () => {
  try {
    // Wait for page to be fully interactive
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(void 0);
      } else {
        window.addEventListener('load', () => resolve(void 0), { once: true });
      }
    });
    
    // Additional delay to not interfere with critical rendering
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Dynamically import and start web vitals tracking
    const { trackWebVitals, trackCustomMetrics } = await import('./lib/web-vitals');
    trackWebVitals();
    trackCustomMetrics();
  } catch (error) {
    console.warn('Failed to initialize web vitals tracking:', error);
  }
};

// Start web vitals initialization (non-blocking)
initializeWebVitals();


// Initialize app with proper provider pattern
const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

// Render once with analytics provider
root.render(
  <StrictMode>
    <MetaTagsProvider>
      <PHProvider>
        <App />
      </PHProvider>
    </MetaTagsProvider>
  </StrictMode>
);
