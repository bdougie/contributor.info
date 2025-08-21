import type { Plugin } from 'vite';
import externalGlobals from 'rollup-plugin-external-globals';

// CDN configuration with UMD builds
export const cdnConfig = {
  modules: [
    {
      name: 'react',
      var: 'React',
      url: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js'
    },
    {
      name: 'react-dom',
      var: 'ReactDOM',
      url: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js'
    },
    {
      name: 'react-router-dom',
      var: 'ReactRouterDOM',
      url: 'https://unpkg.com/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js'
    }
  ]
};

// Create globals mapping
const globals = cdnConfig.modules.reduce((acc, module) => {
  acc[module.name] = module.var;
  // Handle submodules
  if (module.name === 'react') {
    acc['react/jsx-runtime'] = module.var;
  }
  if (module.name === 'react-dom') {
    acc['react-dom/client'] = module.var;
  }
  return acc;
}, {} as Record<string, string>);

export function viteCDNPlugin(): Plugin {
  return {
    name: 'vite-plugin-cdn',
    enforce: 'post',
    apply: 'build',
    config(config) {
      // Mark modules as external
      config.build = config.build || {};
      config.build.rollupOptions = config.build.rollupOptions || {};
      config.build.rollupOptions.external = [
        'react',
        'react/jsx-runtime',
        'react-dom',
        'react-dom/client',
        'react-router-dom'
      ];
      
      // Add the external globals plugin
      if (!config.build.rollupOptions.plugins) {
        config.build.rollupOptions.plugins = [];
      }
      if (Array.isArray(config.build.rollupOptions.plugins)) {
        config.build.rollupOptions.plugins.push(externalGlobals(globals) as any);
      }
      
      return config;
    },
    transformIndexHtml(html) {
      // Inject CDN scripts
      const cdnScripts = cdnConfig.modules
        .map(module => `    <script crossorigin src="${module.url}"></script>`)
        .join('\n');

      const preconnect = `    <!-- CDN Preconnect -->\n    <link rel="preconnect" href="https://unpkg.com" crossorigin>`;

      // Insert scripts before closing </head>
      html = html.replace('</head>', `${preconnect}\n${cdnScripts}\n  </head>`);

      return html;
    }
  };
}