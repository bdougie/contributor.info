import type { Config } from '@react-router/dev/config';

export default {
  // Enable SSR for better LCP performance
  ssr: true,

  // Pre-render static pages at build time for instant loading
  async prerender() {
    return ['/', '/trending', '/privacy', '/terms', '/changelog', '/login'];
  },

  // App directory contains route files
  appDirectory: 'app',

  // Build directory for output
  buildDirectory: 'build',
} satisfies Config;
