#!/usr/bin/env node
// Cross-platform local migration runner
// - Checks Supabase local status
// - Derives local DB URL
// - Executes: supabase db push --db-url <url> (bypasses access token)

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

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
    return run(supabaseCmd.cmd, ['status']);
  }
  if (supabaseCmd.via === 'npx') {
    return run(supabaseCmd.cmd, ['supabase', 'status']);
  }
  return { status: 1, stdout: '', stderr: 'Supabase CLI not available (direct, local-bin, or npx not found).', error: new Error('Supabase CLI unavailable') };
}

function ensureSupabaseRunning(statusStdout) {
  const out = (statusStdout || '').toLowerCase();
  if (!out.includes('is running')) {
    console.error('❌ Supabase is not running. Start it first:');
    console.error('   - npm run supabase:start   (project helper)');
    console.error('   - or: npx supabase start');
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

function executeSqlFile(supabaseCmd, dbUrl, filePath, extraArgs = []) {
  if (supabaseCmd.via === 'direct' || supabaseCmd.via === 'local-bin') {
    const res = spawnSync(supabaseCmd.cmd, ['db', 'execute', '--db-url', dbUrl, '--file', filePath, ...extraArgs], { stdio: 'inherit' });
    return res.status ?? 1;
  }
  if (supabaseCmd.via === 'npx') {
    const res = spawnSync(supabaseCmd.cmd, ['supabase', 'db', 'execute', '--db-url', dbUrl, '--file', filePath, ...extraArgs], { stdio: 'inherit' });
    return res.status ?? 1;
  }
  return 1;
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

  // 1) Status
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
  ensureSupabaseRunning(statusRes.stdout);

  // 3) DB URL
  const dbUrl = extractDbUrl(statusRes.stdout);
  console.log('📌 Using DB URL: %s', redactDbUrl(dbUrl));

  // 4) Extra flags passthrough (e.g., --dry-run)
  const extraArgs = process.argv.slice(2);

  // 5) Optional consolidated SQL route
  // USE_CONSOLIDATED_SQL=1 runs a single pre-generated SQL file containing all migrations
  // This is useful for:
  // - Fresh local setups where migration history doesn't matter
  // - CI/CD environments that need faster setup
  // - Avoiding potential migration ordering issues
  // Default behavior (without this flag) runs individual migrations in sequence
  const consolidatedSql = path.resolve('supabase/migrations-local/000_consolidated_local_safe.sql');
  if (process.env.USE_CONSOLIDATED_SQL === '1' && existsSync(consolidatedSql)) {
    console.log('ℹ️ USE_CONSOLIDATED_SQL=1 detected. Executing consolidated SQL file...');
    const code = executeSqlFile(supabaseCmd, dbUrl, consolidatedSql, extraArgs);
    process.exit(code);
  }

  // 6) Default to migrations push
  console.log('📦 Running migrations with "supabase db push" against local DB...');
  const code = pushMigrations(supabaseCmd, dbUrl, extraArgs);

  if (code === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.error('❌ Migration failed with exit code:', code);
  }
  process.exit(code);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
