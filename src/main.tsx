import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';

// Sentry removed - was causing React hooks conflicts

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

// Web vitals tracking removed - was causing React hooks conflicts


// Initialize app with proper provider pattern
const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);

// Render app without analytics
root.render(
  <StrictMode>
    <MetaTagsProvider>
      <SchemaMarkup />
      <App />
    </MetaTagsProvider>
  </StrictMode>
);
