#!/usr/bin/env node

/**
 * CI check to verify that the CSP hash in _headers matches the actual inline script
 * This prevents deployment with mismatched CSP hashes that would block the theme script
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the HTML file
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Extract the theme detection script content
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) {
  console.error('❌ ERROR: Could not find inline script in index.html');
  process.exit(1);
}

const scriptContent = scriptMatch[1];

// Calculate the hash
const hash = crypto.createHash('sha256');
hash.update(scriptContent);
const calculatedHash = `sha256-${hash.digest('base64')}`;

// Read the _headers file
const headersPath = path.join(__dirname, '..', 'public', '_headers');
const headersContent = fs.readFileSync(headersPath, 'utf8');

// Extract the CSP hash from _headers
const cspMatch = headersContent.match(/script-src[^;]*'(sha256-[^']+)'/);
if (!cspMatch) {
  console.error('❌ ERROR: Could not find CSP hash in public/_headers');
  process.exit(1);
}

const declaredHash = cspMatch[1];

// Compare hashes
if (calculatedHash === declaredHash) {
  console.log('✅ CSP hash verification passed');
  console.log(`   Hash: ${calculatedHash}`);
  process.exit(0);
} else {
  console.error('❌ ERROR: CSP hash mismatch!');
  console.error(`   Expected: ${calculatedHash}`);
  console.error(`   Found:    ${declaredHash}`);
  console.error('');
  console.error('To fix this:');
  console.error('1. Run: node scripts/calculate-csp-hash.js');
  console.error('2. Update the hash in public/_headers');
  console.error('');
  console.error('Note: The hash must include ALL whitespace in the script,');
  console.error('including leading/trailing newlines and spaces.');
  process.exit(1);
}
