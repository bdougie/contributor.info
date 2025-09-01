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
        changeOrigin: true
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
      // Conservative tree shaking optimization for better bundle size
      treeshake: {
        moduleSideEffects: false, // Safe optimization for better bundle size
      },
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
        // Allow hoisting for proper module loading
        hoistTransitiveImports: true,
        // Optimized chunking strategy for better code splitting
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Core React libraries - loaded immediately
            if (id.includes('react/') || 
                id.includes('react-dom/') || 
                id.includes('react-router')) {
              return 'vendor-react-core';
            }
            // UI components that are used everywhere
            if (id.includes('@radix-ui')) {
              return 'vendor-ui';
            }
            // Chart libraries - can be split for lazy loading
            if (id.includes('@nivo')) {
              return 'vendor-nivo';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('d3-')) {
              return 'vendor-d3';
            }
            if (id.includes('uplot')) {
              return 'vendor-uplot';
            }
            // Supabase SDK
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            // Small utilities bundled together
            if (id.includes('clsx') || 
                id.includes('tailwind-merge') || 
                id.includes('class-variance-authority') ||
                id.includes('date-fns')) {
              return 'vendor-utils';
            }
            // Markdown - now lazy loaded, keep in separate chunk
            if (id.includes('react-markdown') || 
                id.includes('markdown') || 
                id.includes('remark') || 
                id.includes('rehype') ||
                id.includes('mdast') ||
                id.includes('unist') ||
                id.includes('micromark') ||
                id.includes('hast')) {
              return 'vendor-markdown';
            }
            // Analytics - lazy loaded
            if (id.includes('posthog-js')) {
              return 'vendor-analytics';
            }
            // Web vitals - small, keep separate
            if (id.includes('web-vitals')) {
              return 'vendor-vitals';
            }
            // Monitoring
            if (id.includes('@sentry')) {
              return 'vendor-monitoring';
            }
            // Exclude heavy ML libraries
            if (id.includes('@xenova/transformers') || id.includes('onnxruntime')) {
              return 'embeddings-excluded';
            }
          }
          // Don't split app code - let it stay in main bundle
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
    chunkSizeWarningLimit: 1300, // Increased to accommodate vendor-react bundle
    // Enable compression reporting
    reportCompressedSize: true,
    // Module preload optimization - load minimal React first
    modulePreload: {
      polyfill: true, // Enable polyfill for proper module loading
      resolveDependencies: (_, deps) => {
        // Preload only the absolute minimum for initial render
        const sorted = deps.sort((a, b) => {
          // First priority: Core React libraries
          if (a.includes('vendor-react-core')) return -1;
          if (b.includes('vendor-react-core')) return 1;
          // Second priority: UI components (Radix UI)
          if (a.includes('vendor-ui')) return -1;
          if (b.includes('vendor-ui')) return 1;
          // Third priority: Utils for classnames
          if (a.includes('vendor-utils')) return -1;
          if (b.includes('vendor-utils')) return 1;
          // Fourth priority: Main app chunk
          if (a.includes('index-')) return -1;
          if (b.includes('index-')) return 1;
          return 0;
        });
        // Preload only critical chunks for initial render
        // Markdown, charts, and analytics will load on demand
        return sorted.filter(dep => 
          dep.includes('vendor-react-core') || 
          dep.includes('vendor-ui') ||
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
