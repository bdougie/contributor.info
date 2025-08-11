import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';
import viteCompression from 'vite-plugin-compression';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(() => ({
  base: '/',
  plugins: [
    react(),
    // Copy docs folder to dist for Netlify function access
    viteStaticCopy({
      targets: [
        {
          src: 'public/docs',
          dest: '.'
        }
      ]
    }),
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
    // Brotli compression for static assets (safe, server-side)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024,
      deleteOriginFile: false,
    }),
    // Also generate gzip for broader compatibility
    viteCompression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false,
    }),
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
        // Balanced chunking strategy from production postmortem (2025-06-22)
        // This approach maintains reliability while optimizing performance
        manualChunks: (id) => {
          // Prevent embeddings from being bundled
          if (id.includes('@xenova/transformers') || id.includes('onnxruntime-web')) {
            return 'embeddings-excluded';
          }
          
          // All React and React-dependent libraries must be bundled together
          // to prevent "Cannot read properties of undefined" errors
          // This includes: React, ReactDOM, Router, Radix UI, Charts, Icons, etc.
          if (id.includes('react') || 
              id.includes('@radix-ui') || 
              id.includes('@nivo') || 
              id.includes('recharts') ||
              id.includes('lucide-react')) {
            return 'react-vendor';
          }
          
          // Utility libraries that don't depend on React
          if (id.includes('class-variance-authority')) return 'utils';
          if (id.includes('clsx')) return 'utils';
          if (id.includes('tailwind-merge')) return 'utils';
          
          // Utilities - frequently used, good for caching
          if (id.includes('date-fns')) return 'utils';
          if (id.includes('zod')) return 'utils';
          
          // State management and data
          if (id.includes('zustand')) return 'data';
          if (id.includes('@supabase/supabase-js')) return 'data';
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
        // Preload React vendor first, then router
        const sorted = deps.sort((a, b) => {
          if (a.includes('react-vendor')) return -1;
          if (b.includes('react-vendor')) return 1;
          if (a.includes('react-router')) return -1;
          if (b.includes('react-router')) return 1;
          return 0;
        });
        // Only preload critical chunks
        return sorted.filter(dep => 
          dep.includes('react-vendor') || 
          dep.includes('react-router')
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
