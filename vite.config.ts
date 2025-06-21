import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  plugins: [
    react(),
    imagetools({
      defaultDirectives: (url) => {
        // Only process images with query parameters
        if (url.searchParams.has('webp')) {
          return new URLSearchParams({
            format: 'webp',
            quality: '80'
          });
        }
        if (url.searchParams.has('avif')) {
          return new URLSearchParams({
            format: 'avif',
            quality: '70'
          });
        }
        return new URLSearchParams();
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Improve CSS optimization
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: (id) => {
          // Core React and routing
          if (id.includes('react') && !id.includes('react-dom') && !id.includes('react-router')) {
            return 'react';
          }
          if (id.includes('react-dom')) {
            return 'react-dom';
          }
          if (id.includes('react-router')) {
            return 'routing';
          }
          
          // UI components library (Radix UI)
          if (id.includes('@radix-ui') || id.includes('class-variance-authority') || 
              id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'ui';
          }
          
          // Heavy visualization libraries
          if (id.includes('@nivo') || id.includes('recharts') || id.includes('@react-spring')) {
            return 'charts';
          }
          
          // Data and utility libraries
          if (id.includes('date-fns') || id.includes('zod') || 
              id.includes('zustand') || id.includes('@supabase/supabase-js')) {
            return 'utils';
          }
          
          // Form handling
          if (id.includes('react-hook-form') || id.includes('@hookform/resolvers')) {
            return 'forms';
          }
          
          // Content and markdown
          if (id.includes('react-markdown') || id.includes('react-helmet-async')) {
            return 'content';
          }
          
          // Analytics and monitoring
          if (id.includes('posthog-js') || id.includes('@sentry/react')) {
            return 'analytics';
          }
          
          // Icons (split separately to enable tree-shaking)
          if (id.includes('lucide-react') || id.includes('react-icons') || 
              id.includes('@radix-ui/react-icons')) {
            return 'icons';
          }
          
          // Other frequently used node_modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
      // Tree shake unused code more aggressively  
      treeshake: {
        preset: 'recommended',
        moduleSideEffects: false,
      },
    },
    // Optimize CSS minification
    cssMinify: 'esbuild',
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Optimize minification
    minify: 'esbuild',
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 500,
    // Enable compression reporting
    reportCompressedSize: true,
  },
  css: {
    devSourcemap: true,
  },
});
