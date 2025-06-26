import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App';
import './index.css';
import { PHProvider } from './lib/posthog';
import { MetaTagsProvider } from './components/common/layout';
import { trackWebVitals, trackCustomMetrics } from './lib/web-vitals';

// Defer Sentry initialization to minimize impact on critical rendering path
if (import.meta.env.VITE_SENTRY_DSN) {
  const initializeSentry = () => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      integrations: [
        Sentry.browserTracingIntegration(),
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
      Sentry.addIntegration(Sentry.replayIntegration());
    }, 2000); // Increased delay for replay integration
  };

  // Initialize Sentry much later to not impact performance score
  if (document.readyState === 'complete') {
    setTimeout(initializeSentry, 5000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(initializeSentry, 5000);
    }, { once: true });
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

// Initialize performance tracking
trackWebVitals();
trackCustomMetrics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MetaTagsProvider>
      <PHProvider>
        <App />
      </PHProvider>
    </MetaTagsProvider>
  </StrictMode>
);
