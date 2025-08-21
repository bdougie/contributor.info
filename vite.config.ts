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
    },
    // Proxy API calls to Netlify functions during development
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/.netlify/functions')
      },
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true
      }
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
        // Optimized manual chunking for better performance
        manualChunks: (id) => {
          // Handle node_modules packages
          if (id.includes('node_modules')) {
            // React ecosystem - MUST include Radix UI to avoid loading order issues
            // Radix UI depends on React, so they must be in the same chunk
            if (id.includes('react') || id.includes('@radix-ui')) {
              return 'vendor-react';
            }
            
            // Utility libraries
            if (id.includes('clsx') || id.includes('tailwind-merge') || 
                id.includes('class-variance-authority') || id.includes('date-fns')) {
              return 'vendor-utils';
            }
            
            // Supabase
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            
            // Chart libraries
            if (id.includes('recharts') || id.includes('uplot') || 
                id.includes('d3-scale') || id.includes('d3-shape') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            
            // Nivo
            if (id.includes('@nivo')) {
              return 'nivo-scatterplot';
            }
            
            // Embeddings (excluded)
            if (id.includes('@xenova/transformers') || id.includes('onnxruntime')) {
              return 'embeddings-excluded';
            }
            
            // Other large libraries
            if (id.includes('markdown') || id.includes('remark') || id.includes('rehype')) {
              return 'vendor-markdown';
            }
            
            // Sentry monitoring
            if (id.includes('@sentry')) {
              return 'vendor-monitoring';
            }
          }
          
          // Handle app code chunking
          if (id.includes('/src/')) {
            // Admin/debug features (lazy loaded)
            if (id.includes('/admin/') || id.includes('/debug/')) {
              return 'app-admin';
            }
            
            // Chart components
            if (id.includes('/charts/') || id.includes('chart') || id.includes('graph')) {
              return 'app-charts';
            }
            
            // Spam detection features
            if (id.includes('/spam/') || id.includes('SpamDetection')) {
              return 'app-spam';
            }
            
            // Progressive capture features
            if (id.includes('/progressive-capture/')) {
              return 'app-progressive';
            }
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
    // Module preload optimization - load minimal React first
    modulePreload: {
      polyfill: true, // Enable polyfill for proper module loading
      resolveDependencies: (_, deps) => {
        // Preload only the absolute minimum for initial render
        // Note: These names must match the keys in manualChunks above
        const sorted = deps.sort((a, b) => {
          // Prioritize vendor-react chunk (contains react, react-dom, react-router-dom, and Radix UI)
          if (a.includes('vendor-react')) return -1;
          if (b.includes('vendor-react')) return 1;
          // Then load vendor-utils for classnames
          if (a.includes('vendor-utils')) return -1;
          if (b.includes('vendor-utils')) return 1;
          // Then load main app chunk
          if (a.includes('index-')) return -1;
          if (b.includes('index-')) return 1;
          return 0;
        });
        // Preload critical chunks in order
        return sorted.filter(dep => 
          dep.includes('vendor-react') || 
          dep.includes('vendor-utils') ||
          dep.includes('index-')
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
