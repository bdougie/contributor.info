import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig, Plugin } from 'vite';
import { imagetools } from 'vite-imagetools';
import externalGlobals from 'rollup-plugin-external-globals';

// Map of modules to their global variable names for CDN usage
const cdnModules = {
  'react': 'React',
  'react-dom': 'ReactDOM',
  'react-dom/client': 'ReactDOM',
  'react/jsx-runtime': 'React',
  'react-router-dom': 'ReactRouterDOM',
  '@tanstack/react-query': 'ReactQuery',
  '@supabase/supabase-js': 'Supabase',
  'recharts': 'Recharts'
};

// Custom plugin to inject CDN scripts
const cdnInjectorPlugin = (): Plugin => ({
  name: 'cdn-injector',
  transformIndexHtml(html) {
    // CDN script tags with fallback
    const cdnScripts = `
    <!-- CDN Libraries with fallback -->
    <script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/@tanstack/react-query@5.62.8/build/umd/index.production.js"></script>
    <script crossorigin src="https://unpkg.com/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js"></script>
    <script crossorigin src="https://unpkg.com/recharts@2.15.0/umd/Recharts.min.js"></script>
    
    <!-- Global variable setup for modules -->
    <script>
      window.ReactQuery = window.TanStackReactQuery;
      window.ReactRouterDOM = window.ReactRouterDOM || window.ReactRouter;
      window.Supabase = window.supabase;
    </script>
    
    <!-- Fallback mechanism -->
    <script>
      function checkCDNLibraries() {
        const required = ['React', 'ReactDOM', 'ReactRouterDOM', 'ReactQuery', 'Supabase', 'Recharts'];
        const missing = required.filter(lib => !window[lib]);
        if (missing.length > 0) {
          console.error('CDN libraries failed to load:', missing);
          // Could implement fallback loading here
        }
      }
      window.addEventListener('DOMContentLoaded', checkCDNLibraries);
    </script>`;

    // Add preconnect hints
    const preconnect = `
    <!-- CDN Preconnect -->
    <link rel="preconnect" href="https://unpkg.com" crossorigin>
    <link rel="dns-prefetch" href="https://unpkg.com">`;

    // Insert preconnect after <head>
    html = html.replace('<head>', '<head>' + preconnect);
    
    // Insert CDN scripts before the main module script
    html = html.replace('</head>', cdnScripts + '\n  </head>');

    return html;
  }
});

export default defineConfig(({ mode }) => {
  const useCDN = mode === 'cdn';
  
  return {
    base: '/',
    plugins: [
      react(),
      imagetools({
        defaultDirectives: (url) => {
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
      // Add CDN injector only in CDN mode
      useCDN && cdnInjectorPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    },
    server: {
      warmup: {
        clientFiles: [
          './src/main.tsx',
          './src/App.tsx',
          './src/components/ui/**/*',
          './src/lib/supabase.ts',
          './src/lib/github.ts'
        ]
      },
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
      // Exclude CDN modules from optimization in CDN mode
      exclude: useCDN ? Object.keys(cdnModules) : [
        '@storybook/test',
        '@storybook/react',
        'vitest',
        '@testing-library/react',
        '@testing-library/jest-dom',
        '@xenova/transformers',
        'onnxruntime-web'
      ],
      include: useCDN ? [
        // Only include non-CDN modules
        '@radix-ui/react-slot',
        '@radix-ui/react-avatar',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-dialog',
        '@radix-ui/react-select',
        '@radix-ui/react-tooltip',
        'class-variance-authority',
        'clsx',
        'tailwind-merge',
        'd3-scale',
        'd3-shape',
        'uplot'
      ] : [
        // Include all in development
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
        'recharts',
        'd3-scale',
        'd3-shape',
        'uplot'
      ],
    },
    build: {
      cssCodeSplit: true,
      commonjsOptions: {
        transformMixedEsModules: true,
        strictRequires: 'auto'
      },
      rollupOptions: {
        // Mark CDN modules as external
        external: useCDN ? Object.keys(cdnModules) : [],
        plugins: useCDN ? [
          // Use the external globals plugin to map imports to window globals
          externalGlobals(cdnModules) as any
        ] : [],
        output: {
          format: 'es', // Keep ES format
          globals: useCDN ? cdnModules : {},
          generatedCode: {
            constBindings: true,
            objectShorthand: true,
            arrowFunctions: true
          },
          entryFileNames: `js/[name]-[hash].js`,
          chunkFileNames: `js/[name]-[hash].js`,
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
          hoistTransitiveImports: true,
          manualChunks: useCDN ? (id) => {
            // In CDN mode, bundle all non-external modules together
            if (id.includes('node_modules')) {
              // Skip CDN packages
              const cdnPackages = Object.keys(cdnModules);
              if (cdnPackages.some(pkg => id.includes(pkg))) {
                return undefined;
              }
              // Bundle everything else together
              return 'vendor';
            }
          } : (id) => {
            // Standard chunking for non-CDN builds
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'vendor-react';
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-react';
              }
              if (id.includes('@nivo')) {
                return 'vendor-react';
              }
              if (id.includes('recharts')) {
                return 'vendor-react';
              }
              if (id.includes('d3-')) {
                return 'vendor-react';
              }
              if (id.includes('uplot')) {
                return 'vendor-react';
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
            }
          },
        },
      },
      cssMinify: 'esbuild',
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2020',
      chunkSizeWarningLimit: useCDN ? 500 : 1300,
      reportCompressedSize: true,
      modulePreload: {
        polyfill: true,
        resolveDependencies: (_, deps) => {
          const sorted = deps.sort((a, b) => {
            if (!useCDN && a.includes('vendor-react')) return -1;
            if (!useCDN && b.includes('vendor-react')) return 1;
            if (a.includes('vendor-utils')) return -1;
            if (b.includes('vendor-utils')) return 1;
            if (a.includes('index-')) return -1;
            if (b.includes('index-')) return 1;
            return 0;
          });
          return sorted.filter(dep => 
            (!useCDN && dep.includes('vendor-react')) ||
            dep.includes('vendor-utils') ||
            dep.includes('vendor') ||
            dep.includes('index-')
          );
        }
      },
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
  }
});