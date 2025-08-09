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
        // Balanced chunking strategy from production postmortem (2025-06-22)
        // This approach maintains reliability while optimizing performance
        manualChunks: (id) => {
          // Prevent embeddings from being bundled
          if (id.includes('@xenova/transformers') || id.includes('onnxruntime-web')) {
            return 'embeddings-excluded';
          }
          
          // Keep React and ReactDOM together to prevent hook issues
          if (id.includes('react-dom')) return 'react-core';
          if (id.includes('react') && !id.includes('react-router')) return 'react-core';
          
          // React Router separate
          if (id.includes('react-router-dom')) return 'react-router';
          
          // Bundle all Radix UI together to prevent initialization issues
          if (id.includes('@radix-ui')) return 'ui-radix';
          
          // Utility libraries
          if (id.includes('class-variance-authority')) return 'utils';
          if (id.includes('clsx')) return 'utils';
          if (id.includes('tailwind-merge')) return 'utils';
          
          // Heavy chart libraries - lazy loaded, separate for better caching
          if (id.includes('@nivo')) return 'charts-nivo';
          if (id.includes('recharts')) return 'charts-recharts';
          
          // Icons - separate for optimal tree-shaking
          if (id.includes('lucide-react')) return 'icons';
          
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
