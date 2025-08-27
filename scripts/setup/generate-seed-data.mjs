#!/usr/bin/env node

/**
 * Generate seed data for local development
 * Fetches 7-14 days of recent data from example repositories
 * Uses Inngest for background processing
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const showHelp = args.includes('--help') || args.includes('-h');

// Show help if requested
if (showHelp) {
  console.log(`
🌱 Seed Data Generator - Usage

Options:
  --days=N        Number of days to fetch (1-90, default: 14 or SEED_DATA_DAYS env)
  --repos=LIST    Comma-separated repositories (default: from SEED_REPOSITORIES env)
  --dry-run       Preview what would be fetched without writing to database
  --verbose       Show detailed logging
  --help, -h      Show this help message

Examples:
  # Quick test with minimal data
  npm run db:seed -- --days=3
  
  # Test specific repository
  npm run db:seed -- --repos=facebook/react --days=7
  
  # Preview without writing
  npm run db:seed -- --dry-run --days=14
  
  # Multiple repositories with custom timeframe
  npm run db:seed -- --repos=vitejs/vite,continuedev/continue --days=10

Environment variables:
  SEED_DATA_DAYS        Default number of days (currently: ${process.env.SEED_DATA_DAYS || '14'})
  SEED_REPOSITORIES     Default repositories (currently: ${process.env.SEED_REPOSITORIES || 'not set'})
  `);
  process.exit(0);
}

// Parse days from command line (e.g., --days=7)
const daysArg = args.find(arg => arg.startsWith('--days='));
const cliDays = daysArg ? parseInt(daysArg.split('=')[1], 10) : null;

// Parse repositories from command line (e.g., --repos=owner/repo1,owner/repo2)
const reposArg = args.find(arg => arg.startsWith('--repos='));
const cliRepos = reposArg ? reposArg.split('=')[1] : null;

// Configuration (CLI > ENV > Default)
const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SEED_DATA_DAYS = cliDays || parseInt(process.env.SEED_DATA_DAYS || '14', 10);
const SEED_REPOSITORIES = (cliRepos || process.env.SEED_REPOSITORIES || 'continuedev/continue,vitejs/vite,facebook/react,vercel/next.js,supabase/supabase').split(',');
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || 'dev-key';
const INNGEST_URL = process.env.INNGEST_URL || 'http://localhost:8288';

// Progress tracking
const startTime = Date.now();

// Mask token for logging
function maskToken(token) {
  if (!token) return 'not-set';
  return token.substring(0, 7) + '...' + token.substring(token.length - 4);
}

// Validate repository format
function validateRepositoryFormat(repos) {
  const invalidRepos = [];
  const validPattern = /^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_.]+$/;
  
  repos.forEach(repo => {
    if (!validPattern.test(repo.trim())) {
      invalidRepos.push(repo);
    }
  });
  
  if (invalidRepos.length > 0) {
    console.error('❌ Invalid repository format detected:');
    invalidRepos.forEach(repo => console.error(`   • ${repo}`));
    console.error('Expected format: owner/repo');
    return false;
  }
  return true;
}

// Validate date range
function validateDateRange(days) {
  if (isNaN(days) || days < 1 || days > 90) {
    console.error('❌ Invalid SEED_DATA_DAYS value:', days);
    console.error('Please set a value between 1 and 90 days');
    return false;
  }
  return true;
}

// Security warning
function showSecurityWarning() {
  console.log('🔐 Security Reminder:');
  console.log('   • Never commit .env.local to version control');
  console.log('   • GitHub token is masked in logs:', maskToken(GITHUB_TOKEN));
  console.log('   • Ensure token has minimal required scopes\n');
}

// Validation
if (!GITHUB_TOKEN) {
  console.error('❌ Missing GitHub token!');
  console.error('Please set VITE_GITHUB_TOKEN in your .env.local file');
  console.error('Create a token at: https://github.com/settings/tokens/new');
  console.error('Required scopes: public_repo, read:user');
  console.error('\n⚠️  WARNING: Never commit your token to version control!');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Run: npm run env:local');
  process.exit(1);
}

// Validate configuration
if (!validateRepositoryFormat(SEED_REPOSITORIES)) {
  process.exit(1);
}

if (!validateDateRange(SEED_DATA_DAYS)) {
  process.exit(1);
}

// Show security warning
if (!isDryRun) {
  showSecurityWarning();
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * GitHub API helper with enhanced error handling and retry logic
 */
async function githubAPI(endpoint, options = {}, retries = 3) {
  const url = `https://api.github.com${endpoint}`;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'contributor-info-seed-generator',
          ...options.headers
        }
      });
      
      // Handle rate limiting
      if (response.status === 403) {
        const remaining = response.headers.get('x-ratelimit-remaining');
        const reset = response.headers.get('x-ratelimit-reset');
        
        if (remaining === '0') {
          const resetTime = new Date(parseInt(reset) * 1000);
          console.log(`⏳ Rate limited. Resets at ${resetTime.toLocaleTimeString()}`);
          const waitTime = resetTime - Date.now() + 1000;
          if (waitTime > 0) {
            console.log(`   Waiting ${Math.round(waitTime / 1000)}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return githubAPI(endpoint, options, retries - attempt); // Retry without counting
          }
        }
        
        // Check for other 403 errors (bad token, insufficient scopes)
        const errorData = await response.json();
        if (errorData.message?.includes('Bad credentials')) {
          console.error('❌ Invalid GitHub token!');
          console.error('Please check your VITE_GITHUB_TOKEN in .env.local');
          process.exit(1);
        }
        if (errorData.message?.includes('requires authentication')) {
          console.error('❌ GitHub token missing required scopes!');
          console.error('Required scopes: public_repo, read:user');
          process.exit(1);
        }
      }
      
      // Handle server errors with retry
      if (response.status >= 500 && attempt < retries) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⚠️  GitHub API error (${response.status}). Retrying in ${backoffTime}ms... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        continue;
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      return response.json();
      
    } catch (error) {
      // Network errors or other issues
      if (attempt < retries) {
        const backoffTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⚠️  Request failed: ${error.message}. Retrying in ${backoffTime}ms... (attempt ${attempt}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed after ${retries} attempts`);
}

/**
 * Track repository in database
 */
async function trackRepository(owner, name) {
  console.log(`\n📂 ${isDryRun ? '[DRY RUN] ' : ''}Setting up ${owner}/${name}...`);
  
  // Fetch repository data
  const repo = await githubAPI(`/repos/${owner}/${name}`);
  
  // Insert or update repository
  const { data: existingRepo, error: fetchError } = await supabase
    .from('repositories')
    .select('id')
    .eq('github_id', repo.id)
    .single();
  
  const repoData = {
    github_id: repo.id,
    full_name: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    is_fork: repo.fork,
    github_created_at: repo.created_at,
    github_updated_at: repo.updated_at,
    default_branch: repo.default_branch,
    is_tracked: true,
    last_updated_at: new Date().toISOString()
  };
  
  if (isDryRun) {
    console.log(`✅ [DRY RUN] Would track repository: ${repo.full_name}`);
    console.log(`   • Stars: ${repo.stargazers_count}`);
    console.log(`   • Language: ${repo.language || 'N/A'}`);
    console.log(`   • Last updated: ${new Date(repo.updated_at).toLocaleDateString()}`);
    return `dry-run-${repo.id}`; // Return fake ID for dry run
  }
  
  const { data: repoRecord, error: upsertError } = await supabase
    .from('repositories')
    .upsert(repoData, { onConflict: 'github_id' })
    .select('id')
    .single();
  
  if (upsertError) {
    console.error(`❌ Failed to track repository: ${upsertError.message}`);
    return null;
  }
  
  console.log(`✅ Repository tracked: ${repo.full_name} (ID: ${repoRecord.id})`);
  return repoRecord.id;
}

/**
 * Queue data capture via Inngest
 */
async function queueDataCapture(repositoryId, repositoryName, days = SEED_DATA_DAYS) {
  console.log(`🔄 ${isDryRun ? '[DRY RUN] ' : ''}Queueing data capture for ${repositoryName} (last ${days} days)...`);
  
  // Insert job into progressive_capture_jobs table
  const jobData = {
    job_type: 'seed_data_capture',
    repository_id: repositoryId,
    status: 'pending',
    priority: 5,
    metadata: {
      repository_name: repositoryName,
      days_to_capture: days,
      seed_generation: true,
      triggered_by: 'seed-script',
      dry_run: isDryRun
    },
    created_at: new Date().toISOString()
  };
  
  if (isDryRun) {
    console.log(`✅ [DRY RUN] Would queue job for ${repositoryName}`);
    console.log(`   • Job type: seed_data_capture`);
    console.log(`   • Days to capture: ${days}`);
    console.log(`   • Priority: 5`);
    return `dry-run-job-${Date.now()}`;
  }
  
  const { data: job, error: jobError } = await supabase
    .from('progressive_capture_jobs')
    .insert(jobData)
    .select()
    .single();
  
  if (jobError) {
    console.error(`❌ Failed to queue job: ${jobError.message}`);
    return null;
  }
  
  // Trigger Inngest event for immediate processing
  try {
    const eventData = {
      name: 'local/capture.repository.seed',
      data: {
        jobId: job.id,
        repositoryId,
        repositoryName,
        daysToCapture: days,
        seedGeneration: true
      }
    };
    
    const response = await fetch(`${INNGEST_URL}/e/${INNGEST_EVENT_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });
    
    if (response.ok) {
      console.log(`✅ Inngest event triggered for ${repositoryName}`);
    } else {
      console.log(`⚠️  Inngest not available - job will be processed when Inngest starts`);
    }
  } catch (error) {
    console.log(`⚠️  Inngest not running - job queued for later processing`);
  }
  
  return job.id;
}

/**
 * Check job status
 */
async function checkJobStatus(jobIds) {
  const { data: jobs, error } = await supabase
    .from('progressive_capture_jobs')
    .select('id, status, repository_id, metadata')
    .in('id', jobIds)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Failed to check job status:', error);
    return;
  }
  
  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  jobs.forEach(job => {
    statusCounts[job.status]++;
  });
  
  return statusCounts;
}

/**
 * Main seed data generation
 */
async function generateSeedData() {
  console.log('🌱 Starting Seed Data Generation with Inngest');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📅 Timeframe: Last ${SEED_DATA_DAYS} days`);
  console.log(`📦 Repositories: ${SEED_REPOSITORIES.length} repos`);
  console.log(`🔗 Supabase URL: ${SUPABASE_URL}`);
  console.log(`🚀 Inngest URL: ${INNGEST_URL}`);
  if (isDryRun) {
    console.log(`🔍 DRY RUN MODE - No data will be written`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const jobIds = [];
  
  try {
    // Track and queue each repository
    for (const repoPath of SEED_REPOSITORIES) {
      const [owner, name] = repoPath.trim().split('/');
      
      // Track repository
      const repositoryId = await trackRepository(owner, name);
      
      if (repositoryId) {
        // Queue data capture job
        const jobId = await queueDataCapture(repositoryId, `${owner}/${name}`, SEED_DATA_DAYS);
        if (jobId) {
          jobIds.push(jobId);
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Queued ${jobIds.length} data capture jobs`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Check initial job status
    const status = await checkJobStatus(jobIds);
    console.log('📊 Job Status:');
    console.log(`  • Pending: ${status.pending}`);
    console.log(`  • Processing: ${status.processing}`);
    console.log(`  • Completed: ${status.completed}`);
    console.log(`  • Failed: ${status.failed}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Start Inngest to process the jobs:');
    console.log('   npm run dev:inngest');
    console.log('');
    console.log('2. Monitor progress in Inngest dashboard:');
    console.log('   http://localhost:8288');
    console.log('');
    console.log('3. Or check status with:');
    console.log('   npm run seed:status');
    console.log('');
    console.log('4. Start the dev server to see your data:');
    console.log('   npm run dev');
    console.log('');
    console.log('💡 Tip: Data will be processed in the background.');
    console.log('   The app will show data as it becomes available.');
    
  } catch (error) {
    console.error('\n❌ Error generating seed data:', error);
    console.error('Please check your GitHub token and network connection');
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSeedData().catch(console.error);
}

export { generateSeedData };