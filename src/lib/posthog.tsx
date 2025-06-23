import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'

// Defer PostHog initialization to improve initial load performance
let isPostHogInitialized = false;

const initializePostHog = () => {
  if (typeof window !== 'undefined' && !isPostHogInitialized) {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY || '', {
      api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // We'll handle this manually
      capture_pageleave: true,
      // Delay initialization slightly to not block initial render
      loaded: () => {
        isPostHogInitialized = true;
      }
    })
  }
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Defer PostHog initialization until after initial render and page load
    const initializeAfterLoad = () => {
      const timer = setTimeout(() => {
        initializePostHog();
        
        // Capture pageview after initialization
        if (isPostHogInitialized) {
          posthog.capture('$pageview');
        }
      }, 100); // Small delay to let initial render complete

      return () => clearTimeout(timer);
    };

    // Wait for page load event or defer if already loaded
    if (document.readyState === 'complete') {
      initializeAfterLoad();
    } else {
      window.addEventListener('load', initializeAfterLoad, { once: true });
      return () => {
        window.removeEventListener('load', initializeAfterLoad);
      };
    }
  }, [])

  // Provide PostHog context even before initialization to prevent errors
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}

export { posthog }