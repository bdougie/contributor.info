/**
 * Lighthouse CI Configuration
 *
 * Environment Variables:
 * - DEPLOY_URL: Optional URL of a deployed preview (e.g., from Netlify/Vercel)
 *
 * Modes:
 * - With DEPLOY_URL: Tests against the deployed preview
 * - Without DEPLOY_URL: Starts local preview server and tests against it
 */

// Use deployed URL if provided, otherwise use local preview server
const deployUrl = process.env.DEPLOY_URL;
const useLocalServer = !deployUrl;

export default {
  ci: {
    collect: {
      // Explicitly disable staticDistDir auto-detection - we use preview server instead
      staticDistDir: undefined,
      // Use preview server for local/CI testing, URLs for deployed environments
      ...(useLocalServer
        ? {
            startServerCommand: 'npm run preview',
            startServerReadyPattern: 'Local:',
            startServerReadyTimeout: 30000,
            url: ['http://localhost:4173'],
          }
        : {
            url: [deployUrl, `${deployUrl}/vercel/next.js`, `${deployUrl}/continuedev/continue`],
          }),
      numberOfRuns: useLocalServer ? 1 : 3,
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'first-contentful-paint': ['error', { maxNumericValue: 1800 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        interactive: ['warn', { maxNumericValue: 3800 }],

        // Performance
        'speed-index': ['warn', { maxNumericValue: 3400 }],

        // Best practices
        'uses-http2': 'off',
        'uses-long-cache-ttl': 'off',

        // Accessibility
        'color-contrast': 'warn',

        // Budget
        'resource-summary:script:size': ['error', { maxNumericValue: 350000 }],
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 100000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }],
        'resource-summary:total:size': ['error', { maxNumericValue: 2000000 }],

        // Categories
        'categories:performance': ['error', { minScore: 0.85 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
