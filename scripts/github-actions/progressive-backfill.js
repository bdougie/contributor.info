#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';
import { ChunkCalculator } from './lib/chunk-calculator.js';
import { ProgressTracker } from './lib/progress-tracker.js';
import { getGraphQLClient } from './lib/graphql-client.js';
import { ChunkRecovery } from './lib/chunk-recovery.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Parse command line arguments
program
  .option('--repository-id <id>', 'Specific repository ID to backfill')
  .option('--chunk-size <size>', 'Override chunk size', parseInt, 25)
  .option('--dry-run', 'Run without making changes')
  .option('--max-chunks <count>', 'Maximum chunks to process in this run', parseInt, 10)
  .parse(process.argv);

const options = program.opts();

// Track errors that occur during processing
const errorSummary = {
  totalErrors: 0,
  criticalErrors: [],
  warningErrors: [],
  repositories: {}
};

// Validate required environment variables
const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'GITHUB_TOKEN'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingVars.join(', ')}`);
  process.exit(1);
}

// Debug: Log raw arguments and parsed options
console.log('DEBUG: process.argv: %s', JSON.stringify(process.argv));
console.log('DEBUG: Raw options from commander: %s', JSON.stringify(options));
console.log('DEBUG: program.chunkSize = %s', program.chunkSize);
console.log('DEBUG: program._optionValues = %s', JSON.stringify(program._optionValues));

async function main() {
  console.log('🚀 Starting progressive backfill process...');
  console.log(`Options: ${JSON.stringify(options)}`);

  try {
    // First, recover any stuck chunks from previous runs
    console.log('🔧 Checking for stuck chunks from previous runs...');
    const recovery = new ChunkRecovery(supabase);
    try {
      const recoveryResults = await recovery.recoverStuckChunks(30); // 30 minute threshold
      if (recoveryResults.foundStuckChunks > 0) {
        console.log(`   Recovered ${recoveryResults.recoveredChunks}/${recoveryResults.foundStuckChunks} stuck chunks`);
      }
    } catch (error) {
      console.warn('   Warning: Could not check for stuck chunks:', error.message);
      errorSummary.warningErrors.push({
        type: 'stuck_chunks_check_failed',
        message: error.message,
        timestamp: new Date().toISOString()
      });
      errorSummary.totalErrors++;
    }

    // Get repositories that need backfilling
    const repositories = await getRepositoriesForBackfill(options.repositoryId);
    
    if (repositories.length === 0) {
      console.log('✅ No repositories need backfilling at this time.');
      return;
    }

    console.log(`📊 Found ${repositories.length} repositories to process`);

    // Process each repository
    for (const repo of repositories) {
      await processRepository(repo);
    }

    console.log('✅ Progressive backfill complete!');
    
    // Report error summary
    await reportErrorSummary();
    
  } catch (error) {
    console.error('❌ Fatal error in progressive backfill:', error);
    errorSummary.criticalErrors.push({
      type: 'fatal_error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
    errorSummary.totalErrors++;
    
    // Report error summary before exiting
    await reportErrorSummary();
    process.exit(1);
  }
}

async function getRepositoriesForBackfill(specificRepoId) {
  // If specific repository requested
  if (specificRepoId) {
    const { data, error } = await supabase
      .from('progressive_backfill_state')
      .select(`
        *,
        repositories!inner(
          id,
          owner,
          name,
          pull_request_count
        )
      `)
      .eq('repository_id', specificRepoId)
      .single();

    if (error || !data) {
      console.log(`No active backfill found for repository ${specificRepoId}`);
      return [];
    }

    return [data];
  }

  // Get all active backfills
  const { data: activeBackfills, error } = await supabase
    .from('progressive_backfill_state')
    .select(`
      *,
      repositories!inner(
        id,
        owner,
        name,
        pull_request_count
      )
    `)
    .eq('status', 'active')
    .order('updated_at', { ascending: true }) // Process least recently updated first
    .limit(5); // Process up to 5 repositories per run

  if (error) {
    throw new Error(`Failed to fetch active backfills: ${error.message}`);
  }

  // Also check for repositories that need new backfills
  const newBackfills = await findRepositoriesNeedingBackfill();
  
  return [...(activeBackfills || []), ...newBackfills];
}

async function findRepositoriesNeedingBackfill() {
  // Find large repositories with incomplete data
  const { data: candidates, error } = await supabase
    .from('repositories')
    .select(`
      id,
      owner,
      name,
      pull_request_count,
      created_at
    `)
    .gt('pull_request_count', 100) // Only backfill repos with >100 PRs
    .order('pull_request_count', { ascending: false })
    .limit(10);

  if (error || !candidates) {
    return [];
  }

  const newBackfills = [];
  
  for (const repo of candidates) {
    // Check if this repo already has a backfill
    const { data: existingBackfill } = await supabase
      .from('progressive_backfill_state')
      .select('id')
      .eq('repository_id', repo.id)
      .single();

    if (existingBackfill) {
      continue; // Skip if already has backfill
    }

    // Check data completeness
    const { count: capturedPRs } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .eq('repository_id', repo.id);

    const completeness = (capturedPRs || 0) / (repo.pull_request_count || 1);

    // Start backfill if less than 80% complete
    if (completeness < 0.8) {
      console.log(`📝 Creating new backfill for ${repo.owner}/${repo.name} (${Math.round(completeness * 100)}% complete)`);
      
      if (!options.dryRun) {
        const { data: newBackfill, error: createError } = await supabase
          .from('progressive_backfill_state')
          .insert({
            repository_id: repo.id,
            total_prs: repo.pull_request_count || 0,
            processed_prs: capturedPRs || 0,
            status: 'active',
            chunk_size: options.chunkSize,
            metadata: {
              initial_completeness: completeness,
              initiated_by: 'progressive_backfill_workflow'
            }
          })
          .select()
          .single();

        if (!createError && newBackfill) {
          newBackfills.push({
            ...newBackfill,
            repositories: repo
          });
        }
      }
    }
  }

  return newBackfills;
}

async function processRepository(backfillData) {
  const repo = backfillData.repositories;
  
  // Defensive checks
  if (!repo || !repo.owner || !repo.name) {
    console.error('❌ Invalid repository data provided');
    errorSummary.criticalErrors.push({
      type: 'invalid_repository_data',
      message: 'Repository missing required fields (owner/name)',
      repository: repo ? `${repo.owner || 'unknown'}/${repo.name || 'unknown'}` : 'unknown',
      timestamp: new Date().toISOString()
    });
    errorSummary.totalErrors++;
    return;
  }
  
  console.log(`\n🔄 Processing ${repo.owner}/${repo.name}`);
  console.log(`   Progress: ${backfillData.processed_prs}/${backfillData.total_prs} PRs (${Math.round((backfillData.processed_prs / backfillData.total_prs) * 100)}%)`);

  // Initialize helpers with error handling
  let calculator, tracker;
  
  try {
    const rateLimit = await getRateLimitInfo();
    calculator = new ChunkCalculator({
      prCount: backfillData.total_prs,
      rateLimit: rateLimit,
      priority: 'medium'
    });
    tracker = new ProgressTracker(supabase, backfillData.id);
  } catch (error) {
    console.error(`❌ Failed to initialize helpers: ${error.message}`);
    errorSummary.criticalErrors.push({
      repository: `${repo.owner}/${repo.name}`,
      type: 'initialization_failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
    errorSummary.totalErrors++;
    return;
  }

  // Calculate optimal chunk size
  const chunkSize = options.chunkSize || calculator.calculateOptimalChunkSize();
  console.log(`   Chunk size: ${chunkSize} PRs`);

  // Process chunks
  let chunksProcessed = 0;
  const maxChunks = options.maxChunks || 10;

  while (chunksProcessed < maxChunks) {
    // Check GraphQL rate limit with proper cost estimation
    try {
      const client = getGraphQLClient();
      // PR queries typically cost 1 point per node, estimate based on chunk size
      const estimatedCost = Math.ceil(chunkSize * 1.2); // 20% buffer
      const rateLimit = await client.checkRateLimitBeforeQuery(estimatedCost, 500);
      
      console.log(`   GraphQL Rate limit: ${rateLimit.remaining}/${rateLimit.limit} (${rateLimit.percentageUsed.toFixed(1)}% used)`);
      console.log(`   Estimated queries remaining: ${rateLimit.estimatedQueriesRemaining}`);
      
      if (rateLimit.remaining < 500 || rateLimit.estimatedQueriesRemaining < 5) {
        console.log('⚠️  GraphQL rate limit too low, pausing backfill');
        await tracker.pauseBackfill('graphql_rate_limit_low');
        break;
      }
    } catch (error) {
      if (error.type === 'RATE_LIMIT_LOW' || error.type === 'INSUFFICIENT_RATE_LIMIT') {
        console.log(`⚠️  ${error.message}`);
        await tracker.pauseBackfill('graphql_rate_limit_low');
        break;
      }
      throw error;
    }

    // Get next chunk to process
    const chunk = await getNextChunk(backfillData, repo, chunkSize);
    if (!chunk || chunk.length === 0) {
      console.log('✅ No more PRs to process for this repository');
      await tracker.completeBackfill();
      break;
    }

    console.log(`   Processing chunk of ${chunk.length} PRs...`);

    if (!options.dryRun) {
      try {
        // Process the chunk
        await processChunk(repo, chunk, backfillData, chunksProcessed + 1);
        
        // Update progress
        await tracker.updateProgress(chunk.length, chunk[chunk.length - 1].cursor);
        
        chunksProcessed++;
      } catch (error) {
        console.error(`❌ Error processing chunk: ${error.message}`);
        await tracker.recordError(error.message);
        
        // Track error in summary
        if (!errorSummary.repositories[`${repo.owner}/${repo.name}`]) {
          errorSummary.repositories[`${repo.owner}/${repo.name}`] = {
            errors: [],
            chunksProcessed: 0,
            chunksFailed: 0
          };
        }
        errorSummary.repositories[`${repo.owner}/${repo.name}`].errors.push({
          type: 'chunk_processing_failed',
          message: error.message,
          chunkNumber: chunksProcessed + 1,
          timestamp: new Date().toISOString()
        });
        errorSummary.repositories[`${repo.owner}/${repo.name}`].chunksFailed++;
        errorSummary.totalErrors++;
        errorSummary.criticalErrors.push({
          repository: `${repo.owner}/${repo.name}`,
          type: 'chunk_processing_failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Check if we should continue - fetch latest error count from DB
        const { data: currentState } = await supabase
          .from('progressive_backfill_state')
          .select('consecutive_errors')
          .eq('id', backfillData.id)
          .single();
          
        const currentErrors = currentState?.consecutive_errors || backfillData.consecutive_errors;
        
        if (currentErrors >= 3) {
          console.error(`❌ Too many consecutive errors (${currentErrors}), pausing backfill`);
          await tracker.pauseBackfill('too_many_errors');
          break;
        }
      }
    } else {
      console.log('   [DRY RUN] Would process chunk');
      chunksProcessed++;
    }

    // Brief pause between chunks
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`   Processed ${chunksProcessed} chunks in this run`);
}

async function getNextChunk(backfillData, repo, chunkSize) {
  try {
    const client = getGraphQLClient();
    
    // Use cursor-based pagination
    const prs = await client.getRepositoryPRsPage(
      repo.owner,
      repo.name,
      chunkSize,
      backfillData.last_processed_cursor,
      'DESC' // Get oldest PRs first
    );

    return prs;
  } catch (error) {
    // Handle GraphQL rate limit errors gracefully
    if (error.type === 'RATE_LIMITED') {
      console.error(`GraphQL rate limit hit. Reset at: ${error.resetAt}`);
      console.error(`Wait time: ${Math.ceil(error.waitTime / 1000 / 60)} minutes`);
    }
    console.error(`Failed to fetch PR chunk: ${error.message}`);
    throw error;
  }
}

async function processChunk(repo, prs, backfillData, chunkNumber) {
  // Get atomic chunk number from database to prevent race conditions
  let actualChunkNumber;
  try {
    const { data: chunkData, error: chunkError } = await supabase
      .rpc('get_next_chunk_number', { p_backfill_state_id: backfillData.id });
    
    if (chunkError) {
      // Fallback to count-based approach if function doesn't exist yet
      console.warn('Atomic chunk number not available, using count-based approach');
      const { count: existingChunks } = await supabase
        .from('backfill_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('backfill_state_id', backfillData.id);
      
      actualChunkNumber = (existingChunks || 0) + chunkNumber;
    } else {
      actualChunkNumber = chunkData;
    }
  } catch (error) {
    // Fallback for backwards compatibility
    const { count: existingChunks } = await supabase
      .from('backfill_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('backfill_state_id', backfillData.id);
    
    actualChunkNumber = (existingChunks || 0) + chunkNumber;
  }
  
  // Create chunk record
  const { data: chunkRecord, error: chunkError } = await supabase
    .from('backfill_chunks')
    .insert({
      repository_id: repo.id,
      backfill_state_id: backfillData.id,
      chunk_number: actualChunkNumber,
      pr_numbers: prs.map(pr => pr.number),
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .select()
    .single();

  if (chunkError) {
    throw new Error(`Failed to create chunk record: ${chunkError.message}`);
  }

  try {
    // Process PRs into database
    const processedPRs = await storePRsInDatabase(repo.id, prs);
    
    // Update chunk as completed
    const { error: updateError } = await supabase
      .from('backfill_chunks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        api_calls_made: prs.length
      })
      .eq('id', chunkRecord.id);

    if (updateError) {
      console.error(`Warning: Failed to update chunk status: ${updateError.message}`);
      // Don't throw here - PRs were processed successfully
    }

    console.log(`   ✅ Stored ${processedPRs} PRs in database`);
    return processedPRs;
  } catch (error) {
    // Update chunk as failed
    const { error: updateError } = await supabase
      .from('backfill_chunks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error.message
      })
      .eq('id', chunkRecord.id);

    if (updateError) {
      console.error(`Warning: Failed to update failed chunk status: ${updateError.message}`);
    }

    throw error;
  }
}

async function storePRsInDatabase(repositoryId, prs) {
  // This is a simplified version - in production, you'd want to handle
  // contributors, reviews, comments, etc.
  
  // Defensive check for empty PR array
  if (!prs || prs.length === 0) {
    console.warn('No PRs to store');
    return 0;
  }
  
  // Validate that all PRs have databaseId
  const invalidPRs = prs.filter(pr => !pr.databaseId);
  if (invalidPRs.length > 0) {
    // Log detailed info about invalid PRs
    console.error('Invalid PRs detected:', invalidPRs.map(pr => ({
      number: pr.number,
      title: pr.title?.substring(0, 50),
      hasId: !!pr.databaseId,
      id: pr.databaseId
    })));
    throw new Error(`${invalidPRs.length} PRs missing databaseId: ${invalidPRs.map(pr => pr.number).join(', ')}`);
  }

  const prRecords = prs.map(pr => ({
    repository_id: repositoryId,
    github_id: pr.databaseId.toString(), // Always use databaseId for consistency
    number: pr.number,
    title: pr.title,
    body: pr.body,
    state: pr.state.toLowerCase(),
    created_at: pr.createdAt,
    updated_at: pr.updatedAt,
    closed_at: pr.closedAt,
    merged_at: pr.mergedAt,
    merged: pr.merged,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changedFiles,
    commits: pr.commits.totalCount,
    base_branch: pr.baseRefName,
    head_branch: pr.headRefName,
    html_url: pr.url
  }));

  // Upsert PRs (update if exists, insert if not)
  try {
    const { data, error } = await supabase
      .from('pull_requests')
      .upsert(prRecords, {
        onConflict: 'repository_id,number',
        ignoreDuplicates: false
      });

    if (error) {
      // Check for common Supabase errors
      if (error.message?.includes('duplicate key')) {
        console.warn('Some PRs already exist, this is expected');
        // Don't throw for duplicates, just log
        return prRecords.length;
      }
      throw new Error(`Failed to store PRs: ${error.message}`);
    }

    return prRecords.length;
  } catch (error) {
    // Add context to error
    if (error.message?.includes('fetch failed') || error.message?.includes('ECONNREFUSED')) {
      throw new Error(`Network error connecting to Supabase: ${error.message}`);
    }
    throw error;
  }
}

async function getRateLimitInfo() {
  const client = getGraphQLClient();
  return client.getRateLimit();
}

async function reportErrorSummary() {
  if (errorSummary.totalErrors === 0) {
    console.log('\n✅ No errors encountered during this run');
    return;
  }

  console.log('\n⚠️  ERROR SUMMARY');
  console.log(`Total errors: ${errorSummary.totalErrors}`);
  console.log(`Critical errors: ${errorSummary.criticalErrors.length}`);
  console.log(`Warnings: ${errorSummary.warningErrors.length}`);

  // Write error summary to a file for the workflow to read
  const fs = await import('fs/promises');
  const errorFile = process.env.GITHUB_OUTPUT || './error-summary.json';
  
  try {
    // Format for GitHub Actions output
    if (process.env.GITHUB_OUTPUT) {
      await fs.appendFile(errorFile, `error_count=${errorSummary.totalErrors}\n`);
      await fs.appendFile(errorFile, `has_critical_errors=${errorSummary.criticalErrors.length > 0}\n`);
      await fs.appendFile(errorFile, `error_summary=${JSON.stringify(errorSummary)}\n`);
    } else {
      // For local testing
      await fs.writeFile(errorFile, JSON.stringify(errorSummary, null, 2));
    }
  } catch (writeError) {
    console.error('Failed to write error summary:', writeError);
  }

  // Log details
  if (errorSummary.criticalErrors.length > 0) {
    console.log('\n❌ CRITICAL ERRORS:');
    errorSummary.criticalErrors.forEach(err => {
      console.log(`   - [${err.timestamp}] ${err.repository || 'System'}: ${err.message}`);
    });
  }

  if (errorSummary.warningErrors.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    errorSummary.warningErrors.forEach(err => {
      console.log(`   - [${err.timestamp}] ${err.type}: ${err.message}`);
    });
  }

  // Log repository-specific errors
  const reposWithErrors = Object.keys(errorSummary.repositories);
  if (reposWithErrors.length > 0) {
    console.log('\n📊 REPOSITORY ERROR BREAKDOWN:');
    reposWithErrors.forEach(repo => {
      const repoData = errorSummary.repositories[repo];
      console.log(`   ${repo}: ${repoData.chunksFailed} chunks failed`);
      repoData.errors.forEach(err => {
        console.log(`      - Chunk ${err.chunkNumber}: ${err.message}`);
      });
    });
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});