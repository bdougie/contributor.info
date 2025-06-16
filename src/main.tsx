import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.tsx';
import './index.css';
import { PHProvider } from './lib/posthog';
import { MetaTagsProvider } from './components/common/layout';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of transactions for performance monitoring
  // Session Replay
  replaysSessionSampleRate: 0.1, // Sample 10% of sessions
  replaysOnErrorSampleRate: 1.0, // Sample 100% of sessions with errors
  // Setting this option to true will send default PII data to Sentry
  sendDefaultPii: true,
  environment: import.meta.env.MODE,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MetaTagsProvider>
      <PHProvider>
        <App />
      </PHProvider>
    </MetaTagsProvider>
  </StrictMode>
);
