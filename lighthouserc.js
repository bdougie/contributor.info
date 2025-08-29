/**
 * Lighthouse CI Configuration
 *
 * Environment Variables:
 * - LHCI_BUILD_CONTEXT__CURRENT_HASH: Set by Lighthouse CI in CI environments
 * - CI: Generic CI indicator (set to 'true' in most CI systems)
 * - DEPLOY_URL: The URL of the deployed preview (required in CI, e.g., from Netlify/Vercel)
 *
 * Local Development: Tests against built files at http://localhost:4173
 * CI: Tests against the deployed preview URL
 */

// Detect CI environment
const isCI = process.env.LHCI_BUILD_CONTEXT__CURRENT_HASH || process.env.CI === 'true';

// Get base URL - fail fast in CI if not provided to avoid testing wrong environment
const baseUrl = isCI ? process.env.DEPLOY_URL : 'http://localhost:4173';

// Fail fast in CI if no DEPLOY_URL is provided
if (isCI && !baseUrl) {
  console.error('Error: DEPLOY_URL environment variable is required in CI environments');
  process.exit(1);
}

module.exports = {
  ci: {
    collect: {
      // Use staticDistDir for local testing, URLs for CI
      ...(baseUrl.startsWith('http://localhost')
        ? { staticDistDir: './dist' }
        : {
            url: [baseUrl, `${baseUrl}/vercel/next.js`, `${baseUrl}/continuedev/continue`],
          }),
      numberOfRuns: baseUrl.startsWith('http://localhost') ? 1 : 3,
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
