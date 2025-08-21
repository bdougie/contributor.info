import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

// Use ESM CDN imports with importmap
const useCDN = process.env.NODE_ENV === 'production' && process.env.VITE_USE_CDN === 'true';

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
    // Plugin to inject import maps for CDN usage
    {
      name: 'cdn-import-map',
      transformIndexHtml(html) {
        if (!useCDN) return html;

        const importMap = `
    <!-- Import map for CDN libraries -->
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.3.1",
        "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
        "react-dom": "https://esm.sh/react-dom@18.3.1",
        "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
        "react-router-dom": "https://esm.sh/react-router-dom@6.28.0?deps=react@18.3.1",
        "@tanstack/react-query": "https://esm.sh/@tanstack/react-query@5.62.8?deps=react@18.3.1",
        "recharts": "https://esm.sh/recharts@2.15.0?deps=react@18.3.1",
        "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.47.10"
      }
    }
    </script>
    
    <!-- Preconnect to CDN -->
    <link rel="preconnect" href="https://esm.sh" crossorigin>
    <link rel="dns-prefetch" href="https://esm.sh">
    
    <!-- Module preload for critical libraries -->
    <link rel="modulepreload" href="https://esm.sh/react@18.3.1" as="script" crossorigin>
    <link rel="modulepreload" href="https://esm.sh/react-dom@18.3.1" as="script" crossorigin>`;

        // Insert import map before the module script
        return html.replace(
          '<script type="module" src="/src/main.tsx"></script>',
          importMap + '\n    <script type="module" src="/src/main.tsx"></script>'
        );
      }
    }
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Only alias in development
      ...(useCDN ? {} : {
        'react': path.resolve(__dirname, './node_modules/react'),
        'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      })
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
    include: useCDN ? [
      // Only non-CDN packages
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
      // All packages in development
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
      // Mark CDN packages as external in production
      external: useCDN ? [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'react-router-dom',
        '@tanstack/react-query',
        'recharts',
        '@supabase/supabase-js'
      ] : [],
      output: {
        format: 'es',
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
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Skip externalized packages
            if (useCDN) {
              const cdnPackages = ['react', 'react-dom', 'react-router', 'recharts', '@tanstack/react-query', '@supabase/supabase-js'];
              if (cdnPackages.some(pkg => id.includes(pkg))) {
                return undefined;
              }
            }
            
            // Bundle remaining libraries  
            if (id.includes('@radix-ui')) {
              return useCDN ? 'vendor-ui' : 'vendor-react';
            }
            if (id.includes('@nivo')) {
              return useCDN ? 'vendor-charts' : 'vendor-react';
            }
            if (id.includes('d3-')) {
              return useCDN ? 'vendor-charts' : 'vendor-react';
            }
            if (id.includes('uplot')) {
              return useCDN ? 'vendor-charts' : 'vendor-react';
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
            
            // Default chunking for CDN build
            if (useCDN && !id.includes('react')) {
              return 'vendor-react';
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