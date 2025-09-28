#!/usr/bin/env tsx
/**
 * Script to populate commits for a repository
 * Usage: npm run populate-commits [owner] [repo]
 * Example: npm run populate-commits continuedev continue
 */

import * as dotenv from 'dotenv';

// Load environment variables BEFORE any other imports
dotenv.config();

const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_APP_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!githubToken) {
  console.error('❌ Missing GitHub token. Please set GITHUB_TOKEN or GITHUB_APP_TOKEN in your .env file');
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

// Import after env variables are loaded
async function importCaptureCommits() {
  const { captureCommits } = await import('../src/lib/capture-commits.js');
  return captureCommits;
}


async function main() {
  const args = process.argv.slice(2);
  const owner = args[0] || 'continuedev';
  const repo = args[1] || 'continue';

  console.log('Starting to populate commits for %s/%s...', owner, repo);

  // Get the shared captureCommits function
  const captureCommits = await importCaptureCommits();

  // Fetch last 7 days of commits
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const result = await captureCommits(owner, repo, since, {
    githubToken: githubToken,
    supabaseUrl: supabaseUrl,
    supabaseKey: supabaseServiceKey
  });

  if (result.success) {
    console.log('✅ Successfully captured %d commits for %s/%s', result.count, owner, repo);
  } else {
    console.error(`❌ Failed to capture commits: ${result.error}`);
    process.exit(1);
  }
}

main().catch(console.error);