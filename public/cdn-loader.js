/**
 * CDN Loader - Loads vendor libraries from CDN with fallback
 * This runs before the main application loads
 */

(function() {
  'use strict';
  
  // Configuration for CDN libraries
  const cdnLibraries = [
    {
      name: 'React',
      test: () => window.React && window.React.version,
      url: 'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
      fallback: '/vendor/react.production.min.js'
    },
    {
      name: 'ReactDOM', 
      test: () => window.ReactDOM && window.ReactDOM.version,
      url: 'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
      fallback: '/vendor/react-dom.production.min.js'
    },
    {
      name: 'ReactRouterDOM',
      test: () => window.ReactRouterDOM,
      url: 'https://unpkg.com/react-router-dom@6.28.0/dist/umd/react-router-dom.production.min.js',
      fallback: '/vendor/react-router-dom.production.min.js'
    }
  ];
  
  // Track loading state
  let loadedCount = 0;
  let failedLibraries = [];
  
  // Load a library from CDN with fallback
  function loadLibrary(lib) {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (lib.test()) {
        console.log(`✅ ${lib.name} already loaded`);
        resolve();
        return;
      }
      
      // Create script element
      const script = document.createElement('script');
      script.src = lib.url;
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        if (lib.test()) {
          console.log(`✅ ${lib.name} loaded from CDN`);
          loadedCount++;
          resolve();
        } else {
          console.warn(`⚠️ ${lib.name} loaded but test failed`);
          loadWithFallback(lib).then(resolve).catch(reject);
        }
      };
      
      script.onerror = () => {
        console.warn(`⚠️ ${lib.name} CDN failed, trying fallback`);
        loadWithFallback(lib).then(resolve).catch(reject);
      };
      
      document.head.appendChild(script);
    });
  }
  
  // Load library from fallback URL
  function loadWithFallback(lib) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = lib.fallback;
      
      script.onload = () => {
        if (lib.test()) {
          console.log(`✅ ${lib.name} loaded from fallback`);
          resolve();
        } else {
          console.error(`❌ ${lib.name} fallback failed`);
          failedLibraries.push(lib.name);
          reject(new Error(`Failed to load ${lib.name}`));
        }
      };
      
      script.onerror = () => {
        console.error(`❌ ${lib.name} fallback failed`);
        failedLibraries.push(lib.name);
        reject(new Error(`Failed to load ${lib.name}`));
      };
      
      document.head.appendChild(script);
    });
  }
  
  // Load all libraries
  window.__cdnLoadPromise = Promise.all(
    cdnLibraries.map(lib => loadLibrary(lib).catch(err => {
      console.error(err);
      // Continue loading even if one fails
      return Promise.resolve();
    }))
  ).then(() => {
    console.log(`CDN Loader: ${loadedCount}/${cdnLibraries.length} libraries loaded from CDN`);
    if (failedLibraries.length > 0) {
      console.error('Failed to load:', failedLibraries);
    }
  });
})();