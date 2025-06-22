import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { imagetools } from 'vite-imagetools';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Extract all modulepreload links
        const modulePreloads: string[] = [];
        const reactCorePreload: string[] = [];
        const reactDepsPreload: string[] = [];
        
        html = html.replace(/<link rel="modulepreload"[^>]*>/g, (match) => {
          if (match.includes('/react-') && !match.includes('react-deps')) {
            // This is the core React bundle
            reactCorePreload.push(match);
          } else if (match.includes('react-deps')) {
            // This is React-dependent libraries
            reactDepsPreload.push(match);
          } else {
            modulePreloads.push(match);
          }
          return '';
        });
        
        // Re-insert with correct order: React core first, then deps, then others
        const allPreloads = [...reactCorePreload, ...reactDepsPreload, ...modulePreloads].join('\n    ');
        return html.replace('</head>', `    ${allPreloads}\n  </head>`);
      },
    },
    imagetools({
      defaultDirectives: (url) => {
        // Only process images with query parameters
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
        return new URLSearchParams();
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['lucide-react'],
  },
  build: {
    // Improve CSS optimization
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Ensure proper module initialization order
        manualChunks: (id) => {
          // React MUST be in its own chunk
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react';
          }
          // All React-dependent libraries should be in a separate chunk that loads after React
          if (id.includes('node_modules') && (
            id.includes('@radix-ui') || 
            id.includes('react-router') ||
            id.includes('@sentry/react') ||
            id.includes('react-')
          )) {
            return 'react-deps';
          }
          // Other vendor modules
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // Optimize CSS minification
    cssMinify: 'esbuild',
    // Disable sourcemaps for production to reduce bundle size
    sourcemap: false,
    // Optimize minification
    minify: 'esbuild',
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 500,
    // Enable compression reporting
    reportCompressedSize: true,
  },
  css: {
    devSourcemap: true,
  },
});
