#!/usr/bin/env node

/**
 * Script to calculate SHA-256 hash for inline scripts used in CSP
 * This hash is needed to allow specific inline scripts while removing 'unsafe-inline'
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the actual HTML file
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract the theme detection script content (everything between <script> and </script>)
// Using case-insensitive flag to handle both <script> and <SCRIPT> tags
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
  console.error('ERROR: Could not find inline script in index.html');
  process.exit(1);
}

// Get the exact script content (without the script tags)
const themeDetectionScript = scriptMatch[1];

// Calculate SHA-256 hash
const hash = crypto.createHash('sha256');
hash.update(themeDetectionScript);
const hashBase64 = hash.digest('base64');

console.log('Theme Detection Script Hash:');
console.log(`sha256-${hashBase64}`);
console.log('\nAdd this to your CSP script-src directive in public/_headers:');
console.log(`'sha256-${hashBase64}'`);
console.log('\nFull CSP script-src example:');
console.log(
  `script-src 'self' 'sha256-${hashBase64}' https://us.i.posthog.com https://us-assets.i.posthog.com https://vercel.live;`
);

// Show the exact script content for verification
console.log('\nScript content being hashed (including all whitespace):');
console.log('--- START ---');
console.log(themeDetectionScript);
console.log('--- END ---');
