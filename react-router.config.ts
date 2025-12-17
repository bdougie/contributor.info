import type { Config } from '@react-router/dev/config';

export default {
  // Enable SSR for server-side rendering
  ssr: true,

  // Pre-render static pages at build time for better LCP
  async prerender() {
    return [
      '/', // Homepage
      '/trending', // Trending repos page
      '/privacy', // Privacy policy
      '/terms', // Terms of service
      '/changelog', // Changelog
    ];
  },

  // App directory contains route files
  appDirectory: 'app',

  // Build directory for output
  buildDirectory: 'build',
} satisfies Config;
