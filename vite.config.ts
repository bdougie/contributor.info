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
        // Aggressive chunk splitting for optimal Core Web Vitals
        manualChunks: (id) => {
          // Core vendor chunks
          if (id.includes('node_modules')) {
            // React core - critical path
            if (id.includes('react') && !id.includes('react-')) {
              return 'react-core';
            }
            if (id.includes('react-dom')) {
              return 'react-core';
            }
            
            // React router - critical path  
            if (id.includes('react-router')) {
              return 'react-router';
            }
            
            // All Radix UI components - split by component type
            if (id.includes('@radix-ui')) {
              if (id.includes('dialog') || id.includes('popover') || id.includes('tooltip')) {
                return 'ui-overlays';
              }
              if (id.includes('dropdown') || id.includes('select') || id.includes('menu')) {
                return 'ui-menus';
              }
              if (id.includes('form') || id.includes('checkbox') || id.includes('radio') || id.includes('input')) {
                return 'ui-forms';
              }
              return 'ui-radix-misc';
            }
            
            // Charts - split by library
            if (id.includes('@nivo')) {
              return 'charts-nivo';
            }
            if (id.includes('recharts')) {
              return 'charts-recharts';
            }
            if (id.includes('d3-') || id.includes('d3/')) {
              return 'charts-d3';
            }
            
            // Markdown and code highlighting
            if (id.includes('react-markdown') || id.includes('remark') || id.includes('rehype')) {
              return 'markdown';
            }
            if (id.includes('highlight.js') || id.includes('prism')) {
              return 'syntax-highlighting';
            }
            
            // Icons
            if (id.includes('lucide-react') || id.includes('@radix-ui/react-icons')) {
              return 'icons';
            }
            
            // Data and API
            if (id.includes('@supabase')) {
              return 'supabase';
            }
            if (id.includes('@octokit') || id.includes('github')) {
              return 'github-api';
            }
            if (id.includes('zustand')) {
              return 'state-management';
            }
            
            // Form handling
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'forms';
            }
            
            // Date utilities
            if (id.includes('date-fns') || id.includes('dayjs')) {
              return 'date-utils';
            }
            
            // Validation
            if (id.includes('zod') || id.includes('yup')) {
              return 'validation';
            }
            
            // CSS-in-JS and styling
            if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'styling-utils';
            }
            
            // Web vitals and monitoring
            if (id.includes('web-vitals')) {
              return 'monitoring';
            }
            
            // PWA and service worker
            if (id.includes('workbox') || id.includes('service-worker')) {
              return 'pwa';
            }
            
            // Animation libraries
            if (id.includes('framer-motion') || id.includes('@react-spring')) {
              return 'animation';
            }
            
            // Testing libraries (shouldn't be in production but just in case)
            if (id.includes('vitest') || id.includes('@testing-library') || id.includes('jest')) {
              return 'testing';
            }
            
            // MDX
            if (id.includes('@mdx-js')) {
              return 'mdx';
            }
            
            // Netlify functions
            if (id.includes('@netlify')) {
              return 'netlify';
            }
            
            // Misc utilities
            if (id.includes('lodash') || id.includes('ramda')) {
              return 'utils-functional';
            }
            
            // Split remaining vendor by size
            // This prevents a single large vendor chunk
            const segments = id.split('/');
            const packageName = segments[segments.indexOf('node_modules') + 1];
            
            // Group smaller packages together, split large ones
            if (packageName.startsWith('@')) {
              // Scoped packages - use the scope as chunk name
              return `vendor-${packageName.substring(1)}`;
            }
            
            // Individual packages
            return `vendor-${packageName}`;
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
    // Module preload optimization - only preload critical path
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_, deps) => {
        // Preload critical path + essential charts for PR contributions (~85 KiB total)
        return deps.filter(dep => 
          dep.includes('react-core') || 
          dep.includes('react-ecosystem') ||
          dep.includes('charts-essential') || // Include essential PR contribution chart
          (!dep.includes('charts-advanced') && 
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
