import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
// Analytics provider loaded dynamically
import { MetaTagsProvider } from './components/common/layout';
// Web vitals tracking loaded dynamically

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

// Initialize app without analytics in critical path
const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

// Add global error tracking for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  window.jsErrors = window.jsErrors || [];
  window.jsErrors.push({
    message: event.error?.message || event.message,
    filename: event.filename,
    lineno: event.lineno,
    stack: event.error?.stack
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  window.jsErrors = window.jsErrors || [];
  window.jsErrors.push({
    message: 'Unhandled promise rejection: ' + (event.reason?.message || event.reason),
    type: 'promise'
  });
});

// Render immediately without analytics provider
try {
  root.render(
    <StrictMode>
      <MetaTagsProvider>
        <App />
      </MetaTagsProvider>
    </StrictMode>
  );
  console.log('React app rendered successfully');
} catch (error) {
  console.error('Failed to render React app:', error);
  // Fallback rendering
  rootElement.innerHTML = '<div style="padding: 20px;">App failed to load. Check console for errors.</div>';
}

// Add analytics after page becomes interactive
const initializeAnalytics = async () => {
  try {
    
    // Wait for page to be interactive
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve(void 0);
      } else {
        window.addEventListener('load', () => resolve(void 0), { once: true });
      }
    });
    
    // Additional delay to ensure critical content is rendered
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Dynamically import and wrap with analytics
    const { PHProvider } = await import('./lib/posthog');
    
    // Re-render with analytics provider
    root.render(
      <StrictMode>
        <MetaTagsProvider>
          <PHProvider>
            <App />
          </PHProvider>
        </MetaTagsProvider>
      </StrictMode>
    );
  } catch (error) {
    console.warn('Failed to initialize analytics provider:', error);
  }
};

// Start analytics initialization (non-blocking)
initializeAnalytics();
