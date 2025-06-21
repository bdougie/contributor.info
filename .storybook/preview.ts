import type { Preview } from '@storybook/react-vite'
import '../src/index.css'
import { theme } from './theme'

// Mock environment variables for Storybook
if (!import.meta.env.VITE_SUPABASE_URL) {
  (globalThis as any).import = (globalThis as any).import || {};
  (globalThis as any).import.meta = (globalThis as any).import.meta || {};
  (globalThis as any).import.meta.env = {
    ...(globalThis as any).import.meta.env,
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'mock-anon-key',
    MODE: 'test',
    DEV: false,
    PROD: false,
    SSR: false
  };
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
      // Enhanced controls panel styling
      expanded: true,
      sort: 'requiredFirst',
    },
    // Apply custom theme to docs
    docs: {
      theme: theme,
    },
    // Custom backgrounds that match our app theme
    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#ffffff',
        },
        {
          name: 'secondary',
          value: '#f5f5f5',
        },
        {
          name: 'dark',
          value: '#0a0a0a',
        },
      ],
    },
    // Apply global styling
    layout: 'centered',
    // Enhanced viewport options
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: {
            width: '375px',
            height: '667px',
          },
        },
        tablet: {
          name: 'Tablet',
          styles: {
            width: '768px',
            height: '1024px',
          },
        },
        desktop: {
          name: 'Desktop',
          styles: {
            width: '1200px',
            height: '800px',
          },
        },
        wide: {
          name: 'Wide Screen',
          styles: {
            width: '1440px',
            height: '900px',
          },
        },
        socialCard: {
          name: 'Social Card (1200x630)',
          styles: {
            width: '1200px',
            height: '630px',
          },
        },
      },
    },
    // Test environment enhancements
    test: {
      // Reduce animation duration for faster tests
      dangerouslyIgnoreTestErrors: false,
      // Clear isolation for portal components
      clearMocks: true,
    },
    // Actions configuration for better test feedback
    actions: {
      argTypesRegex: "^on[A-Z].*",
      // Enhanced action logging for tests
      depth: 3,
      clearOnStoryChange: true,
    },
    // Enhanced accessibility testing configuration
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          // Disable problematic rules for portal components
          {
            id: 'aria-hidden-focus',
            enabled: false,
          },
          {
            id: 'focus-order-semantics',
            enabled: false,
          },
          // Custom rules for our component library
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'keyboard-navigation',
            enabled: true,
          },
          {
            id: 'aria-labels',
            enabled: true,
          },
        ],
      },
      options: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        },
        restoreScroll: true,
        // Enhanced reporting
        reporter: 'v2',
        // Include incomplete results for better debugging
        resultTypes: ['violations', 'incomplete', 'inapplicable', 'passes'],
      },
      // Manual accessibility testing mode
      manual: true,
    },
  },
  // Global decorators for test environment
  decorators: [
    (Story, context) => {
      // Test environment detection
      const isTestEnvironment = window.location.search.includes('test-runner') || 
                               window.navigator.userAgent.includes('Playwright');
      
      if (isTestEnvironment) {
        // Add test-specific attributes to root for better debugging
        const root = document.getElementById('storybook-root');
        if (root) {
          root.setAttribute('data-test-environment', 'true');
          root.setAttribute('data-story-id', context.id);
          // Ensure focus visibility in tests
          root.style.setProperty('--focus-ring-width', '2px');
          root.style.setProperty('--focus-ring-color', '#0066cc');
        }
      }
      
      // Setup window mock for Zustand stores and other window-dependent code
      if (typeof window !== 'undefined') {
        // Ensure window.innerWidth is available for responsive Zustand stores
        if (!window.innerWidth) {
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 1200, // Default desktop width for Storybook
          });
        }
        
        // Mock window.addEventListener if needed for stores
        const originalAddEventListener = window.addEventListener;
        window.addEventListener = function(type, listener, options) {
          // Only add listeners we care about, ignore others to prevent issues
          if (type === 'resize' || type === 'load') {
            return originalAddEventListener.call(this, type, listener, options);
          }
          return originalAddEventListener.call(this, type, listener, options);
        };
      }
      
      return Story();
    },
  ],
};

export default preview;