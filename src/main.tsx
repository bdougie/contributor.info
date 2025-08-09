import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/cls-fixes.css'; // Global CLS fixes
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';

// Sentry removed - was causing React hooks conflicts

// Enable service worker for offline support
// Works in both dev and prod for testing offline functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
        
        // Check for updates on page focus
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available, notify user
                console.log('New content available, refresh to update');
              }
            });
          }
        });
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
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
