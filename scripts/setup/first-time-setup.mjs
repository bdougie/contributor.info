#!/usr/bin/env node

/**
 * First-Time Setup Script
 *
 * Universal entry point for new contributors. Chains together all setup steps:
 * 1. Platform detection
 * 2. Prerequisite validation (Node, npm, Docker, Git)
 * 3. Environment file creation (.env.local from .env.example)
 * 4. Switch to local environment
 * 5. Start local Supabase
 * 6. Run consolidated migrations
 * 7. Print seed data instructions
 * 8. Run verification
 * 9. Print next steps
 *
 * Usage: npm run setup
 */

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  blue: '\x1b[34m',
};

function log(message, color = '') {
  console.log('%s%s%s', color, message, colors.reset);
}

function logStep(step, total, message) {
  console.log('%s[%d/%d]%s %s', colors.cyan + colors.bright, step, total, colors.reset, message);
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

function banner() {
  console.log('');
  log('='.repeat(60), colors.cyan);
  log('  contributor.info - First-Time Setup', colors.bright + colors.cyan);
  log('='.repeat(60), colors.cyan);
  console.log('');
}

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

function detectPlatform() {
  const platform = os.platform();
  const release = os.release();

  if (platform === 'darwin') return 'macOS';
  if (platform === 'win32') {
    // Check for WSL2 via environment hints
    if (process.env.WSL_DISTRO_NAME || release.toLowerCase().includes('microsoft')) {
      return 'WSL2';
    }
    return 'Windows';
  }
  if (platform === 'linux') {
    // Detect WSL2 on Linux side
    if (release.toLowerCase().includes('microsoft') || process.env.WSL_DISTRO_NAME) {
      return 'WSL2';
    }
    return 'Linux';
  }
  return platform;
}

// ---------------------------------------------------------------------------
// Prerequisite checks
// ---------------------------------------------------------------------------

function commandExists(cmd) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

function getCommandOutput(cmd) {
  try {
    return execSync(cmd, { stdio: 'pipe', encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return null;
  }
}

function checkNode() {
  const version = process.version;
  const major = parseInt(version.replace('v', '').split('.')[0], 10);

  if (major < 20) {
    logError('Node.js >= 20 required. Current: %s');
    console.log('  Current: %s', version);
    console.log('  Install: https://nodejs.org/');
    return false;
  }
  logSuccess('  Node.js %s');
  // Print the actual version after the checkmark
  process.stdout.write('\x1b[1A'); // move up
  logSuccess('  Node.js ' + version);
  return true;
}

function checkNpm() {
  const version = getCommandOutput('npm --version');
  if (!version) {
    logError('  npm not found');
    return false;
  }
  const major = parseInt(version.split('.')[0], 10);
  if (major < 10) {
    logError('  npm >= 10 required. Current: ' + version);
    return false;
  }
  logSuccess('  npm ' + version);
  return true;
}

function checkDocker() {
  if (!commandExists('docker info')) {
    logError('  Docker is not running');
    console.log('');
    logWarn('  Please install and start Docker Desktop:');
    logWarn('    https://www.docker.com/products/docker-desktop/');
    console.log('');
    return false;
  }
  logSuccess('  Docker is running');
  return true;
}

function checkGit() {
  const version = getCommandOutput('git --version');
  if (!version) {
    logError('  Git not found');
    console.log('  Install: https://git-scm.com/downloads');
    return false;
  }
  logSuccess('  Git installed');
  return true;
}

function checkPrerequisites() {
  log('Checking prerequisites...', colors.cyan);
  console.log('');

  const nodeOk = checkNode();
  const npmOk = checkNpm();
  const dockerOk = checkDocker();
  const gitOk = checkGit();

  console.log('');
  return nodeOk && npmOk && dockerOk && gitOk;
}

// ---------------------------------------------------------------------------
// Environment setup
// ---------------------------------------------------------------------------

function setupEnvFile() {
  const envLocalPath = path.join(ROOT, '.env.local');
  const envExamplePath = path.join(ROOT, '.env.example');

  if (fs.existsSync(envLocalPath)) {
    logSuccess('  .env.local already exists (skipping)');
    return true;
  }

  if (!fs.existsSync(envExamplePath)) {
    logError('  .env.example not found - cannot create .env.local');
    return false;
  }

  try {
    fs.copyFileSync(envExamplePath, envLocalPath);
    logSuccess('  Created .env.local from .env.example');
    return true;
  } catch (err) {
    logError('  Failed to create .env.local: ' + err.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Run child scripts via spawn
// ---------------------------------------------------------------------------

function runScript(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: ROOT,
      shell: true,
    });

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

// ---------------------------------------------------------------------------
// Check if Supabase is already running
// ---------------------------------------------------------------------------

function isSupabaseRunning() {
  const output = getCommandOutput('npx supabase status 2>&1');
  if (!output) return false;
  return (
    output.includes('supabase local development setup is running') || output.includes('API URL')
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const totalSteps = 7;
  let currentStep = 0;

  banner();

  // Platform
  const platform = detectPlatform();
  log('Platform: ' + platform, colors.dim);
  console.log('');

  // Step 1: Prerequisites
  currentStep++;
  logStep(currentStep, totalSteps, 'Checking prerequisites');
  console.log('');

  if (!checkPrerequisites()) {
    logError('Prerequisites not met. Please fix the issues above and re-run:');
    logError('  npm run setup');
    process.exit(1);
  }
  logSuccess('All prerequisites met');
  console.log('');

  // Step 2: Environment file
  currentStep++;
  logStep(currentStep, totalSteps, 'Setting up environment');
  console.log('');

  if (!setupEnvFile()) {
    process.exit(1);
  }

  // Switch to local environment
  try {
    await runScript(
      'node',
      [path.join('scripts', 'setup', 'switch-environment.js'), 'local'],
      'env:local'
    );
    logSuccess('  Environment switched to local');
  } catch (err) {
    logError('  Failed to switch environment: ' + err.message);
    process.exit(1);
  }
  console.log('');

  // Step 3: Start Supabase
  currentStep++;
  logStep(currentStep, totalSteps, 'Starting local Supabase');
  console.log('');

  if (isSupabaseRunning()) {
    logSuccess('  Supabase is already running (skipping)');
  } else {
    try {
      await runScript(
        'node',
        [path.join('scripts', 'setup', 'start-local-supabase.js')],
        'supabase:start'
      );
      logSuccess('  Supabase started');
    } catch (err) {
      logError('  Failed to start Supabase: ' + err.message);
      logWarn('  Make sure Docker is running and try again.');
      process.exit(1);
    }
  }
  console.log('');

  // Step 4: Run migrations
  currentStep++;
  logStep(currentStep, totalSteps, 'Running database migrations');
  console.log('');

  try {
    await runScript(
      'node',
      [path.join('supabase', 'migrations-local', 'setup-local.mjs'), '--consolidated'],
      'supabase:migrate:consolidated'
    );
    logSuccess('  Migrations applied');
  } catch (err) {
    logError('  Migration failed: ' + err.message);
    logWarn('  You can retry with: npm run supabase:migrate:consolidated');
    process.exit(1);
  }
  console.log('');

  // Step 5: Seed data instructions
  currentStep++;
  logStep(currentStep, totalSteps, 'Seed data (optional)');
  console.log('');

  logWarn('  Seed data generation requires a GitHub token.');
  log('  To generate seed data later:', colors.dim);
  log('    1. Add VITE_GITHUB_TOKEN to .env.local', colors.dim);
  log('       Create a token at: https://github.com/settings/tokens/new', colors.dim);
  log('       Required scopes: public_repo, read:user', colors.dim);
  log('    2. Run: npm run db:seed', colors.dim);
  console.log('');

  // Step 6: Verification
  currentStep++;
  logStep(currentStep, totalSteps, 'Verifying setup');
  console.log('');

  try {
    await runScript('node', [path.join('scripts', 'setup', 'verify-setup.mjs')], 'setup:verify');
  } catch {
    logWarn('  Some verification checks failed - see details above');
  }
  console.log('');

  // Step 7: Next steps
  currentStep++;
  logStep(currentStep, totalSteps, 'Done!');
  console.log('');

  log('='.repeat(60), colors.green);
  log('  Setup complete!', colors.bright + colors.green);
  log('='.repeat(60), colors.green);
  console.log('');
  log('Next steps:', colors.bright);
  log('  1. Start the dev server:', colors.dim);
  log('     npm run dev', colors.cyan);
  console.log('');
  log('  2. Open in browser:', colors.dim);
  log('     http://localhost:5173', colors.cyan);
  console.log('');
  log('  3. Supabase Studio (database UI):', colors.dim);
  log('     http://localhost:54323', colors.cyan);
  console.log('');
  log('  4. Generate seed data (optional):', colors.dim);
  log('     npm run db:seed', colors.cyan);
  console.log('');
  log('Useful commands:', colors.bright);
  log('  npm run setup:verify   - Check setup health', colors.dim);
  log('  npm run setup:reset    - Reset local environment', colors.dim);
  log('  npm run supabase:stop  - Stop Supabase containers', colors.dim);
  console.log('');
}

main().catch((err) => {
  logError('Setup failed: ' + err.message);
  process.exit(1);
});
