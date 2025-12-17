import type { Config } from '@react-router/dev/config';

export default {
  // Disable SSR for now - use client-side rendering only
  // SSR requires additional Netlify function infrastructure that needs more setup
  // TODO: Re-enable SSR once server function is properly configured
  ssr: false,

  // Pre-rendering disabled until SSR infrastructure is complete
  // async prerender() {
  //   return ['/', '/trending', '/privacy', '/terms', '/changelog'];
  // },

  // App directory contains route files
  appDirectory: 'app',

  // Build directory for output
  buildDirectory: 'build',
} satisfies Config;
