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
    include: [
      'react', 
      'react-dom',
      'react-router-dom',
      '@radix-ui/react-slot',
      'class-variance-authority',
      'clsx',
      'tailwind-merge'
    ],
    exclude: ['lucide-react'], // Keep icons separate for better tree-shaking
    force: true, // Force re-optimization for performance
  },
  build: {
    // Disable CSS code splitting to prevent FOUC
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Performance-optimized chunking strategy that maintains reliability
        manualChunks: {
          // Critical React core - bundle together to prevent initialization issues
          'react-core': [
            'react', 
            'react-dom',
            '@radix-ui/react-slot' // Essential for UI components
          ],
          // React ecosystem - can load after core is initialized
          'react-ecosystem': [
            'react-router-dom',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          // Heavy chart libraries - lazy loaded, separate for better caching
          'charts-nivo': ['@nivo/scatterplot', '@nivo/core'],
          'charts-recharts': ['recharts'],
          // UI component library - used throughout app
          'ui-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip'
          ],
          // Icons - separate for optimal tree-shaking
          'icons': ['lucide-react'],
          // Utilities - frequently used, good for caching
          'utils': ['date-fns', 'zod'],
          // State management and data
          'data': [
            'zustand',
            '@supabase/supabase-js'
          ],
          // Analytics - non-critical, can load later
          'analytics': [
            'posthog-js',
            '@sentry/react'
          ]
        },
      },
    },
    // Optimize CSS minification
    cssMinify: 'esbuild',
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Optimize minification and target
    minify: 'esbuild',
    target: 'es2020', // Modern target for better optimization while maintaining compatibility
    // Optimize chunk size warnings  
    chunkSizeWarningLimit: 600, // Slightly more lenient given postmortem learnings
    // Enable compression reporting
    reportCompressedSize: true,
    // Module preload optimization for better loading performance
    modulePreload: {
      polyfill: true,
    },
  },
  css: {
    devSourcemap: true,
  },
  server: {
    proxy: {
      '/api/dub': {
        target: 'https://api.dub.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/dub/, ''),
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      },
    },
  },
});
