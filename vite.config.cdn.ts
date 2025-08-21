import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

// CDN configuration for production builds
const CDN_EXTERNALS = process.env.NODE_ENV === 'production' ? {
  react: 'React',
  'react-dom': 'ReactDOM',
  'react-router-dom': 'ReactRouterDOM',
  '@tanstack/react-query': 'ReactQuery',
  'recharts': 'Recharts',
  '@supabase/supabase-js': 'supabase'
} : {};

// CDN URLs with specific versions for integrity
const CDN_URLS = {
  react: 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
  'react-dom': 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
  'react-router-dom': 'https://cdn.jsdelivr.net/npm/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js',
  '@tanstack/react-query': 'https://cdn.jsdelivr.net/npm/@tanstack/react-query@5.62.8/build/umd/index.production.js',
  'recharts': 'https://cdn.jsdelivr.net/npm/recharts@2.15.0/umd/Recharts.min.js',
  '@supabase/supabase-js': 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js'
};

export default defineConfig(() => ({
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
    // Custom plugin to inject CDN scripts into HTML
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        if (process.env.NODE_ENV !== 'production') {
          return html;
        }

        // Inject CDN preconnect hints
        const preconnectHints = `
    <!-- CDN Preconnect for faster library loading -->
    <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
    <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">`;

        // Inject CDN scripts before the module script
        const cdnScripts = `
    <!-- CDN Libraries with local fallback -->
    <script>
      // Fallback loader for CDN failures
      window.cdnFallbacks = {};
      function loadFallback(libName, fallbackPath) {
        if (window.cdnFallbacks[libName]) return;
        window.cdnFallbacks[libName] = true;
        console.warn('CDN failed for ' + libName + ', loading local fallback');
        var script = document.createElement('script');
        script.src = fallbackPath;
        script.onerror = function() {
          console.error('Fallback also failed for ' + libName);
        };
        document.head.appendChild(script);
      }
    </script>
    
    <!-- React (18.3.1) -->
    <script 
      src="${CDN_URLS.react}"
      crossorigin="anonymous"
      onerror="loadFallback('react', '/vendor/react.production.min.js')"
    ></script>
    
    <!-- React DOM (18.3.1) -->
    <script 
      src="${CDN_URLS['react-dom']}"
      crossorigin="anonymous"
      onerror="loadFallback('react-dom', '/vendor/react-dom.production.min.js')"
    ></script>
    
    <!-- React Router DOM (6.28.0) -->
    <script 
      src="${CDN_URLS['react-router-dom']}"
      crossorigin="anonymous"
      onerror="loadFallback('react-router-dom', '/vendor/react-router-dom.production.min.js')"
    ></script>
    
    <!-- React Query (5.62.8) -->
    <script 
      src="${CDN_URLS['@tanstack/react-query']}"
      crossorigin="anonymous"
      onerror="loadFallback('react-query', '/vendor/react-query.production.min.js')"
    ></script>
    
    <!-- Recharts (2.15.0) -->
    <script 
      src="${CDN_URLS.recharts}"
      crossorigin="anonymous"
      onerror="loadFallback('recharts', '/vendor/recharts.min.js')"
    ></script>
    
    <!-- Supabase JS (2.47.10) -->
    <script 
      src="${CDN_URLS['@supabase/supabase-js']}"
      crossorigin="anonymous"
      onerror="loadFallback('supabase-js', '/vendor/supabase.min.js')"
    ></script>
    
    <!-- Verify libraries loaded -->
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        var required = ['React', 'ReactDOM', 'ReactRouterDOM', 'ReactQuery', 'Recharts', 'supabase'];
        var missing = required.filter(function(lib) { return !window[lib]; });
        if (missing.length > 0) {
          console.error('Missing CDN libraries:', missing);
          // Could trigger fallback loading here if needed
        }
      });
    </script>`;

        // Insert preconnect hints after existing preconnects
        html = html.replace(
          '<!-- Performance optimizations -->',
          '<!-- Performance optimizations -->' + preconnectHints
        );

        // Insert CDN scripts before the main module script
        html = html.replace(
          '<script type="module" src="/src/main.tsx"></script>',
          cdnScripts + '\n    <script type="module" src="/src/main.tsx"></script>'
        );

        return html;
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
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
      '@xenova/transformers',
      'onnxruntime-web'
    ],
  },
  build: {
    cssCodeSplit: true,
    commonjsOptions: {
      transformMixedEsModules: true,
      strictRequires: 'auto'
    },
    rollupOptions: {
      // External libraries for CDN in production
      external: process.env.NODE_ENV === 'production' ? Object.keys(CDN_EXTERNALS) : [],
      output: {
        format: 'es',
        globals: CDN_EXTERNALS,
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
        // Simplified chunking without React libraries
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Skip React-related packages if using CDN
            if (process.env.NODE_ENV === 'production') {
              const skipPackages = ['react', 'react-dom', 'react-router', 'recharts', '@tanstack/react-query', '@supabase/supabase-js'];
              if (skipPackages.some(pkg => id.includes(pkg))) {
                return undefined; // Let Rollup handle or exclude
              }
            }
            
            // Bundle remaining libraries
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
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
    chunkSizeWarningLimit: 800, // Reduced since we're using CDN
    reportCompressedSize: true,
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_, deps) => {
        const sorted = deps.sort((a, b) => {
          if (a.includes('vendor-utils')) return -1;
          if (b.includes('vendor-utils')) return 1;
          if (a.includes('index-')) return -1;
          if (b.includes('index-')) return 1;
          return 0;
        });
        return sorted.filter(dep => 
          dep.includes('vendor-utils') ||
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
}));