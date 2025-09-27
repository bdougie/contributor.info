#!/usr/bin/env node
// Manual recovery script for Supabase consolidated migration automation
// Restores migrations, seed, and cleans up lock/temp files after failed or interrupted automation

import { existsSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';

function log(msg) {
  console.log(msg);
}

function removeIfExists(p) {
  if (existsSync(p)) {
    rmSync(p, { force: true, recursive: true });
    log(`🧹 Removed: ${p}`);
  }
}

function restoreMigrations() {
  const migrationsDir = path.resolve('supabase/migrations');
  const tempDir = path.resolve('supabase/migrations.temp');
  if (existsSync(tempDir)) {
    log('Restoring migrations from temp...');
    removeIfExists(migrationsDir);
    renameSync(tempDir, migrationsDir);
    log('✅ Migrations restored.');
  } else {
    log('No migrations.temp found, skipping migrations restore.');
  }
}

function restoreSeed() {
  const seed = path.resolve('supabase/seed.sql');
  const tempSeed = path.resolve('supabase/seed.sql.temp');
  if (existsSync(tempSeed)) {
    log('Restoring seed.sql from temp...');
    removeIfExists(seed);
    renameSync(tempSeed, seed);
    log('✅ seed.sql restored.');
  } else {
    log('No seed.sql.temp found, skipping seed restore.');
  }
}

function cleanupLock() {
  const lock = path.resolve('supabase/migrations-local/.lock');
  removeIfExists(lock);
}

function cleanupTemps() {
  removeIfExists(path.resolve('supabase/migrations.temp'));
  removeIfExists(path.resolve('supabase/seed.sql.temp'));
}

function main() {
  log('--- Supabase Migration Manual Recovery ---');
  restoreMigrations();
  restoreSeed();
  cleanupLock();
  cleanupTemps();
  log('--- Recovery complete. You may now retry the migration. ---');
}

main();
