#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { syncRepositoryContributorStats } from '../src/lib/github-graphql-stats.js';

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function syncAllTrackedRepositories() {
  console.log('🔄 Starting contributor stats sync job...');
  
  // Get repository from environment variables (passed from GitHub Actions)
  const specificOwner = process.env.REPO_OWNER;
  const specificRepo = process.env.REPO_NAME;
  
  if (specificOwner && specificRepo) {
    // Sync specific repository
    console.log(`📦 Syncing specific repository: ${specificOwner}/${specificRepo}`);
    await syncSingleRepository(specificOwner, specificRepo);
  } else {
    // Sync all tracked repositories
    const { data: repos, error } = await supabase
      .from('tracked_repositories')
      .select(`
        repository_id,
        repositories!inner(
          owner,
          name,
          full_name
        )
      `)
      .eq('tracking_enabled', true);
      
    if (error) {
      console.error('Failed to fetch tracked repositories:', error);
      process.exit(1);
    }
    
    console.log(`📦 Found ${repos?.length || 0} tracked repositories to sync`);
    
    if (!repos || repos.length === 0) {
      console.log('⚠️  No active tracked repositories found');
      return;
    }
    
    for (const repo of repos) {
      const { owner, name, full_name } = repo.repositories;
      console.log(`  - Syncing ${full_name}...`);
      
      try {
        await syncSingleRepository(owner, name);
        console.log(`    ✅ Successfully synced ${full_name}`);
      } catch (error) {
        console.error(`    ❌ Failed to sync ${full_name}:`, error.message);
        // Continue with other repositories even if one fails
      }
      
      // Small delay to avoid overwhelming the GitHub API
      const delayMs = parseInt(process.env.SYNC_DELAY_MS || '2000');
      if (delayMs > 0) {
        console.log(`    ⏳ Waiting ${delayMs}ms before next repository...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.log('✅ Contributor stats sync completed!');
}

async function syncSingleRepository(owner, repo) {
  const startTime = Date.now();
  
  try {
    await syncRepositoryContributorStats(owner, repo);
    
    const duration = Date.now() - startTime;
    console.log(`    ⏱️  Sync took ${(duration / 1000).toFixed(2)}s`);
    
    // Log sync completion to database
    await logSyncOperation(owner, repo, 'completed', duration);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`    ❌ Sync failed after ${(duration / 1000).toFixed(2)}s:`, error.message);
    
    // Log sync failure to database
    await logSyncOperation(owner, repo, 'failed', duration, error.message);
    
    throw error;
  }
}

async function logSyncOperation(owner, repo, status, duration, errorMessage = null) {
  try {
    // Get repository ID
    const { data: repoData } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoData) {
      await supabase
        .from('sync_logs')
        .insert({
          sync_type: 'contributor_stats_sync',
          repository_id: repoData.id,
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          error_message: errorMessage,
          metadata: {
            duration_ms: duration,
            script_version: '1.0.0',
            sync_method: 'graphql'
          }
        });
    }
  } catch (logError) {
    console.error('Failed to log sync operation:', logError.message);
    // Don't throw here - logging failure shouldn't break the main process
  }
}

// Validate required environment variables
function validateEnvironment() {
  const required = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GITHUB_TOKEN'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please ensure these are set in your environment or .env file');
    process.exit(1);
  }
}

// Main execution
async function main() {
  try {
    validateEnvironment();
    await syncAllTrackedRepositories();
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Run the main function
main();