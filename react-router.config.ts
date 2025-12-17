import type { Config } from '@react-router/dev/config';

export default {
  // Enable SSR for better LCP performance
  ssr: true,

  // Note: prerender disabled due to known bug with @netlify/vite-plugin-react-router
  // See: https://github.com/remix-run/react-router/issues/14096
  // SSR still provides LCP benefits without static pre-rendering

  // App directory contains route files
  appDirectory: 'app',

  // Build directory for output
  buildDirectory: 'build',
} satisfies Config;
