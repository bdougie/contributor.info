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
      // Only exclude story and test files, not their dependencies
      external: (id) => {
        // Only mark actual story/test files as external, not their dependencies
        return id.endsWith('.stories.ts') || 
               id.endsWith('.stories.tsx') || 
               id.endsWith('.test.ts') || 
               id.endsWith('.test.tsx') ||
               id.includes('/__tests__/') ||
               id.includes('/__mocks__/');
      },
      output: {
        // Ensure proper file extensions for module recognition
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Performance-optimized chunking strategy for better LCP
        manualChunks: (id) => {
          // Critical path - keep minimal for fast LCP
          if (id.includes('react/') || id.includes('react-dom/')) {
            return 'react-core';
          }
          
          // Router and essential utilities - defer but keep small
          if (id.includes('react-router-dom') || id.includes('class-variance-authority') || 
              id.includes('clsx') || id.includes('tailwind-merge')) {
            return 'react-router';
          }
          
          // Heavy chart libraries - lazy load completely
          if (id.includes('@nivo') || id.includes('recharts') || id.includes('d3-')) {
            return 'charts';
          }
          
          // UI components - split into smaller chunks
          if (id.includes('@radix-ui/react-dialog') || id.includes('@radix-ui/react-dropdown-menu')) {
            return 'ui-overlay';
          }
          if (id.includes('@radix-ui/react-select') || id.includes('@radix-ui/react-popover')) {
            return 'ui-interactive';
          }
          if (id.includes('@radix-ui/')) {
            return 'ui-base';
          }
          
          // Icons - separate for tree-shaking
          if (id.includes('lucide-react')) {
            return 'icons';
          }
          
          // Date and validation libraries - defer
          if (id.includes('date-fns') || id.includes('zod')) {
            return 'utils';
          }
          
          // State and data - defer
          if (id.includes('zustand') || id.includes('@supabase/')) {
            return 'data';
          }
          
          // Analytics - completely defer
          if (id.includes('posthog') || id.includes('@sentry/')) {
            return 'analytics';
          }
          
          // Node modules fallback
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
    target: 'es2022', // More modern target for better tree-shaking
    // Optimize chunk size warnings  
    chunkSizeWarningLimit: 600, // Slightly more lenient given postmortem learnings
    // Enable compression reporting
    reportCompressedSize: true,
    // Module preload optimization for better LCP
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_, deps) => {
        // Only preload absolutely critical chunks for fast LCP
        return deps.filter(dep => 
          dep.includes('react-core') ||
          dep.includes('react-router') ||
          // Exclude everything else from preloading
          (!dep.includes('analytics') && 
           !dep.includes('charts') && 
           !dep.includes('ui-') && 
           !dep.includes('data') && 
           !dep.includes('utils') && 
           !dep.includes('icons') &&
           !dep.includes('vendor') &&
           !dep.includes('test') &&
           !dep.includes('storybook'))
        );
      }
    },
  },
  css: {
    devSourcemap: true,
  },
});
