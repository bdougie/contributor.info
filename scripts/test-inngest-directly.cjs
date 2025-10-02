#!/usr/bin/env node
/**
 * Test the bundled Inngest function directly to reproduce the error
 */

const fs = require('fs');
const path = require('path');

// Try to load the bundled function
const bundledPath = '/tmp/netlify/functions/inngest-prod.js';

if (!fs.existsSync(bundledPath)) {
  console.error('❌ Bundle not found at:', bundledPath);
  console.error('   Run: cd /tmp && unzip /Users/briandouglas/code/contributor.info/.netlify/functions/inngest-prod.zip');
  process.exit(1);
}

console.log('🔍 Testing bundled function:', bundledPath);
console.log('   File size:', fs.statSync(bundledPath).size, 'bytes');

// Set up environment like Netlify would
process.env.NETLIFY = 'true';
process.env.CONTEXT = 'production';
process.env.NODE_ENV = 'production';

try {
  console.log('\n🧪 Attempting to load function...');

  // This should reproduce the error if import.meta is being used
  const func = require(bundledPath);

  console.log('✅ Function loaded successfully!');
  console.log('   Exports:', Object.keys(func));

} catch (error) {
  console.error('\n❌ Error loading function:');
  console.error('   Message:', error.message);

  // Check if this is the fileURLToPath error
  if (error.message.includes('fileURLToPath')) {
    console.error('\n🔴 This is the import.meta.url error!');
    console.error('   The function is trying to use import.meta.url which is undefined in CommonJS');

    // Try to find where in the stack it's happening
    if (error.stack) {
      const stackLines = error.stack.split('\n');
      console.error('\n📍 Stack trace:');
      stackLines.slice(0, 10).forEach(line => {
        if (line.includes('.js:')) {
          const match = line.match(/\.js:(\d+):(\d+)/);
          if (match) {
            console.error(`   Line ${match[1]}, Column ${match[2]}: ${line.trim()}`);
          } else {
            console.error('  ', line);
          }
        }
      });
    }
  } else {
    console.error('\n   Full error:', error);
  }

  process.exit(1);
}

console.log('\n✨ Test completed successfully!');