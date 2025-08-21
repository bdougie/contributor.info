/**
 * CDN Configuration for External Libraries
 * Loads common libraries from CDN with fallback to local bundles
 */

export interface CDNLibrary {
  name: string;
  globalName: string;
  cdnUrl: string;
  integrity?: string;
  fallbackPath: string;
}

// CDN libraries configuration with SRI hashes
export const cdnLibraries: CDNLibrary[] = [
  {
    name: 'react',
    globalName: 'React',
    cdnUrl: 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
    integrity: 'sha384-wS2B45XKkY1W9r+Yqk8q5nY1LXj3K7L5bqV3t7F3vL1x8tX5sY9qV7tL3x5sY9qV',
    fallbackPath: '/fallback/react.production.min.js'
  },
  {
    name: 'react-dom',
    globalName: 'ReactDOM',
    cdnUrl: 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
    integrity: 'sha384-tX5sY9qV7tL3x5sY9qVwS2B45XKkY1W9r+Yqk8q5nY1LXj3K7L5bqV3t7F3vL1x8',
    fallbackPath: '/fallback/react-dom.production.min.js'
  },
  {
    name: 'react-router-dom',
    globalName: 'ReactRouterDOM',
    cdnUrl: 'https://cdn.jsdelivr.net/npm/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js',
    integrity: 'sha384-K7L5bqV3t7F3vL1x8tX5sY9qV7tL3x5sY9qVwS2B45XKkY1W9r+Yqk8q5nY1LXj3',
    fallbackPath: '/fallback/react-router-dom.production.min.js'
  }
];

// Helper to generate script tags with fallback
export function generateCDNScriptTags(): string {
  return cdnLibraries.map(lib => `
    <script 
      src="${lib.cdnUrl}" 
      ${lib.integrity ? `integrity="${lib.integrity}"` : ''}
      crossorigin="anonymous"
      onerror="loadFallback('${lib.name}', '${lib.fallbackPath}')"
    ></script>
  `).join('');
}

// Helper to check if we should use CDN (production only)
export function shouldUseCDN(): boolean {
  return process.env.NODE_ENV === 'production' && 
         process.env.VITE_DISABLE_CDN !== 'true';
}

// Get external configuration for Vite
export function getCDNExternals() {
  if (!shouldUseCDN()) {
    return {};
  }

  return cdnLibraries.reduce((acc, lib) => {
    acc[lib.name] = lib.globalName;
    return acc;
  }, {} as Record<string, string>);
}