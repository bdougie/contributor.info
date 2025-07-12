import path from 'path';
import react from '@vitejs/plugin-react-swc';
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
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
    // Narrow extensions list to reduce filesystem checks
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
  },
  server: {
    // Warm up frequently used files for better dev performance
    warmup: {
      clientFiles: [
        './src/main.tsx',
        './src/App.tsx',
        './src/components/ui/**/*',
        './src/lib/supabase.ts',
        './src/lib/github.ts'
      ]
    }
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@radix-ui/react-slot',
      '@radix-ui/react-avatar',
      '@radix-ui/react-dropdown-menu',
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
        entryFileNames: (chunkInfo) => {
          // Force .js extension for all entry files, including App
          const name = chunkInfo.name?.replace(/\.tsx?$/, '') || 'chunk';
          return `assets/${name}-[hash].js`;
        },
        chunkFileNames: (chunkInfo) => {
          // Force .js extension for all chunk files
          return `assets/${chunkInfo.name}-[hash].js`;
        },
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Proven chunk splitting strategy from LIGHTHOUSE_OPTIMIZATIONS.md
        manualChunks: {
          // Core React - keep together for stability (Critical Path)
          'react-core': ['react', 'react-dom'],
          
          // Router and utilities (Critical Path)
          'react-ecosystem': [
            'react-router-dom',
            'class-variance-authority',
            'clsx',
            'tailwind-merge'
          ],
          
          // UI library - deferred loading when UI components needed
          'ui-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-slot'
          ],
          
          // Essential charts for PR contributions (Critical Path)
          'charts-essential': [
            '@nivo/scatterplot'  // Main PR contribution chart
          ],
          
          // Advanced visualization libraries - lazy loaded on chart pages
          'charts-advanced': [
            'recharts'  // Distribution analysis charts
          ],
          
          // Icons - lazy loaded
          'icons': ['lucide-react'],
          
          // Utilities
          'utils': ['date-fns', 'zod'],
          
          // Data and state - deferred
          'data': ['zustand', '@supabase/supabase-js'],
          
          // Analytics - completely deferred
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
    // Module preload optimization - only preload critical path
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_, deps) => {
        // Preload critical path + essential charts for PR contributions (~85 KiB total)
        return deps.filter(dep => 
          dep.includes('react-core') || 
          dep.includes('react-ecosystem') ||
          dep.includes('charts-essential') || // Include essential PR contribution chart
          (!dep.includes('analytics') && 
           !dep.includes('charts-advanced') && 
           !dep.includes('ui-radix') &&
           !dep.includes('icons') &&
           !dep.includes('data') &&
           !dep.includes('utils') &&
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
