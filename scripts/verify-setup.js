#!/usr/bin/env node
const { exec } = require('child_process');

console.log('🔍 Verifying local development setup...\n');

// Check Node version
const nodeVersion = process.version;
console.log(`✓ Node.js: ${nodeVersion}`);

// Check required env vars
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_GITHUB_TOKEN',
];

let missingVars = [];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    missingVars.push(varName);
    console.log(`✗ Missing: ${varName}`);
  } else {
    console.log(`✓ ${varName}: Set`);
  }
});

// Check Docker
exec('docker --version', (error, stdout) => {
  if (error) {
    console.log('✗ Docker: Not installed or not running');
  } else {
    console.log(`✓ Docker: ${stdout.trim()}`);
  }
});

// Check Supabase
exec('supabase status', (error, stdout) => {
  if (error) {
    console.log('✗ Supabase: Not running (run: supabase start)');
  } else {
    console.log('✓ Supabase: Running');
  }
});

if (missingVars.length > 0) {
  console.log('\n⚠️  Missing required environment variables!');
  console.log('Copy .env.example to .env.local and fill in values');
  process.exit(1);
} else {
  console.log('\n✅ Setup verification complete!');
}
