import path from 'path';
import react from '@vitejs/plugin-react';
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
        // Hybrid approach - use function-based chunking for all packages
        // to ensure proper grouping of React ecosystem libraries
        manualChunks: (id) => {
          // For node_modules, handle package-specific grouping below or return undefined for default chunking
          if (id.includes('node_modules')) {
            // Check for specific packages that need to be bundled together
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return 'vendor-react'; // Bundle with React to avoid forwardRef issues
            }
            if (id.includes('@nivo')) {
              return 'vendor-react'; // Bundle with React to avoid memo issues
            }
            if (id.includes('recharts')) {
              return 'vendor-react'; // Recharts also needs React context
            }
            if (id.includes('d3-')) {
              return 'vendor-react'; // D3 modules used by Recharts need to be together
            }
            if (id.includes('uplot')) {
              return 'vendor-react'; // Keep all visualization libraries together
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'vendor-utils';
            }
            if (id.includes('date-fns')) {
              return 'vendor-utils';
            }
            if (id.includes('markdown') || id.includes('remark') || id.includes('rehype')) {
              return 'vendor-markdown';
            }
            if (id.includes('@sentry')) {
              return 'vendor-monitoring';
            }
            if (id.includes('@xenova/transformers') || id.includes('onnxruntime')) {
              return 'embeddings-excluded';
            }
          }
          
          // Don't split app code - it all uses React components
          // Let everything stay in the main bundle to avoid initialization issues
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
    chunkSizeWarningLimit: 1300, // Increased to accommodate 1.2MB vendor-react bundle
    // Enable compression reporting
    reportCompressedSize: true,
    // Module preload optimization - load minimal React first
    modulePreload: {
      polyfill: true, // Enable polyfill for proper module loading
      resolveDependencies: (_, deps) => {
        // Preload only the absolute minimum for initial render
        // Note: These names must match the keys in manualChunks above
        const sorted = deps.sort((a, b) => {
          // Prioritize vendor-react chunk (contains React, Radix UI, and Nivo)
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
