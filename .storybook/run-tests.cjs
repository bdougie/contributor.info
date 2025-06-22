#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

// Configuration
const PORT = 6006;
const URL = `http://127.0.0.1:${PORT}`;

// Get the path to test-storybook binary
const testStorybookPath = path.join(__dirname, '..', 'node_modules', '.bin', 'test-storybook');

async function runTests(includeTags = null) {
  let serverProcess;
  
  try {
    console.log('Killing any existing servers on port 6006...');
    try {
      execSync('pkill -f "http-server.*6006"', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors if no process found
    }
    
    console.log('Starting HTTP server...');
    serverProcess = spawn('npx', ['http-server', 'storybook-static', '--port', PORT.toString(), '--silent'], {
      detached: true,
      stdio: 'ignore'
    });
    
    console.log('Waiting for server to start...');
    execSync(`npx wait-on ${URL}`, { stdio: 'inherit' });
    
    console.log(`Running ${includeTags ? 'accessibility' : 'interaction'} tests...`);
    const args = [];
    if (includeTags) {
      args.push('--includeTags', includeTags);
    }
    
    // Run test-storybook with explicit config
    const configPath = path.join(__dirname, '..', 'test-runner-jest.config.js');
    const testStorybookScript = path.join(__dirname, '..', 'node_modules', '@storybook', 'test-runner', 'dist', 'test-storybook.js');
    const command = `node "${testStorybookScript}" --config "${configPath}" ${args.join(' ')}`;
    console.log('Running command:', command);
    execSync(command, { 
      stdio: 'inherit',
      env: { ...process.env },
      shell: true
    });
    
    console.log('Tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Tests failed:', error.message);
    process.exit(1);
  } finally {
    console.log('Cleaning up...');
    if (serverProcess) {
      try {
        process.kill(-serverProcess.pid);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    try {
      execSync('pkill -f "http-server.*6006"', { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors
    }
  }
}

// Check command line arguments
const isAccessibilityOnly = process.argv.includes('--accessibility');
runTests(isAccessibilityOnly ? 'accessibility' : null);