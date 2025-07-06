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
    exclude: [
      'lucide-react', // Keep icons separate for better tree-shaking
      '@storybook/test',
      '@storybook/react',
      'vitest',
      '@testing-library/react',
      '@testing-library/jest-dom'
    ],
    force: true, // Force re-optimization for performance
  },
  build: {
    // Enable CSS code splitting for better performance
    cssCodeSplit: true,
    rollupOptions: {
      // Remove the external configuration as it's causing build issues
      output: {
        // Ensure proper file extensions for module recognition
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Simplified, more stable chunking strategy
        manualChunks: {
          // Core React - keep together for stability
          'react-core': ['react', 'react-dom'],
          
          // Router and utilities
          'react-ecosystem': [
            'react-router-dom',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          
          // UI library - keep reasonably sized chunks
          'ui-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slot'
          ],
          
          // Charts - separate for lazy loading
          'charts': [
            '@nivo/scatterplot', 
            '@nivo/core',
            'recharts'
          ],
          
          // Icons
          'icons': ['lucide-react'],
          
          // Utilities
          'utils': ['date-fns', 'zod'],
          
          // Data and state
          'data': ['zustand', '@supabase/supabase-js'],
          
          // Analytics - defer these
          'analytics': ['posthog-js', '@sentry/react']
        },
      },
    },
    // Optimize CSS minification
    cssMinify: 'esbuild',
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Optimize minification and target for better compression
    minify: 'esbuild',
    target: 'es2020', // Modern target with good compatibility
    // Optimize chunk size warnings  
    chunkSizeWarningLimit: 600, // Slightly more lenient given postmortem learnings
    // Enable compression reporting
    reportCompressedSize: true,
    // Module preload optimization
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_, deps) => {
        // Don't preload heavy chunks to improve initial load
        return deps.filter(dep => 
          !dep.includes('analytics') && 
          !dep.includes('charts') && 
          !dep.includes('test') &&
          !dep.includes('storybook')
        );
      }
    },
  },
  css: {
    devSourcemap: true,
  },
});
