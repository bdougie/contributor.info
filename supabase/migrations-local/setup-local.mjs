#!/usr/bin/env node
// Cross-platform local migration runner with consolidated migration support
// - Checks Supabase local status
// - Optionally applies production-based consolidated migration by temporarily managing migration files
// - Falls back to standard migration push

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, mkdirSync, copyFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Track what we moved for cleanup
let migrationsMoved = false;
let seedWasMoved = false;
const processId = process.pid;

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { stdio: 'pipe', encoding: 'utf8', ...opts });
}

function resolveSupabaseCmd() {
  const isWin = process.platform === 'win32';
  const directCmd = isWin ? 'supabase.cmd' : 'supabase';
  const probe = run(directCmd, ['--version']);
  if (probe.status === 0) {
    return { via: 'direct', cmd: directCmd };
  }
  // Try local project binary
  const localBin = path.resolve('node_modules', '.bin', isWin ? 'supabase.cmd' : 'supabase');
  if (existsSync(localBin)) {
    const localProbe = run(localBin, ['--version']);
    if (localProbe.status === 0) return { via: 'local-bin', cmd: localBin };
  }
  // Try npx presence (Windows may require shell or .cmd)
  const npxProbe = run('npx', ['--version']);
  if (npxProbe.status === 0) return { via: 'npx', cmd: 'npx' };
  const npxCmdProbe = run(isWin ? 'npx.cmd' : 'npx', ['--version']);
  if (npxCmdProbe.status === 0) return { via: 'npx', cmd: isWin ? 'npx.cmd' : 'npx' };
  // No safe execution path found
  return { via: 'unavailable', cmd: null };
}

function supabaseStatus(supabaseCmd) {
  if (supabaseCmd.via === 'direct' || supabaseCmd.via === 'local-bin') {
    const result = run(supabaseCmd.cmd, ['status']);
    // Combine stdout and stderr for full output
    result.combinedOutput = (result.stdout || '') + (result.stderr || '');
    return result;
  }
  if (supabaseCmd.via === 'npx') {
    const result = run(supabaseCmd.cmd, ['supabase', 'status']);
    // Combine stdout and stderr for full output
    result.combinedOutput = (result.stdout || '') + (result.stderr || '');
    return result;
  }
  return { status: 1, stdout: '', stderr: 'Supabase CLI not available (direct, local-bin, or npx not found).', error: new Error('Supabase CLI unavailable') };
}

function ensureSupabaseRunning(statusStdout) {
  const out = (statusStdout || '').toLowerCase();
  // Look for the specific phrase or running indicators
  if (!out.includes('supabase local development setup is running') && !out.includes('is running')) {
    console.error('❌ Supabase is not running. Start it first:');
    console.error('   - npm run supabase:start   (project helper)');
    console.error('   - or: npx supabase start');
    console.error('Debug: status output was:', statusStdout?.substring(0, 200));
    process.exit(1);
  }
}

function extractDbUrl(statusStdout) {
  const match = (statusStdout || '').match(/postgresql:\/\/[\S]+/i);
  if (match) return match[0];
  // Fallback to known default
  return process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
}

// Redact sensitive parts of a connection string before logging
function redactDbUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.password) u.password = '****';
    return u.toString();
  } catch (_) {
    // Fallback regex if URL parsing fails
    return String(url).replace(/(postgres(?:ql)?:\/\/[^:\s/]+):[^@\s]+@/i, '$1:****@');
  }
}

function pushMigrations(supabaseCmd, dbUrl, extraArgs = []) {
  if (supabaseCmd.via === 'direct' || supabaseCmd.via === 'local-bin') {
    const res = spawnSync(supabaseCmd.cmd, ['db', 'push', '--db-url', dbUrl, ...extraArgs], { stdio: 'inherit' });
    return res.status ?? 1;
  }
  if (supabaseCmd.via === 'npx') {
    const res = spawnSync(supabaseCmd.cmd, ['supabase', 'db', 'push', '--db-url', dbUrl, ...extraArgs], { stdio: 'inherit' });
    return res.status ?? 1;
  }
  return 1;
}

function temporarilyMoveExistingMigrations() {
  const migrationsDir = path.resolve('supabase/migrations');
  const tempDir = path.resolve('supabase/migrations.temp');
  const consolidatedFile = '20240101000000_production_based_consolidated.sql';
  const consolidatedPath = path.join(migrationsDir, consolidatedFile);

  if (!existsSync(migrationsDir)) {
    console.log('📂 No migrations directory found, creating...');
    mkdirSync(migrationsDir, { recursive: true });
    return false;
  }

  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  if (files.length === 0) {
    console.log('📂 No migration files to move');
    return false;
  }

  console.log('📦 Temporarily moving %d existing migrations...', files.length);

  try {
    // Move entire directory to temp
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    renameSync(migrationsDir, tempDir);

    // Create fresh migrations directory
    mkdirSync(migrationsDir, { recursive: true });
    writeFileSync(path.join(migrationsDir, '.gitkeep'), '');

    // Copy the corrected consolidated migration from migrations-local
    const consolidatedSourcePath = path.resolve('supabase/migrations-local/001_production_based_consolidated.sql');
    if (existsSync(consolidatedSourcePath)) {
      copyFileSync(consolidatedSourcePath, consolidatedPath);
      console.log('✅ Copied corrected consolidated migration from migrations-local');
    } else {
      console.error('❌ Corrected consolidated migration not found: %s', consolidatedSourcePath);
      console.error('   Please ensure 001_production_based_consolidated.sql exists in migrations-local/');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Failed to move migrations:', error.message);
    return false;
  }
}

function restoreExistingMigrations() {
  const migrationsDir = path.resolve('supabase/migrations');
  const tempDir = path.resolve('supabase/migrations.temp');

  if (!existsSync(tempDir) || !migrationsMoved) {
    return;
  }

  console.log('📦 Restoring original migrations...');

  try {
    // Remove ALL files from the current migrations directory (including .gitkeep and our consolidated migration)
    if (existsSync(migrationsDir)) {
      rmSync(migrationsDir, { recursive: true, force: true });
    }

    // Restore original migrations by moving temp directory back
    renameSync(tempDir, migrationsDir);
    console.log('✅ Original migrations restored (all temporary files removed)');
  } catch (error) {
    console.error('❌ Failed to restore migrations:', error.message);
  }
}

function temporarilyMoveSeed() {
  const seedPath = path.resolve('supabase/seed.sql');
  const tempSeedPath = path.resolve('supabase/seed.sql.temp');
  
  if (!existsSync(seedPath)) {
    console.log('📦 No seed.sql file found, skipping seed management');
    return false;
  }
  
  console.log('📦 Temporarily moving seed.sql to prevent seeding errors...');
  
  try {
    // Move original seed file to temp
    copyFileSync(seedPath, tempSeedPath);
    
    // Create a minimal no-op seed file for the consolidated migration
    const noOpSeed = `-- Temporary no-op seed for consolidated migration
-- This prevents seeding errors with tables that don't exist in the consolidated schema
-- Original seed.sql is preserved in seed.sql.temp and will be restored after migration

SELECT 'Consolidated migration seed - no data inserted' as seed_status;
`;
    writeFileSync(seedPath, noOpSeed);
    console.log('✅ seed.sql temporarily replaced with no-op version');
    return true;
  } catch (error) {
    console.error('❌ Failed to move seed.sql:', error.message);
    return false;
  }
}

function restoreSeed() {
  const seedPath = path.resolve('supabase/seed.sql');
  const tempSeedPath = path.resolve('supabase/seed.sql.temp');
  
  if (!existsSync(tempSeedPath) || !seedWasMoved) {
    return;
  }
  
  console.log('📦 Restoring original seed.sql...');
  
  try {
    // Remove the no-op seed file
    if (existsSync(seedPath)) {
      rmSync(seedPath, { force: true });
    }
    
    // Restore original seed file
    renameSync(tempSeedPath, seedPath);
    console.log('✅ Original seed.sql restored successfully');
  } catch (error) {
    console.error('❌ Failed to restore seed.sql:', error.message);
  }
}

function applyConsolidatedMigration(supabaseCmd) {
  const consolidatedTarget = path.resolve('supabase/migrations/20240101000000_production_based_consolidated.sql');

  if (!existsSync(consolidatedTarget)) {
    console.error('❌ Consolidated migration not found: %s', consolidatedTarget);
    console.error('   This should have been restored during the migration move process');
    return 1;
  }

  console.log('📄 Applying consolidated migration: %s', path.basename(consolidatedTarget));

  try {
    // Run database reset to apply only our migration
    console.log('🔄 Running supabase db reset...');
    let resetResult;
    if (supabaseCmd.via === 'direct' || supabaseCmd.via === 'local-bin') {
      resetResult = spawnSync(supabaseCmd.cmd, ['db', 'reset'], { stdio: 'inherit' });
    } else if (supabaseCmd.via === 'npx') {
      resetResult = spawnSync(supabaseCmd.cmd, ['supabase', 'db', 'reset'], { stdio: 'inherit' });
    }

    const exitCode = resetResult?.status ?? 1;

    if (exitCode === 0) {
      console.log('✅ Consolidated migration applied successfully!');
    } else {
      console.error('❌ Consolidated migration failed with exit code:', exitCode);
    }

    return exitCode;
  } catch (error) {
    console.error('❌ Failed to apply consolidated migration:', error.message);
    return 1;
  }
}

async function main() {
  console.log('🚀 Setting up local Supabase database (cross-platform)...');

  const supabaseCmd = resolveSupabaseCmd();
  if (supabaseCmd.via === 'unavailable') {
    console.error('❌ Supabase CLI not found. Install it or use npx:');
    console.error('   - npm i -g supabase');
    console.error('   - or: npx supabase --version');
    process.exit(1);
  }

  // 1) Status check
  const statusRes = supabaseStatus(supabaseCmd);
  if (statusRes.error) {
    console.error('❌ Failed to run "supabase status":', statusRes.error.message);
    console.error('   Ensure the Supabase CLI is available. Try: npm i -g supabase');
    process.exit(1);
  }
  if (statusRes.status !== 0) {
    console.error('❌ "supabase status" exited with code:', statusRes.status);
    if (statusRes.stdout) console.error(statusRes.stdout);
    if (statusRes.stderr) console.error(statusRes.stderr);
    process.exit(statusRes.status);
  }

  // 2) Running check
  ensureSupabaseRunning(statusRes.combinedOutput || statusRes.stdout);

  // 3) Check for consolidated migration flag
  const args = process.argv.slice(2);
  const useConsolidated = args.includes('--consolidated') || process.env.USE_CONSOLIDATED_SQL === '1';

  if (useConsolidated) {
    console.log('🎯 Consolidated migration mode enabled');
    
    // Move existing migrations out of the way
    const moved = temporarilyMoveExistingMigrations();
    migrationsMoved = moved;
    
    // Move seed file to prevent seeding errors
    const seedMoved = temporarilyMoveSeed();
    seedWasMoved = seedMoved;

    let exitCode = 1;
    try {
      // Apply our consolidated migration
      exitCode = applyConsolidatedMigration(supabaseCmd);
    } finally {
      // Always restore files before exiting (restore seed first, then migrations)
      if (seedMoved) {
        restoreSeed();
      }
      if (moved) {
        restoreExistingMigrations();
      }
    }
    
    process.exit(exitCode);
  }

  // 4) Standard migration mode
  console.log('📦 Running standard migrations with "supabase db push"...');
  
  const dbUrl = extractDbUrl(statusRes.combinedOutput || statusRes.stdout);
  console.log('📌 Using DB URL: %s', redactDbUrl(dbUrl));

  const extraArgs = args.filter(arg => arg !== '--consolidated');
  const code = pushMigrations(supabaseCmd, dbUrl, extraArgs);

  if (code === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.error('❌ Migration failed with exit code:', code);
  }
  process.exit(code);
}

// Signal handlers for cleanup
process.on('SIGINT', () => {
  console.log('\n⚠️ Interrupted, cleaning up...');
  if (seedWasMoved) {
    restoreSeed();
  }
  if (migrationsMoved) {
    restoreExistingMigrations();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Terminated, cleaning up...');
  if (seedWasMoved) {
    restoreSeed();
  }
  if (migrationsMoved) {
    restoreExistingMigrations();
  }
  process.exit(0);
});

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
