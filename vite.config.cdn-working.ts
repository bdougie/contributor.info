import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

// This configuration actually externalizes modules for CDN usage
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';
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
      // CDN HTML transformer
      useCDN && {
        name: 'cdn-html-transform',
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            // Add SystemJS for dynamic imports
            const systemjs = `
    <!-- SystemJS for module loading -->
    <script src="https://cdn.jsdelivr.net/npm/systemjs@6.15.1/dist/system.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/systemjs@6.15.1/dist/extras/named-exports.min.js"></script>
    
    <!-- Import map for CDN modules -->
    <script type="systemjs-importmap">
    {
      "imports": {
        "react": "https://cdn.jsdelivr.net/npm/react@18.3.1/index.js",
        "react-dom": "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/index.js",
        "react-dom/client": "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/client.js",
        "react/jsx-runtime": "https://cdn.jsdelivr.net/npm/react@18.3.1/jsx-runtime.js"
      }
    }
    </script>`;
            
            // Replace module script with SystemJS loader
            html = html.replace(
              /<script type="module"[^>]*><\/script>/,
              systemjs + '\n    <script>System.import("/js/app.js");</script>'
            );
            
            return html;
          }
        }
      }
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
        input: {
          app: path.resolve(__dirname, 'src/main.tsx')
        },
        // Actually externalize in CDN mode
        ...(useCDN && {
          external: (id) => {
            // Externalize React and related packages
            if (id === 'react' || id.startsWith('react/')) return true;
            if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
            return false;
          },
          output: {
            format: 'system', // Use SystemJS format for CDN builds
            entryFileNames: 'js/[name].js',
            paths: {
              'react': 'https://cdn.jsdelivr.net/npm/react@18.3.1/index.js',
              'react/jsx-runtime': 'https://cdn.jsdelivr.net/npm/react@18.3.1/jsx-runtime.js',
              'react-dom': 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/index.js',
              'react-dom/client': 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/client.js',
            }
          }
        }),
        // Standard config for non-CDN builds
        ...(!useCDN && {
          output: {
            format: 'es',
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
            manualChunks: (id) => {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                  return 'vendor-react';
                }
                if (id.includes('@radix-ui') || id.includes('@nivo') || id.includes('recharts') || id.includes('d3-') || id.includes('uplot')) {
                  return 'vendor-react';
                }
                if (id.includes('@supabase')) {
                  return 'vendor-supabase';
                }
                if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority') || id.includes('date-fns')) {
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
          }
        }),
      },
      cssMinify: 'esbuild',
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2020',
      chunkSizeWarningLimit: useCDN ? 500 : 1300,
      reportCompressedSize: true,
      modulePreload: !useCDN && {
        polyfill: true,
        resolveDependencies: (_, deps) => {
          return deps.filter(dep => 
            dep.includes('vendor-react') ||
            dep.includes('vendor-utils') ||
            dep.includes('index-')
          );
        }
      },
      esbuild: {
        drop: isProduction ? ['console', 'debugger'] : [],
        legalComments: 'none'
      }
    },
    css: {
      devSourcemap: true,
    },
  }
});