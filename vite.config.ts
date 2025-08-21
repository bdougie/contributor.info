import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig(({ mode }) => {
  // CDN configuration - active when building with --mode cdn
  const useCDN = mode === 'cdn';
  
  return {
  base: '/',
  plugins: [
    react(),
    // Inject CDN import maps and preconnect hints when enabled
    useCDN && {
      name: 'cdn-transform',
      transformIndexHtml(html: string) {
        // Add CDN preconnect hints
        const cdnHints = `
    <!-- CDN Optimization (HTTP/2 multiplexing) -->
    <link rel="preconnect" href="https://esm.sh" crossorigin>
    <link rel="dns-prefetch" href="https://esm.sh">`;

        // Add import map for ESM CDN modules
        const importMap = `
    <!-- Import map for CDN libraries (reduces bundle by ~400KB) -->
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
        "react-dom": "https://esm.sh/react-dom@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
        "react-router-dom": "https://esm.sh/react-router-dom@6.28.0?deps=react@18.3.1",
        "@tanstack/react-query": "https://esm.sh/@tanstack/react-query@5.62.8?deps=react@18.3.1",
        "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.47.10",
        "recharts": "https://esm.sh/recharts@2.15.0?deps=react@18.3.1"
      }
    }
    </script>`;

        // Insert CDN configuration
        html = html.replace(
          '<!-- Performance optimizations -->',
          '<!-- Performance optimizations -->' + cdnHints
        );
        
        // Try multiple possible script tag patterns
        if (html.includes('src="/src/main.tsx"')) {
          html = html.replace(
            '<script type="module" src="/src/main.tsx"></script>',
            importMap + '\n    <script type="module" src="/src/main.tsx"></script>'
          );
        } else {
          // In production build, Vite changes the script tag
          // Insert before the closing </head> tag instead
          html = html.replace(
            '</head>',
            importMap + '\n  </head>'
          );
        }

        return html;
      }
    },
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
  ].filter(Boolean),
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
      // Mark CDN libraries as external when CDN is enabled
      external: useCDN ? [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        '@tanstack/react-query',
        '@supabase/supabase-js',
        'recharts'
      ] : [],
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
            // Skip CDN packages when CDN is enabled
            if (useCDN) {
              const cdnPackages = ['react', 'react-dom', 'react-router', '@tanstack/react-query', '@supabase/supabase-js', 'recharts'];
              if (cdnPackages.some(pkg => id.includes(pkg))) {
                return undefined; // Let rollup handle these as external
              }
            }
            
            // Check for specific packages that need to be bundled together
            if (!useCDN && (id.includes('react') || id.includes('react-dom') || id.includes('react-router'))) {
              return 'vendor-react';
            }
            if (id.includes('@radix-ui')) {
              return useCDN ? 'vendor-ui' : 'vendor-react'; // Separate chunk when using CDN
            }
            if (id.includes('@nivo')) {
              return useCDN ? 'vendor-charts' : 'vendor-react';
            }
            if (id.includes('recharts')) {
              return useCDN ? undefined : 'vendor-react'; // External when using CDN
            }
            if (id.includes('d3-')) {
              return useCDN ? 'vendor-charts' : 'vendor-react';
            }
            if (id.includes('uplot')) {
              return useCDN ? 'vendor-charts' : 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return useCDN ? undefined : 'vendor-supabase'; // External when using CDN
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
    chunkSizeWarningLimit: useCDN ? 500 : 1300, // Lower limit when using CDN
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
          (!useCDN && dep.includes('vendor-react')) || // Skip React preload when using CDN
          (useCDN && dep.includes('vendor-ui')) || // Preload UI components when using CDN
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
}});
