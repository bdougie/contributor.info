#!/usr/bin/env node

/**
 * Encode GitHub App private key for Netlify environment variables
 * Preserves newlines by replacing them with a placeholder
 */

const fs = require('fs');
const path = require('path');

const pemFile = process.argv[2];
if (!pemFile) {
  console.error('Usage: node encode-private-key.js <path-to-pem-file>');
  process.exit(1);
}

try {
  // Read the PEM file
  const pemContent = fs.readFileSync(pemFile, 'utf8');

  // Replace newlines with \n literal (not actual newlines)
  const encoded = pemContent.replace(/\n/g, '\\n');

  console.log('Encoded private key:');
  console.log('===================');
  console.log(encoded);
  console.log('===================');
  console.log(`\nLength: ${encoded.length} bytes`);
  console.log('\nTo use in Netlify:');
  console.log('1. Copy the encoded string above');
  console.log('2. Set GITHUB_APP_PRIVATE_KEY_ENCODED in Netlify');
  console.log('3. The app will decode it at runtime');
} catch (error) {
  console.error('Error reading file:', error.message);
  process.exit(1);
}
