import { useEffect, createContext, useContext } from 'react'

// Create a lightweight context for PostHog
const PostHogContext = createContext<any>(null);

// Defer PostHog initialization to improve initial load performance
let posthogInstance: any = null;
let isPostHogInitialized = false;

const initializePostHog = async () => {
  if (typeof window !== 'undefined' && !isPostHogInitialized && !posthogInstance) {
    try {
      // Dynamic import to exclude from initial bundle
      const { default: posthog } = await import('posthog-js');
      
      posthog.init(import.meta.env.VITE_POSTHOG_KEY || '', {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll handle this manually
        capture_pageleave: true,
        // Delay initialization slightly to not block initial render
        loaded: () => {
          isPostHogInitialized = true;
          // Capture pageview after initialization
          posthog.capture('$pageview');
        }
      });
      
      posthogInstance = posthog;
    } catch (error) {
      console.warn('Failed to load PostHog:', error);
    }
  }
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Defer PostHog initialization until after all critical resources load
    const deferPostHogInit = () => {
      // Use requestIdleCallback if available for better performance
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => {
          setTimeout(initializePostHog, 1000);
        }, { timeout: 5000 });
      } else {
        setTimeout(initializePostHog, 3000);
      }
    };

    // Wait for page load event or defer if already loaded
    if (document.readyState === 'complete') {
      deferPostHogInit();
    } else {
      window.addEventListener('load', deferPostHogInit, { once: true });
    }
  }, [])

  // Provide PostHog context even before initialization to prevent errors
  return (
    <PostHogContext.Provider value={posthogInstance}>
      {children}
    </PostHogContext.Provider>
  );
}

// Hook to use PostHog safely
export const usePostHog = () => {
  return useContext(PostHogContext);
};

// Export posthog for backward compatibility
export const posthog = {
  capture: (...args: any[]) => {
    if (posthogInstance) {
      return posthogInstance.capture(...args);
    }
  },
  identify: (...args: any[]) => {
    if (posthogInstance) {
      return posthogInstance.identify(...args);
    }
  },
  reset: (...args: any[]) => {
    if (posthogInstance) {
      return posthogInstance.reset(...args);
    }
  }
};