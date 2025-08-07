import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  base: '/',
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
    commonjsOptions: {
      // Better handling of CommonJS modules (like some D3 packages)
      transformMixedEsModules: true,
      strictRequires: 'auto'
    },
    rollupOptions: {
      // Remove the external configuration as it's causing build issues
      output: {
        // Ensure proper module format
        format: 'es',
        // Use proper ES module syntax
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          arrowFunctions: true
        },
        // Ensure proper file extensions for module recognition
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Ensure modules are properly hoisted
        hoistTransitiveImports: false,
        // Aggressive chunk splitting for optimal Core Web Vitals
        manualChunks: (id) => {
          // Core vendor chunks
          if (id.includes('node_modules')) {
            // React MUST be in its own chunk and load first
            // This includes react, react-dom, and scheduler
            if (id.includes('react-dom') || id.includes('scheduler')) {
              return 'react-core';
            }
            if (id.includes('react') && !id.includes('react-')) {
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
            
            // Don't split chart libraries - they cause too many issues
            // Just let them fall through to vendor-misc naturally
            
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
            
            // Animation libraries - bundle with React ecosystem to avoid loading issues
            if (id.includes('framer-motion') || id.includes('@react-spring')) {
              return 'vendor-react-ecosystem';
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
            
            // Group remaining packages by common patterns to avoid too many chunks
            // while preventing module loading order issues
            
            // Common utility libraries
            if (id.includes('axios') || id.includes('ky') || id.includes('got')) {
              return 'vendor-http';
            }
            
            // Smaller React ecosystem packages
            if (id.includes('react-') || id.includes('use-')) {
              return 'vendor-react-ecosystem';
            }
            
            // Everything else in a misc chunk
            return 'vendor-misc';
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
    chunkSizeWarningLimit: 1000, // Accepting larger chunks for reliability over micro-optimizations
    // Enable compression reporting
    reportCompressedSize: true,
    // Module preload optimization - ensure React loads first
    modulePreload: {
      polyfill: true, // Enable polyfill for proper module loading
      resolveDependencies: (_, deps) => {
        // Preload React core first, then router
        const sorted = deps.sort((a, b) => {
          if (a.includes('react-core')) return -1;
          if (b.includes('react-core')) return 1;
          if (a.includes('react-router')) return -1;
          if (b.includes('react-router')) return 1;
          return 0;
        });
        // Only preload critical chunks
        return sorted.filter(dep => 
          dep.includes('react-core') || 
          dep.includes('react-router')
        );
      }
    },
  },
  css: {
    devSourcemap: true,
  },
});
