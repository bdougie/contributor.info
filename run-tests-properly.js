#!/usr/bin/env node

import { execSync } from 'child_process';

console.log('Running Storybook tests with proper method...');

try {
  // Use the concurrently approach that actually works
  execSync(`npx concurrently -k -s first -n "SB,TEST" -c "magenta,blue" \\
    "npx http-server storybook-static --port 6006 --silent" \\
    "npx wait-on tcp:6006 && npx test-storybook"`, {
    stdio: 'inherit',
    shell: true
  });
  
  console.log('Tests completed successfully!');
} catch (error) {
  console.error('Tests failed');
  process.exit(1);
}