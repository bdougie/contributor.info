import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/cls-fixes.css'; // Global CLS fixes
import { MetaTagsProvider, SchemaMarkup } from './components/common/layout';

// Sentry removed - was causing React hooks conflicts

// TEMPORARILY DISABLED: Service worker causing stale cache issues
// Will re-enable after implementing proper cache versioning
// if ('serviceWorker' in navigator && import.meta.env.PROD) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then(registration => {
//         console.log('SW registered: ', registration);
//       })
//       .catch(registrationError => {
//         console.log('SW registration failed: ', registrationError);
//       });
//   });
// }

// Unregister existing service workers to clear stale cache
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    for(let registration of registrations) {
      registration.unregister();
      console.log('SW unregistered to clear cache');
    }
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
