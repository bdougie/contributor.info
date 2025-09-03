#!/usr/bin/env node

/**
 * Script to calculate SHA-256 hash for inline scripts used in CSP
 * This hash is needed to allow specific inline scripts while removing 'unsafe-inline'
 */

import crypto from 'crypto';

// The exact script content from index.html (lines 70-83)
// IMPORTANT: This must match EXACTLY, including whitespace and formatting
const themeDetectionScript = `(function() {
        // Theme detection script - runs synchronously to prevent FOUC
        const storageKey = 'contributor-info-theme';
        const theme = localStorage.getItem(storageKey) || 'dark';
        
        // Apply theme immediately
        if (theme === 'system') {
          // Check system preference
          const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          document.documentElement.classList.add(systemTheme);
        } else {
          document.documentElement.classList.add(theme);
        }
      })();`;

// Calculate SHA-256 hash
const hash = crypto.createHash('sha256');
hash.update(themeDetectionScript);
const hashBase64 = hash.digest('base64');

console.log('Theme Detection Script Hash:');
console.log(`sha256-${hashBase64}`);
console.log('\nAdd this to your CSP script-src directive:');
console.log(`'sha256-${hashBase64}'`);
console.log('\nFull CSP script-src example:');
console.log(
  `script-src 'self' 'sha256-${hashBase64}' https://us.i.posthog.com https://us-assets.i.posthog.com https://vercel.live;`
);
