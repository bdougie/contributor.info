#!/usr/bin/env node

/**
 * Build configuration script for embedding GitHub App credentials
 * This should be run during your CI/CD process to inject the App credentials
 * 
 * Usage:
 *   APP_ID=123456 APP_PRIVATE_KEY="$(cat private-key.pem)" node build-config.js
 */

const fs = require('fs');
const path = require('path');

// Get credentials from environment
const appId = process.env.CONTINUE_REVIEW_APP_ID;
const privateKey = process.env.CONTINUE_REVIEW_APP_PRIVATE_KEY;

if (!appId || !privateKey) {
  console.log('No App credentials provided, action will use token authentication only');
  process.exit(0);
}

// Create a secure config file
const config = {
  appId: parseInt(appId, 10),
  privateKey: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
};

// Write to a config file that will be included in the action
const configPath = path.join(__dirname, '.app-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

console.log(`App configuration saved (App ID: ${appId})`);
console.log('Remember to add .app-config.json to .gitignore!');