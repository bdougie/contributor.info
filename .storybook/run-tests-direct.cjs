#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

// Configuration
const PORT = 6006;
const URL = `http://127.0.0.1:${PORT}`;

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
    
    // Set up environment variables
    const env = {
      ...process.env,
      TARGET_URL: URL,
      TEST_ROOT: path.join(__dirname, '..'),
      NODE_ENV: 'test'
    };
    
    // Run jest directly with the test-runner-jest.config.cjs
    const jestPath = path.join(__dirname, '..', 'node_modules', '.bin', 'jest');
    const configPath = path.join(__dirname, '..', 'test-runner-jest.config.cjs');
    
    const jestArgs = [
      '--config', configPath,
      '--detectOpenHandles',
      '--forceExit'
    ];
    
    if (includeTags) {
      // Jest doesn't have includeTags, so we'll need to use testNamePattern
      jestArgs.push('--testNamePattern', `.*${includeTags}.*`);
    }
    
    const command = `"${jestPath}" ${jestArgs.join(' ')}`;
    console.log('Running jest command:', command);
    
    execSync(command, { 
      stdio: 'inherit',
      env,
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