#!/usr/bin/env node

/**
 * Reset Setup Script
 *
 * Tears down the local development environment for a clean start:
 * 1. Stop Supabase containers
 * 2. Remove .env.local backup files
 * 3. Reset database
 * 4. Print re-setup instructions
 *
 * Usage: npm run setup:reset
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(message, color = '') {
  console.log('%s%s%s', color, message, colors.reset);
}

function logSuccess(message) {
  log(message, colors.green);
}

function logWarn(message) {
  log(message, colors.yellow);
}

function logError(message) {
  log(message, colors.red);
}

function runCommand(command, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { stdio: 'inherit', cwd: ROOT, shell: true });

    child.on('error', (err) => {
      reject(new Error('Failed to run ' + label + ': ' + err.message));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(label + ' exited with code ' + code));
      }
    });
  });
}

function getCommandOutput(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', timeout: 15000 }).trim();
  } catch {
    return null;
  }
}

function isSupabaseRunning() {
  const output = getCommandOutput('npx supabase status 2>&1');
  if (!output) return false;
  return (
    output.includes('supabase local development setup is running') || output.includes('API URL')
  );
}

// ---------------------------------------------------------------------------
// Reset steps
// ---------------------------------------------------------------------------

async function stopSupabase() {
  if (!isSupabaseRunning()) {
    logSuccess('  Supabase is not running (skipping)');
    return;
  }

  log('  Stopping Supabase...', colors.dim);
  try {
    await runCommand('npx supabase stop', 'supabase stop');
    logSuccess('  Supabase stopped');
  } catch (err) {
    logWarn('  Could not stop Supabase: ' + err.message);
  }
}

function cleanBackupFiles() {
  let cleaned = 0;

  // Clean .env.local backup files
  try {
    const files = fs.readdirSync(ROOT);
    const backups = files.filter((f) => /^\.env\.local\.backup\.\d+$/.test(f));

    for (const backup of backups) {
      const fullPath = path.join(ROOT, backup);
      fs.unlinkSync(fullPath);
      cleaned++;
    }
  } catch {
    // Ignore errors
  }

  // Clean any stale lock files in supabase directory
  const lockFiles = [
    path.join(ROOT, 'supabase', '.migrations-lock.json'),
    path.join(ROOT, 'supabase', '.seed-lock.json'),
    path.join(ROOT, 'supabase', 'migrations-local', '.lock'),
  ];

  for (const lockFile of lockFiles) {
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
        cleaned++;
      } catch {
        // Ignore errors
      }
    }
  }

  if (cleaned > 0) {
    logSuccess('  Cleaned ' + cleaned + ' backup/lock files');
  } else {
    logSuccess('  No backup/lock files to clean');
  }
}

async function resetDatabase() {
  if (!isSupabaseRunning()) {
    logWarn('  Supabase is not running - skipping database reset');
    return;
  }

  log('  Resetting database...', colors.dim);
  try {
    await runCommand('npx supabase db reset', 'supabase db reset');
    logSuccess('  Database reset');
  } catch (err) {
    logWarn('  Database reset failed: ' + err.message);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('');
  log('='.repeat(60), colors.cyan);
  log('  contributor.info - Reset Local Environment', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
  console.log('');

  // Step 1: Stop Supabase
  log('1. Stopping Supabase containers', colors.bright);
  await stopSupabase();
  console.log('');

  // Step 2: Clean backup and lock files
  log('2. Cleaning backup and lock files', colors.bright);
  cleanBackupFiles();
  console.log('');

  // Step 3: Reset database (only if Supabase was still running after stop attempt)
  log('3. Resetting database', colors.bright);
  await resetDatabase();
  console.log('');

  // Summary
  log('='.repeat(60), colors.green);
  log('  Reset complete!', colors.bright + colors.green);
  log('='.repeat(60), colors.green);
  console.log('');

  log('To set up again, run:', colors.bright);
  log('  npm run setup', colors.cyan);
  console.log('');

  log('Or start individual components:', colors.dim);
  log('  npm run supabase:start                  - Start Supabase', colors.dim);
  log('  npm run supabase:migrate:consolidated   - Apply migrations', colors.dim);
  log('  npm run env:local                       - Switch to local env', colors.dim);
  console.log('');
}

main().catch((err) => {
  logError('Reset failed: ' + err.message);
  process.exit(1);
});
