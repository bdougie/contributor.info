import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig(() => ({
  base: '/',
  plugins: [
    react(),
    imagetools({
      defaultDirectives: (url) => {
        // Process images for WebP optimization
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
        // Auto-generate WebP versions for all static images
        if (url.searchParams.has('optimize')) {
          return new URLSearchParams({
            format: 'webp;png;jpg',
            quality: '80',
            w: url.searchParams.get('w') || '800',
            h: url.searchParams.get('h') || '600'
          });
        }
        return new URLSearchParams();
      }
    }),
    // Note: Netlify automatically provides Brotli and Gzip compression at the edge,
    // so we don't need vite-plugin-compression for production deployments
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
      '@radix-ui/react-dialog',
      '@radix-ui/react-select',
      '@radix-ui/react-tooltip',
      'class-variance-authority',
      'clsx',
      'tailwind-merge',
      // Add chart libraries to prevent initialization errors
      'recharts',
      'd3-scale',
      'd3-shape',
      'uplot'
    ],
    exclude: [
      '@storybook/test',
      '@storybook/react',
      'vitest',
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@xenova/transformers', // Exclude embeddings library
      'onnxruntime-web' // Exclude ONNX runtime
    ],
    // Remove force: true to avoid aggressive re-optimization
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
      // Use default tree shaking to fix module loading issues
      // (removing custom treeshake config entirely)
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
        entryFileNames: `js/[name]-[hash].js`,
        chunkFileNames: `js/[name]-[hash].js`,
        // Better asset organization
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop() || 'asset';
          if (/png|jpe?g|svg|gif|webp|avif/i.test(extType)) {
            return 'images/[name]-[hash][extname]';
          }
          if (/css/i.test(extType)) {
            return 'css/[name]-[hash][extname]';
          }
          if (/woff2?|ttf|eot/i.test(extType)) {
            return 'fonts/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
        // Allow modules to be properly hoisted for correct initialization order
        hoistTransitiveImports: true,
        // Fix circular dependency issues with proper chunk splitting
        manualChunks: (id) => {
          // CRITICAL: Split commonjsHelpers first to prevent circular deps
          if (id.includes('commonjsHelpers')) {
            return 'commonjs-helpers';
          }
          
          // Prevent embeddings from being bundled
          if (id.includes('@xenova/transformers') || id.includes('onnxruntime-web')) {
            return 'embeddings-excluded';
          }
          
          // Only process node_modules to avoid splitting app code incorrectly
          if (!id.includes('node_modules')) {
            return; // Let Vite handle app code bundling
          }
          
          // Core React - must be loaded first
          if (id.includes('node_modules/react-dom')) {
            return 'vendor-react-dom';
          }
          if (id.includes('node_modules/react')) {
            return 'vendor-react';
          }
          
          // Router
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
          
          // Chart libraries and their dependencies
          if (id.includes('recharts') || id.includes('d3-') || id.includes('uplot')) {
            return 'vendor-charts';
          }
          
          // UI Components
          if (id.includes('@radix-ui')) {
            return 'vendor-ui';
          }
          
          // Icons
          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }
          
          // Data and state
          if (id.includes('@supabase') || id.includes('zustand')) {
            return 'vendor-data';
          }
          
          // Utils
          if (id.includes('class-variance-authority') || 
              id.includes('clsx') || 
              id.includes('tailwind-merge') ||
              id.includes('date-fns') ||
              id.includes('zod')) {
            return 'vendor-utils';
          }
          
          // All other vendor code
          return 'vendor';
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
    // Module preload optimization - load minimal React first
    modulePreload: {
      polyfill: true, // Enable polyfill for proper module loading
      resolveDependencies: (_, deps) => {
        // Preload only the absolute minimum for initial render
        const sorted = deps.sort((a, b) => {
          if (a.includes('react-core')) return -1;
          if (b.includes('react-core')) return 1;
          if (a.includes('react-dom')) return -1;
          if (b.includes('react-dom')) return 1;
          if (a.includes('react-router')) return -1;
          if (b.includes('react-router')) return 1;
          return 0;
        });
        // Only preload the bare minimum React chunks
        return sorted.filter(dep => 
          dep.includes('react-core') || 
          dep.includes('react-dom')
        );
      }
    },
    
    // Remove console/debugger in production and strip legal comments
    esbuild: {
      drop: process.env.NODE_ENV === 'production' 
        ? ['console', 'debugger'] 
        : [],
      legalComments: 'none'
    }
  },
  css: {
    devSourcemap: true,
  },
}));
