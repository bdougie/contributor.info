#!/usr/bin/env node

/**
 * Environment Switcher Script
 * 
 * Helps developers switch between local and production Supabase environments
 * Usage: npm run env:local | npm run env:production
 * 
 * This script:
 * 1. Backs up current .env.local
 * 2. Updates environment variables based on the selected environment
 * 3. Shows the current configuration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..', '..');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

// Environment configurations
const environments = {
  local: {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
    VITE_ENV: 'local',
    description: 'Local Supabase Development',
    instructions: [
      'Make sure Docker is running',
      'Run: npm run supabase:start',
      'Supabase Studio will be available at: http://localhost:54323',
      'Your app will connect to local Supabase at: http://localhost:54321'
    ]
  },
  production: {
    VITE_SUPABASE_URL: 'https://egcxzonpmmcirmgqdrla.supabase.co',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_PRODUCTION_ANON_KEY_HERE',
    VITE_ENV: 'production',
    description: 'Production Supabase',
    instructions: [
      'Using production Supabase instance',
      'Make sure you have the correct production keys in your .env.local',
      'Be careful with database operations!'
    ]
  }
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(60)}`, colors.cyan);
  log(title, colors.bright + colors.cyan);
  log(`${'='.repeat(60)}`, colors.cyan);
}

async function checkDockerRunning() {
  try {
    await execAsync('docker info');
    return true;
  } catch (error) {
    return false;
  }
}

async function checkSupabaseStatus() {
  try {
    const { stdout } = await execAsync('npx supabase status 2>/dev/null');
    return stdout.includes('API URL');
  } catch (error) {
    return false;
  }
}

function readEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+?)[=:](.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        env[key] = value;
      }
    });
    return env;
  } catch (error) {
    return {};
  }
}

function writeEnvFile(filePath, env) {
  const content = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.writeFileSync(filePath, content + '\n');
}

async function switchEnvironment(envName) {
  const envConfig = environments[envName];
  if (!envConfig) {
    log(`Error: Unknown environment '${envName}'`, colors.red);
    log('Available environments: local, production', colors.yellow);
    process.exit(1);
  }

  logSection(`Switching to ${envConfig.description}`);

  // Paths
  const envLocalPath = path.join(rootDir, '.env.local');
  const envExamplePath = path.join(rootDir, '.env.example');
  const envBackupPath = path.join(rootDir, `.env.local.backup.${Date.now()}`);

  // Read current environment
  const currentEnv = readEnvFile(envLocalPath);
  
  // Create backup if .env.local exists
  if (fs.existsSync(envLocalPath)) {
    fs.copyFileSync(envLocalPath, envBackupPath);
    log(`✅ Backed up current .env.local to: ${path.basename(envBackupPath)}`, colors.green);
  }

  // Merge with example if it exists
  let baseEnv = {};
  if (fs.existsSync(envExamplePath)) {
    baseEnv = readEnvFile(envExamplePath);
  }

  // Apply environment-specific changes
  const newEnv = {
    ...baseEnv,
    ...currentEnv,
    ...envConfig
  };

  // Remove the description and instructions fields
  delete newEnv.description;
  delete newEnv.instructions;

  // Write new environment file
  writeEnvFile(envLocalPath, newEnv);
  log(`✅ Updated .env.local for ${envConfig.description}`, colors.green);

  // Show instructions
  console.log('');
  log('Next Steps:', colors.bright + colors.yellow);
  envConfig.instructions.forEach((instruction, index) => {
    log(`  ${index + 1}. ${instruction}`, colors.yellow);
  });

  // Additional checks for local environment
  if (envName === 'local') {
    console.log('');
    log('Checking local environment...', colors.blue);
    
    const dockerRunning = await checkDockerRunning();
    if (dockerRunning) {
      log('  ✅ Docker is running', colors.green);
      
      const supabaseRunning = await checkSupabaseStatus();
      if (supabaseRunning) {
        log('  ✅ Supabase is already running', colors.green);
      } else {
        log('  ⚠️  Supabase is not running. Run: npm run supabase:start', colors.yellow);
      }
    } else {
      log('  ❌ Docker is not running. Please start Docker Desktop first.', colors.red);
    }
  }

  // Show current configuration
  console.log('');
  log('Current Configuration:', colors.bright + colors.blue);
  log(`  VITE_SUPABASE_URL: ${newEnv.VITE_SUPABASE_URL}`, colors.blue);
  log(`  VITE_ENV: ${newEnv.VITE_ENV || 'not set'}`, colors.blue);

  // Clean up old backups (keep only last 5)
  const backupFiles = fs.readdirSync(rootDir)
    .filter(file => file.startsWith('.env.local.backup.'))
    .sort()
    .reverse();
  
  if (backupFiles.length > 5) {
    backupFiles.slice(5).forEach(file => {
      fs.unlinkSync(path.join(rootDir, file));
    });
    log(`\nCleaned up old backup files (kept last 5)`, colors.cyan);
  }

  logSection('Environment Switch Complete! 🎉');
}

// Main execution
const environment = process.argv[2];

if (!environment) {
  log('Usage: node switch-environment.js [local|production]', colors.yellow);
  log('  or: npm run env:local', colors.yellow);
  log('  or: npm run env:production', colors.yellow);
  process.exit(1);
}

switchEnvironment(environment).catch(error => {
  log(`Error: ${error.message}`, colors.red);
  process.exit(1);
});