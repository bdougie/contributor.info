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
    include: ['react', 'react-dom'],
    exclude: ['lucide-react'], // Keep icons separate for better tree-shaking
    force: true, // Force re-optimization for performance
  },
  build: {
    // Disable CSS code splitting to prevent FOUC
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Simple, reliable chunking strategy
        manualChunks: {
          // Bundle React with all React-related libraries to avoid initialization issues
          'react-vendor': [
            'react', 
            'react-dom', 
            'react-router-dom',
            '@radix-ui/react-slot',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          // Split chart libraries for better caching
          'charts-nivo': ['@nivo/scatterplot', '@nivo/core'],
          'charts-recharts': ['recharts'],
          // Separate Lucide icons for better tree-shaking
          'icons': ['lucide-react'],
          // Split heavy utilities
          'utils': ['date-fns', 'zod'],
          // Core vendor dependencies
          'vendor': [
            'zustand',
            '@supabase/supabase-js'
          ],
          // Analytics/monitoring (non-critical)
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
  },
  css: {
    devSourcemap: true,
  },
});
