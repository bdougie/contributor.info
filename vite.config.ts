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
    exclude: ['lucide-react'],
  },
  build: {
    // Improve CSS optimization
    cssCodeSplit: true,
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
          // Heavy chart libraries
          'charts': ['@nivo/scatterplot', 'recharts'],
          // Other dependencies
          'vendor': [
            'date-fns',
            'zod',
            'zustand',
            '@supabase/supabase-js',
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
