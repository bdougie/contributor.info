import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PHProvider } from './lib/posthog';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PHProvider>
      <App />
    </PHProvider>
  </StrictMode>
);
