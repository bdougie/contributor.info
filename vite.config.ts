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
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: 'assets/[name]-[hash].[ext]',
        // Allow modules to be properly hoisted for correct initialization order
        hoistTransitiveImports: true,
        // Balanced chunking strategy - React must stay together to prevent initialization issues
        manualChunks: (id) => {
          // Prevent embeddings from being bundled
          if (id.includes('@xenova/transformers') || id.includes('onnxruntime-web')) {
            return 'embeddings-excluded';
          }
          
          // All React and React-dependent libraries MUST be bundled together
          // to prevent "Cannot read properties of undefined" errors
          // This is critical for production builds
          if (id.includes('react') || 
              id.includes('@radix-ui') || 
              id.includes('lucide-react')) {
            return 'react-vendor';
          }
          
          // Chart libraries - can be safely lazy loaded
          if (id.includes('@nivo') || id.includes('recharts') || id.includes('uplot')) {
            return 'charts';
          }
          
          // Utility libraries that don't depend on React
          if (id.includes('class-variance-authority') || 
              id.includes('clsx') || 
              id.includes('tailwind-merge')) {
            return 'utils';
          }
          
          // Date/time utilities
          if (id.includes('date-fns')) {
            return 'utils';
          }
          
          // Validation
          if (id.includes('zod')) {
            return 'utils';
          }
          
          // State management and data
          if (id.includes('zustand')) {
            return 'data';
          }
          
          // Supabase client
          if (id.includes('@supabase/supabase-js')) {
            return 'data';
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
        // Preload React vendor first (critical for app to work)
        const sorted = deps.sort((a, b) => {
          if (a.includes('react-vendor')) return -1;
          if (b.includes('react-vendor')) return 1;
          return 0;
        });
        // Only preload critical chunks
        return sorted.filter(dep => 
          dep.includes('react-vendor')
        );
      }
    },
  },
  css: {
    devSourcemap: true,
  },
}));
