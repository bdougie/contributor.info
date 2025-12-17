import path from 'path';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';
import netlifyPlugin from '@netlify/vite-plugin-react-router';

export default defineConfig(() => ({
  base: '/',
  plugins: [
    // React Router v7 framework mode with SSR support
    reactRouter(),
    // Netlify adapter for React Router SSR (origin-based, edge not yet supported)
    // See: https://developers.netlify.com/guides/how-to-deploy-a-react-router-7-site-to-netlify/
    netlifyPlugin(),
    imagetools({
      defaultDirectives: (url) => {
        // Process images for WebP optimization
        if (url.searchParams.has('webp')) {
          return new URLSearchParams({
            format: 'webp',
            quality: '80',
          });
        }
        if (url.searchParams.has('avif')) {
          return new URLSearchParams({
            format: 'avif',
            quality: '70',
          });
        }
        // Auto-generate WebP versions for all static images
        if (url.searchParams.has('optimize')) {
          return new URLSearchParams({
            format: 'webp;png;jpg',
            quality: '80',
            w: url.searchParams.get('w') || '800',
            h: url.searchParams.get('h') || '600',
          });
        }
        return new URLSearchParams();
      },
    }),
    // Note: Netlify automatically provides Brotli and Gzip compression at the edge,
    // so we don't need vite-plugin-compression for production deployments
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      // React Router v7 renamed package from react-router-dom to react-router
      'react-router-dom': path.resolve(__dirname, './node_modules/react-router'),
    },
    dedupe: ['react', 'react-dom'],
    // Narrow extensions list to reduce filesystem checks
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  server: {
    // Warm up frequently used files for better dev performance
    warmup: {
      clientFiles: [
        './app/root.tsx',
        './app/routes/*.tsx',
        './src/components/ui/**/*',
        './src/lib/supabase.ts',
        './src/lib/github.ts',
      ],
    },
    // Proxy API calls to Netlify functions during development
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router',
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
      'uplot',
    ],
    exclude: [
      'vitest',
      '@testing-library/react',
      '@testing-library/jest-dom',
      '@xenova/transformers', // Exclude embeddings library
      'onnxruntime-web', // Exclude ONNX runtime
    ],
  },
  build: {
    // Enable CSS code splitting for better performance
    cssCodeSplit: true,
    commonjsOptions: {
      // Better handling of CommonJS modules (like some D3 packages)
      transformMixedEsModules: true,
      strictRequires: 'auto' as const,
    },
    // Note: manualChunks removed for React Router v7 SSR compatibility
    // The React Router plugin handles chunking automatically for client builds
    // SSR builds require inlineDynamicImports which is incompatible with manualChunks
    // Optimize CSS minification
    cssMinify: 'esbuild' as const,
    // Disable sourcemaps in production to reduce bundle size
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    // Optimize minification and target for better compression
    minify: 'esbuild' as const,
    target: 'es2020', // Modern target with good compatibility
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1300, // Increased to accommodate vendor-react bundle
    // Enable compression reporting
    reportCompressedSize: true,
  },
  css: {
    devSourcemap: true,
  },
}));
