#!/usr/bin/env node

// Start Supabase locally without auto-running migrations by temporarily moving
// the supabase/migrations directory out of the way, then restoring it.
//
// Notes:
// - ESM module (package.json has "type": "module")
// - Avoids console.log template literals; uses printf-style formatting

import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
};

function log(message, color = '') {
  // Security: no template literals in console.log
  console.log('%s%s%s', color, message, colors.reset);
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

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }

    // Move migrations to temp, then create an empty migrations dir with .gitkeep
    fs.renameSync(migrationsDir, tempDir);
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(path.join(migrationsDir, '.gitkeep'), '');

    return true;
  }
  return false;
}

function restoreMigrations() {
  const migrationsDir = path.join(ROOT, 'supabase', 'migrations');
  const tempDir = path.join(ROOT, 'supabase', 'migrations.temp');

  if (fs.existsSync(tempDir)) {
    log('📦 Restoring migrations...', colors.yellow);

    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    fs.renameSync(tempDir, migrationsDir);
  }
}

function startSupabase() {
  log('🚀 Starting Supabase without auto-migrations...', colors.cyan);

  return new Promise((resolve, reject) => {
    const supabaseProcess = spawn('npx', ['supabase', 'start'], {
      stdio: 'inherit',
      shell: true,
    });

    supabaseProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('Failed with code ' + code));
      }
    });
  });
}

async function main() {
  try {
    const running = await isSupabaseRunning();
    if (running) {
      log('✅ Supabase is already running!', colors.green);
      log('Run migrations: bash supabase/migrations-local/setup-local.sh', colors.cyan);
      return;
    }

    const moved = temporarilyMoveMigrations();

    try {
      await startSupabase();
      log('✅ Supabase started!', colors.green);
      log('📝 Next: bash supabase/migrations-local/setup-local.sh', colors.cyan);
    } finally {
      if (moved) restoreMigrations();
    }
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    log('❌ Error: ' + message, colors.red);
    // Attempt to restore migrations before exiting
    try {
      restoreMigrations();
    } catch (_) {
      /* ignore */
    }
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  try {
    restoreMigrations();
  } catch (_) {
    /* ignore */
  }
  process.exit(0);
});

main();
