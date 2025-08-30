#!/usr/bin/env node

// Start Supabase locally without auto-running migrations and seed by temporarily moving
// the supabase/migrations directory and seed.sql out of the way, then restoring them.
//
// Notes:
// - ESM module (package.json has "type": "module")
// - Avoids console.log template literals; uses printf-style formatting
// - Includes race condition protection and stale lock detection
//
// Version: 2.0.0 - Improved with critical fixes

import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(path.join(__dirname, '..', '..'));

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Track ownership to avoid interfering with concurrent runs
let migrationsMoved = false;
let seedWasMoved = false;
let processId = process.pid;

// Lock files with process ID for ownership tracking
const LOCK_FILE_MIGRATIONS = path.join(ROOT, 'supabase', '.migrations-lock.json');
const LOCK_FILE_SEED = path.join(ROOT, 'supabase', '.seed-lock.json');
const STALE_LOCK_TIMEOUT = 10 * 60 * 1000; // 10 minutes

function log(message, color = '') {
  // Security: no template literals in console.log
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log('[%s] %s%s%s', timestamp, color, message, colors.reset);
}

function error(message) {
  log('❌ Error: ' + message, colors.red);
}

// Check if Docker is running
async function isDockerRunning() {
  try {
    const { stdout } = await execAsync('docker info');
    return stdout.includes('Server Version');
  } catch (e) {
    return false;
  }
}

// Check if Supabase CLI is installed
async function isSupabaseCliInstalled() {
  try {
    const { stdout } = await execAsync('npx supabase --version');
    // Check for version number pattern (e.g., "2.39.2")
    return /\d+\.\d+\.\d+/.test(stdout);
  } catch (e) {
    return false;
  }
}

// Validate prerequisites
async function validatePrerequisites() {
  log('🔍 Validating prerequisites...', colors.cyan);

  const dockerRunning = await isDockerRunning();
  if (!dockerRunning) {
    error('Docker is not running. Please start Docker Desktop and try again.');
    return false;
  }

  const supabaseInstalled = await isSupabaseCliInstalled();
  if (!supabaseInstalled) {
    error('Supabase CLI is not installed. Run: npm install -g supabase');
    return false;
  }

  log('✅ Prerequisites validated', colors.green);
  return true;
}

// Check if a lock file is stale
function isLockStale(lockPath) {
  if (!fs.existsSync(lockPath)) {
    return false;
  }

  try {
    const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    const lockAge = Date.now() - lockData.timestamp;

    // Check if lock is stale (older than timeout)
    if (lockAge > STALE_LOCK_TIMEOUT) {
      log('🔓 Found stale lock from PID %s (age: %sms)', colors.yellow, lockData.pid, lockAge);
      return true;
    }

    // Check if the process is still running (Unix-like systems)
    if (process.platform !== 'win32') {
      try {
        // Send signal 0 to check if process exists
        process.kill(lockData.pid, 0);
        return false; // Process is still running
      } catch (e) {
        // Process doesn't exist, lock is stale
        log('🔓 Lock owner process %s is not running', colors.yellow, lockData.pid);
        return true;
      }
    }

    return false;
  } catch (e) {
    // If we can't read the lock file, consider it stale
    return true;
  }
}

// Create a lock file
function createLock(lockPath) {
  const lockData = {
    pid: processId,
    timestamp: Date.now(),
    node: process.version,
    platform: process.platform,
  };

  try {
    fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2));
    return true;
  } catch (e) {
    error('Failed to create lock file: ' + e.message);
    return false;
  }
}

// Remove a lock file (only if we own it)
function removeLock(lockPath) {
  if (!fs.existsSync(lockPath)) {
    return;
  }

  try {
    const lockData = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (lockData.pid === processId) {
      fs.unlinkSync(lockPath);
    }
  } catch (e) {
    // Ignore errors during cleanup
  }
}

function isSupabaseRunning() {
  return new Promise((resolve) => {
    exec('npx supabase status', (error, stdout) => {
      if (error) {
        resolve(false);
        return;
      }
      resolve(
        typeof stdout === 'string' && stdout.includes('supabase local development setup is running')
      );
    });
  });
}

function temporarilyMoveMigrations() {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const tempDir = path.join(ROOT, 'supabase', 'migrations.temp');

  if (fs.existsSync(migrationsDir)) {
    log('📦 Temporarily moving migrations to prevent auto-migration...', colors.yellow);

    // Check for existing temp directory (potential lock)
    if (fs.existsSync(tempDir)) {
      // Check if there's a stale lock
      if (isLockStale(LOCK_FILE_MIGRATIONS)) {
        log('🧹 Cleaning up stale migrations lock...', colors.magenta);
        removeLock(LOCK_FILE_MIGRATIONS);
        // Attempt to restore the stale temp directory
        if (fs.existsSync(tempDir) && !fs.existsSync(migrationsDir)) {
          fs.renameSync(tempDir, migrationsDir);
          log('✅ Recovered migrations from stale temp directory', colors.green);
        }
        return false;
      }

      log(
        'ℹ️ Detected existing migrations.temp; another process may be running. Skipping migrations move.',
        colors.yellow
      );
      return false;
    }

    // Create lock file
    if (!createLock(LOCK_FILE_MIGRATIONS)) {
      return false;
    }

    // Move migrations to temp, then create an empty migrations dir with .gitkeep
    try {
      fs.renameSync(migrationsDir, tempDir);
    } catch (e) {
      // Race condition or permissions issue; skip moving
      removeLock(LOCK_FILE_MIGRATIONS);
      return false;
    }

    try {
      fs.mkdirSync(migrationsDir, { recursive: true });
      fs.writeFileSync(path.join(migrationsDir, '.gitkeep'), '');
    } catch (e) {
      // Rollback on failure
      try {
        fs.rmSync(migrationsDir, { recursive: true, force: true });
        fs.renameSync(tempDir, migrationsDir);
      } catch (_) {
        error('Failed to rollback migrations move');
      }
      removeLock(LOCK_FILE_MIGRATIONS);
      throw e;
    }

    return true;
  }
  return false;
}

function restoreMigrations() {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const tempDir = path.join(ROOT, 'supabase', 'migrations.temp');

  // Only restore if we own the lock
  if (fs.existsSync(LOCK_FILE_MIGRATIONS)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE_MIGRATIONS, 'utf8'));
      if (lockData.pid !== processId) {
        // Not our lock, don't touch
        return;
      }
    } catch (e) {
      // Can't read lock, don't restore
      return;
    }
  }

  if (fs.existsSync(tempDir) && migrationsMoved) {
    log('📦 Restoring migrations...', colors.yellow);

    try {
      // Only remove the placeholder directory if we created it
      if (fs.existsSync(migrationsDir)) {
        const gitkeepPath = path.join(migrationsDir, '.gitkeep');
        // Verify it's our placeholder (only contains .gitkeep)
        const files = fs.readdirSync(migrationsDir);
        if (files.length === 1 && files[0] === '.gitkeep' && fs.existsSync(gitkeepPath)) {
          fs.rmSync(migrationsDir, { recursive: true, force: true });
        }
      }

      fs.renameSync(tempDir, migrationsDir);
      removeLock(LOCK_FILE_MIGRATIONS);
      log('✅ Migrations restored successfully', colors.green);
    } catch (e) {
      error('Failed to restore migrations: ' + e.message);
    }
  }
}

function temporarilyMoveSeed() {
  const seedPath = path.join(ROOT, 'supabase', 'seed.sql');
  const tempSeedPath = path.join(ROOT, 'supabase', 'seed.sql.temp');

  const seedExists = fs.existsSync(seedPath);
  const tempExists = fs.existsSync(tempSeedPath);

  if (!seedExists && tempExists) {
    // Check for stale lock
    if (isLockStale(LOCK_FILE_SEED)) {
      log('🧹 Cleaning up stale seed lock...', colors.magenta);
      removeLock(LOCK_FILE_SEED);
      // Attempt to restore
      if (!fs.existsSync(seedPath)) {
        fs.renameSync(tempSeedPath, seedPath);
        log('✅ Recovered seed.sql from stale temp file', colors.green);
      }
      return false;
    }

    log('ℹ️ seed.sql appears already moved by another process; skipping.', colors.yellow);
    return false;
  }

  if (tempExists) {
    // Check if it's a stale lock
    if (isLockStale(LOCK_FILE_SEED)) {
      log('🧹 Cleaning up stale seed temp file...', colors.magenta);
      fs.unlinkSync(tempSeedPath);
      removeLock(LOCK_FILE_SEED);
    } else {
      log(
        'ℹ️ Detected existing seed.sql.temp; another process may be running. Skipping seed move.',
        colors.yellow
      );
      return false;
    }
  }

  if (seedExists) {
    log('📦 Temporarily moving seed.sql to prevent auto-seeding...', colors.yellow);

    // Create lock file
    if (!createLock(LOCK_FILE_SEED)) {
      return false;
    }

    try {
      // Create backup first
      const backupPath = seedPath + '.backup.' + processId;
      fs.copyFileSync(seedPath, backupPath);

      try {
        // Move the real seed aside
        fs.renameSync(seedPath, tempSeedPath);

        // Write placeholder
        fs.writeFileSync(seedPath, '-- no-op seed for local start\nSELECT 1;\n', { flag: 'w' });

        // Remove backup on success
        fs.unlinkSync(backupPath);
      } catch (e) {
        // Restore from backup
        fs.copyFileSync(backupPath, seedPath);
        fs.unlinkSync(backupPath);
        removeLock(LOCK_FILE_SEED);
        throw e;
      }
    } catch (e) {
      removeLock(LOCK_FILE_SEED);
      error('Failed to move seed.sql: ' + e.message);
      return false;
    }

    return true;
  }
  return false;
}

function restoreSeed() {
  const seedPath = path.join(ROOT, 'supabase', 'seed.sql');
  const tempSeedPath = path.join(ROOT, 'supabase', 'seed.sql.temp');

  // Only restore if we own the lock
  if (fs.existsSync(LOCK_FILE_SEED)) {
    try {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE_SEED, 'utf8'));
      if (lockData.pid !== processId) {
        // Not our lock, don't touch
        return;
      }
    } catch (e) {
      // Can't read lock, don't restore
      return;
    }
  }

  if (fs.existsSync(tempSeedPath) && seedWasMoved) {
    log('📦 Restoring seed.sql...', colors.yellow);

    try {
      // Remove placeholder if it exists
      if (fs.existsSync(seedPath)) {
        const content = fs.readFileSync(seedPath, 'utf8');
        // Only remove if it's our placeholder
        if (content.includes('-- no-op seed for local start')) {
          fs.rmSync(seedPath, { force: true });
        }
      }

      fs.renameSync(tempSeedPath, seedPath);
      removeLock(LOCK_FILE_SEED);
      log('✅ seed.sql restored successfully', colors.green);
    } catch (e) {
      error('Failed to restore seed.sql: ' + e.message);
    }
  }
}

function startSupabase() {
  log('🚀 Starting Supabase without auto-migrations and auto-seed...', colors.cyan);

  return new Promise((resolve, reject) => {
    // Add timeout to prevent hanging (5 minutes)
    const timeout = setTimeout(
      () => {
        supabaseProcess.kill('SIGTERM');
        reject(
          new Error('Supabase start timed out after 5 minutes. Check Docker status and try again.')
        );
      },
      5 * 60 * 1000
    );

    const supabaseProcess = spawn('npx', ['supabase', 'start'], {
      stdio: 'inherit',
      shell: true,
    });

    // Handle spawn errors (e.g., ENOENT) so we can restore migrations/seed properly
    supabaseProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error('Failed to start Supabase: ' + err.message));
    });

    supabaseProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
      } else {
        const errorMsg =
          'Supabase start failed with exit code ' +
          code +
          '. Check Docker is running and Supabase CLI is installed.';
        reject(new Error(errorMsg));
      }
    });
  });
}

async function main() {
  try {
    // Validate prerequisites first
    const valid = await validatePrerequisites();
    if (!valid) {
      process.exit(1);
    }

    const running = await isSupabaseRunning();
    if (running) {
      log('✅ Supabase is already running!', colors.green);
      log('Run migrations: npm run supabase:migrate:local', colors.cyan);
      return;
    }

    const moved = temporarilyMoveMigrations();
    const seedMoved = temporarilyMoveSeed();
    // Track ownership for out-of-band restoration (errors/SIGINT)
    migrationsMoved = moved;
    seedWasMoved = seedMoved;

    try {
      await startSupabase();
      log('✅ Supabase started successfully!', colors.green);
      log('📝 Next step: npm run supabase:migrate:local', colors.cyan);
    } finally {
      if (seedMoved) restoreSeed();
      if (moved) restoreMigrations();
      // Clear ownership after normal completion
      migrationsMoved = false;
      seedWasMoved = false;
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    error(message);
    // Attempt to restore only if we own the moved resources
    try {
      if (seedWasMoved) restoreSeed();
    } catch (_) {
      /* ignore restoration errors */
    }
    try {
      if (migrationsMoved) restoreMigrations();
    } catch (_) {
      /* ignore restoration errors */
    }
    process.exit(1);
  }
}

// Handle interruption signals
process.on('SIGINT', () => {
  log('\n⚠️ Interrupted, cleaning up...', colors.yellow);
  try {
    if (seedWasMoved) restoreSeed();
  } catch (_) {
    /* ignore restoration errors */
  }
  try {
    if (migrationsMoved) restoreMigrations();
  } catch (_) {
    /* ignore restoration errors */
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n⚠️ Terminated, cleaning up...', colors.yellow);
  try {
    if (seedWasMoved) restoreSeed();
  } catch (_) {
    /* ignore restoration errors */
  }
  try {
    if (migrationsMoved) restoreMigrations();
  } catch (_) {
    /* ignore restoration errors */
  }
  process.exit(0);
});

// Run the main function
main();
