#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Kill any existing servers
try {
  execSync('pkill -f "http-server.*6006"', { stdio: 'ignore' });
} catch (e) {
  // Ignore
}

console.log('Starting HTTP server...');
const serverProcess = execSync('npx http-server storybook-static --port 6006 --silent &', {
  shell: true,
  stdio: 'ignore'
});

console.log('Waiting for server to start...');
execSync('npx wait-on http://127.0.0.1:6006');

console.log('Running Storybook accessibility tests...');
try {
  // Try to run test-storybook from the project root
  process.chdir(__dirname);
  
  // Use npx to run accessibility tests only
  execSync('npx test-storybook --url http://127.0.0.1:6006 --includeTags accessibility', {
    stdio: 'inherit',
    env: {
      ...process.env
    }
  });
  
  console.log('Accessibility tests completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('Accessibility tests failed');
  process.exit(1);
} finally {
  // Clean up
  try {
    execSync('pkill -f "http-server.*6006"', { stdio: 'ignore' });
  } catch (e) {
    // Ignore
  }
}