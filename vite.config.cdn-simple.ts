import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';
import { autoComplete, Plugin as cdnPlugin } from 'vite-plugin-cdn-import';

export default defineConfig(({ mode }) => {
  const useCDN = mode === 'cdn';
  
  // Base config shared between CDN and non-CDN builds
  const baseConfig = {
    base: '/',
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
    css: {
      devSourcemap: true,
    }
  };

  // CDN configuration using vite-plugin-cdn-import
  if (useCDN) {
    return {
      ...baseConfig,
      plugins: [
        react(),
        cdnPlugin({
          modules: [
            autoComplete('react'),
            autoComplete('react-dom'),
            {
              name: 'react-router-dom',
              var: 'ReactRouterDOM',
              path: 'https://unpkg.com/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js'
            }
          ]
        }),
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
      ],
      build: {
        cssCodeSplit: true,
        commonjsOptions: {
          transformMixedEsModules: true,
          strictRequires: 'auto'
        },
        rollupOptions: {
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
          },
        },
        cssMinify: 'esbuild',
        sourcemap: false,
        minify: 'esbuild',
        target: 'es2020',
        chunkSizeWarningLimit: 500,
        reportCompressedSize: true,
        esbuild: {
          drop: ['console', 'debugger'],
          legalComments: 'none'
        }
      }
    };
  }

  // Standard non-CDN configuration (copy from existing vite.config.ts)
  return {
    ...baseConfig,
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
    ],
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
        },
      },
      cssMinify: 'esbuild',
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2020',
      chunkSizeWarningLimit: 1300,
      reportCompressedSize: true,
      modulePreload: {
        polyfill: true,
        resolveDependencies: (_, deps) => {
          const sorted = deps.sort((a, b) => {
            if (a.includes('vendor-react')) return -1;
            if (b.includes('vendor-react')) return 1;
            if (a.includes('vendor-utils')) return -1;
            if (b.includes('vendor-utils')) return 1;
            if (a.includes('index-')) return -1;
            if (b.includes('index-')) return 1;
            return 0;
          });
          return sorted.filter(dep => 
            dep.includes('vendor-react') ||
            dep.includes('vendor-utils') ||
            dep.includes('index-')
          );
        }
      },
      esbuild: {
        drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
        legalComments: 'none'
      }
    }
  };
});