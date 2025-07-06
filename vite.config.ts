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
        // Mobile-optimized chunking strategy
        manualChunks: (id) => {
          // Core React - highest priority for mobile
          if (id.includes('react') && !id.includes('react-router') && !id.includes('icons')) {
            return 'react-core';
          }
          
          // Essential routing and utilities - critical path for mobile
          if (id.includes('react-router-dom') || 
              id.includes('class-variance-authority') || 
              id.includes('clsx') || 
              id.includes('tailwind-merge')) {
            return 'react-ecosystem';
          }
          
          // Mobile-first UI components - split into smaller chunks
          if (id.includes('@radix-ui/react-dialog') ||
              id.includes('@radix-ui/react-dropdown-menu') ||
              id.includes('@radix-ui/react-popover')) {
            return 'ui-core';
          }
          
          if (id.includes('@radix-ui/react-select') ||
              id.includes('@radix-ui/react-tabs') ||
              id.includes('@radix-ui/react-tooltip') ||
              id.includes('@radix-ui/react-slot')) {
            return 'ui-extended';
          }
          
          // Lazy-loaded chart libraries - defer for mobile performance
          if (id.includes('@nivo/scatterplot') || 
              id.includes('@nivo/core')) {
            return 'charts-nivo';
          }
          
          if (id.includes('recharts')) {
            return 'charts-recharts';
          }
          
          // Icons - lazy load to reduce initial bundle
          if (id.includes('lucide-react') || id.includes('@radix-ui/react-icons')) {
            return 'icons';
          }
          
          // Utilities - group by usage pattern
          if (id.includes('date-fns') || id.includes('zod')) {
            return 'utils';
          }
          
          // Data layer - defer for mobile
          if (id.includes('zustand') || id.includes('@supabase/supabase-js')) {
            return 'data';
          }
          
          // Analytics - completely defer for mobile performance
          if (id.includes('posthog-js') || id.includes('@sentry/react')) {
            return 'analytics';
          }
          
          // Mobile-specific optimizations
          if (id.includes('html2canvas') || id.includes('react-markdown')) {
            return 'heavy-features';
          }
          
          // Form libraries - defer for mobile
          if (id.includes('react-hook-form') || id.includes('@hookform/resolvers')) {
            return 'forms';
          }
          
          // Additional Radix components - defer for mobile
          if (id.includes('@radix-ui/')) {
            return 'ui-radix-extended';
          }
          
          // Node modules - group remaining dependencies
          if (id.includes('node_modules')) {
            return 'vendor';
          }
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
    // Mobile-optimized module preload
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_, deps) => {
        // Only preload critical chunks for mobile performance
        return deps.filter(dep => {
          const criticalChunks = ['react-core', 'react-ecosystem', 'ui-core'];
          return criticalChunks.some(chunk => dep.includes(chunk)) ||
                 (!dep.includes('analytics') && 
                  !dep.includes('charts') && 
                  !dep.includes('heavy-features') &&
                  !dep.includes('forms') &&
                  !dep.includes('ui-radix-extended') &&
                  !dep.includes('test') &&
                  !dep.includes('storybook'));
        });
      }
    },
  },
  css: {
    devSourcemap: true,
  },
});
