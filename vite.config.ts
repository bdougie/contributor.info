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
        // Balanced chunking strategy from production postmortem (2025-06-22)
        // This approach maintains reliability while optimizing performance
        manualChunks: {
          // Critical React core - bundle together to prevent initialization issues
          'react-core': ['react', 'react-dom', '@radix-ui/react-slot'],
          
          // React ecosystem - can load after core is initialized  
          'react-ecosystem': ['react-router-dom', 'class-variance-authority', 'clsx', 'tailwind-merge'],
          
          // Heavy chart libraries - lazy loaded, separate for better caching
          'charts-nivo': ['@nivo/scatterplot'],
          'charts-recharts': ['recharts'],
          
          // UI component library - used throughout app (group all Radix UI)
          'ui-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-avatar',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs'
          ],
          
          // Icons - separate for optimal tree-shaking
          'icons': ['lucide-react'],
          
          // Utilities - frequently used, good for caching
          'utils': ['date-fns', 'zod'],
          
          // State management and data
          'data': ['zustand', '@supabase/supabase-js']
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
