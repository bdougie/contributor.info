#!/usr/bin/env npx tsx

/**
 * Build script to embed Continue Agent App credentials into the action
 * Run this locally with the App credentials to update the encrypted config
 * 
 * Usage:
 *   CONTINUE_APP_ID=123456 CONTINUE_APP_PRIVATE_KEY="$(cat private-key.pem)" npx tsx build-embedded-auth.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { encryptForStorage } from './app-config-encrypted';

const appId = process.env.CONTINUE_APP_ID;
const privateKey = process.env.CONTINUE_APP_PRIVATE_KEY;

if (!appId || !privateKey) {
  console.error('Error: CONTINUE_APP_ID and CONTINUE_APP_PRIVATE_KEY must be set');
  process.exit(1);
}

// Encrypt the credentials
const encryptedAppId = encryptForStorage(appId);
const encryptedPrivateKey = encryptForStorage(privateKey);

// Read the current app-config-encrypted.ts file
const configPath = path.join(__dirname, 'app-config-encrypted.ts');
let configContent = fs.readFileSync(configPath, 'utf8');

// Replace the encrypted values
configContent = configContent.replace(
  /const ENCRYPTED_CONFIG = \{[\s\S]*?\};/,
  `const ENCRYPTED_CONFIG = {
  appId: '${encryptedAppId}',
  privateKey: '${encryptedPrivateKey}',
};`
);

// Write back the updated file
fs.writeFileSync(configPath, configContent);

console.log('✅ Successfully embedded encrypted Continue Agent App credentials');
console.log(`   App ID: ${appId}`);
console.log('   Private key: [ENCRYPTED]');
console.log('');
console.log('The action will now use these credentials automatically.');
console.log('Commit the updated app-config-encrypted.ts file.');