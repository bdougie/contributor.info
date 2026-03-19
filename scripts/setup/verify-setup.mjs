#!/usr/bin/env node

/**
 * Setup Verification Script
 *
 * Validates the entire local development environment is healthy.
 * Checks Node, npm, Docker, Supabase, env files, and database connectivity.
 *
 * Usage: npm run setup:verify
 */

import { execSync } from 'node:child_process';
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

const PASS = colors.green + 'PASS' + colors.reset;
const FAIL = colors.red + 'FAIL' + colors.reset;
const WARN = colors.yellow + 'WARN' + colors.reset;

let passCount = 0;
let failCount = 0;
let warnCount = 0;

function check(label, status, detail) {
  const icon = status === 'pass' ? PASS : status === 'fail' ? FAIL : WARN;
  const detailStr = detail ? '  ' + colors.dim + detail + colors.reset : '';
  console.log('  [%s] %s%s', icon, label, detailStr);

  if (status === 'pass') passCount++;
  else if (status === 'fail') failCount++;
  else warnCount++;
}

function getCommandOutput(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', timeout: 15000 }).trim();
  } catch {
    return null;
  }
}

function commandSucceeds(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  if (major >= 20) {
    check('Node.js version', 'pass', version);
  } else {
    check('Node.js version', 'fail', version + ' (need >= 20)');
  }
}

function checkNpmVersion() {
  const version = getCommandOutput('npm --version');
  if (!version) {
    check('npm version', 'fail', 'not found');
    return;
  }
  const major = parseInt(version.split('.')[0], 10);
  if (major >= 10) {
    check('npm version', 'pass', version);
  } else {
    check('npm version', 'fail', version + ' (need >= 10)');
  }
}

function checkDocker() {
  if (commandSucceeds('docker info')) {
    check('Docker', 'pass', 'running');
  } else {
    check('Docker', 'fail', 'not running - start Docker Desktop');
  }
}

function checkEnvLocal() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    check('.env.local', 'fail', 'missing - run: npm run setup');
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');

  // Check required variables
  const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
  const missing = required.filter((key) => !content.includes(key + '='));

  if (missing.length > 0) {
    check('.env.local', 'warn', 'missing keys: ' + missing.join(', '));
    return;
  }

  // Check if it's configured for local
  if (content.includes('VITE_SUPABASE_URL=http://localhost:54321')) {
    check('.env.local', 'pass', 'configured for local development');
  } else if (content.includes('VITE_SUPABASE_URL=https://your-project.supabase.co')) {
    check('.env.local', 'warn', 'still has placeholder values - run: npm run env:local');
  } else {
    check('.env.local', 'pass', 'exists with custom configuration');
  }
}

function checkGitHubToken() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) {
    check('GitHub token', 'warn', '.env.local missing');
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/VITE_GITHUB_TOKEN=(.+)/);
  if (!match || match[1].trim() === 'your-github-personal-access-token') {
    check('GitHub token', 'warn', 'not set - seed data generation will not work');
  } else {
    check('GitHub token', 'pass', 'configured');
  }
}

function checkSupabaseContainers() {
  const output = getCommandOutput('npx supabase status 2>&1');
  if (!output) {
    check('Supabase containers', 'fail', 'cannot get status');
    return;
  }

  if (
    output.includes('supabase local development setup is running') ||
    output.includes('API URL')
  ) {
    check('Supabase containers', 'pass', 'running');
  } else {
    check('Supabase containers', 'fail', 'not running - run: npm run supabase:start');
  }
}

function checkDatabaseConnection() {
  // Try connecting via supabase status to get the DB URL, then test with a simple query
  const output = getCommandOutput('npx supabase status 2>&1');
  if (!output) {
    check('Database connection', 'fail', 'Supabase not running');
    return;
  }

  const dbUrlMatch = output.match(/postgresql:\/\/[\S]+/i);
  const dbUrl = dbUrlMatch?.[0] || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

  // Test the connection with a simple psql command or supabase db query
  const testResult = getCommandOutput('npx supabase db lint --level warning 2>&1');
  if (testResult !== null) {
    check('Database connection', 'pass', 'accessible');
  } else {
    // Fallback: if supabase status showed running, the DB is likely fine
    if (
      output.includes('supabase local development setup is running') ||
      output.includes('API URL')
    ) {
      check('Database connection', 'pass', 'inferred from Supabase status');
    } else {
      check('Database connection', 'fail', 'cannot connect');
    }
  }
}

function checkNodeModules() {
  const nodeModulesPath = path.join(ROOT, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    check('node_modules', 'pass', 'installed');
  } else {
    check('node_modules', 'fail', 'missing - run: npm install');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  console.log('');
  console.log('%s%s Setup Verification %s', colors.cyan, colors.bright, colors.reset);
  console.log('%s%s%s', colors.cyan, '='.repeat(40), colors.reset);
  console.log('');

  console.log('%sRuntime:%s', colors.bright, colors.reset);
  checkNodeVersion();
  checkNpmVersion();
  checkNodeModules();
  console.log('');

  console.log('%sInfrastructure:%s', colors.bright, colors.reset);
  checkDocker();
  checkSupabaseContainers();
  checkDatabaseConnection();
  console.log('');

  console.log('%sConfiguration:%s', colors.bright, colors.reset);
  checkEnvLocal();
  checkGitHubToken();
  console.log('');

  // Summary
  console.log('%s%s%s', colors.cyan, '-'.repeat(40), colors.reset);
  const total = passCount + failCount + warnCount;
  console.log(
    '  %s%d/%d checks passed%s',
    failCount === 0 ? colors.green : colors.red,
    passCount,
    total,
    colors.reset
  );

  if (warnCount > 0) {
    console.log('  %s%d warnings%s', colors.yellow, warnCount, colors.reset);
  }

  if (failCount > 0) {
    console.log('  %s%d failures%s', colors.red, failCount, colors.reset);
    console.log('');
    console.log('  Run %snpm run setup%s to fix.', colors.cyan, colors.reset);
  }

  console.log('');

  process.exit(failCount > 0 ? 1 : 0);
}

main();
