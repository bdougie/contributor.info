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
    include: ['react', 'react-dom'],
    exclude: ['lucide-react'], // Keep icons separate for better tree-shaking
    force: true, // Force re-optimization for performance
  },
  build: {
    // Disable CSS code splitting to prevent FOUC
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // Optimized chunking strategy for better performance
        manualChunks: (id) => {
          // Bundle React with essential libraries to avoid initialization issues
          if (id.includes('react') || 
              id.includes('@radix-ui/react-slot') || 
              id.includes('class-variance-authority') ||
              id.includes('clsx') ||
              id.includes('tailwind-merge')) {
            return 'react-vendor';
          }
          
          // Chart libraries - lazy load as separate chunks since they're heavy
          if (id.includes('@nivo') || id.includes('recharts')) {
            return 'charts';
          }
          
          // UI components - bundle Radix UI together
          if (id.includes('@radix-ui/')) {
            return 'ui-components';
          }
          
          // Icons - separate for better tree-shaking
          if (id.includes('lucide-react') || id.includes('react-icons')) {
            return 'icons';
          }
          
          // Analytics - lazy load since non-critical
          if (id.includes('posthog') || id.includes('@sentry')) {
            return 'analytics';
          }
          
          // Core utilities and data libs
          if (id.includes('date-fns') || 
              id.includes('zod') || 
              id.includes('zustand') ||
              id.includes('@supabase/supabase-js')) {
            return 'vendor';
          }
          
          // All other node_modules
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }
        },
      },
    },
    // Optimize CSS minification
    cssMinify: 'esbuild',
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Optimize minification and target
    minify: 'esbuild',
    target: 'es2020', // Modern target for better optimization while maintaining compatibility
    // Optimize chunk size warnings  
    chunkSizeWarningLimit: 600, // Slightly more lenient given postmortem learnings
    // Enable compression reporting
    reportCompressedSize: true,
  },
  css: {
    devSourcemap: true,
  },
});
