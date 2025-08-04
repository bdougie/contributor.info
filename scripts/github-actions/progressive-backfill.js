#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';
import { ChunkCalculator } from './lib/chunk-calculator.js';
import { ProgressTracker } from './lib/progress-tracker.js';
import { getGraphQLClient } from './lib/graphql-client.js';

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

// Debug: Log raw arguments and parsed options
console.log('DEBUG: process.argv:', process.argv);
console.log('DEBUG: Raw options from commander:', options);

async function main() {
  console.log('🚀 Starting progressive backfill process...');
  console.log(`Options: ${JSON.stringify(options)}`);

  try {
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
  } catch (error) {
    console.error('❌ Fatal error in progressive backfill:', error);
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
  console.log(`\n🔄 Processing ${repo.owner}/${repo.name}`);
  console.log(`   Progress: ${backfillData.processed_prs}/${backfillData.total_prs} PRs (${Math.round((backfillData.processed_prs / backfillData.total_prs) * 100)}%)`);

  // Initialize helpers
  const calculator = new ChunkCalculator({
    prCount: backfillData.total_prs,
    rateLimit: await getRateLimitInfo(),
    priority: 'medium'
  });

  const tracker = new ProgressTracker(supabase, backfillData.id);

  // Calculate optimal chunk size
  const chunkSize = options.chunkSize || calculator.calculateOptimalChunkSize();
  console.log(`   Chunk size: ${chunkSize} PRs`);

  // Process chunks
  let chunksProcessed = 0;
  const maxChunks = options.maxChunks || 10;

  while (chunksProcessed < maxChunks) {
    // Check rate limit
    const rateLimit = await getRateLimitInfo();
    if (rateLimit.remaining < 100) {
      console.log('⚠️  Rate limit too low, pausing backfill');
      await tracker.pauseBackfill('rate_limit_low');
      break;
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
        
        // Check if we should continue
        if (backfillData.consecutive_errors >= 3) {
          console.error('❌ Too many consecutive errors, pausing backfill');
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
    console.error(`Failed to fetch PR chunk: ${error.message}`);
    throw error;
  }
}

async function processChunk(repo, prs, backfillData, chunkNumber) {
  // Get the total number of chunks already processed for proper numbering
  const { count: existingChunks } = await supabase
    .from('backfill_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('backfill_state_id', backfillData.id);
  
  const actualChunkNumber = (existingChunks || 0) + chunkNumber;
  
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
    await supabase
      .from('backfill_chunks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        api_calls_made: prs.length
      })
      .eq('id', chunkRecord.id);

    console.log(`   ✅ Stored ${processedPRs} PRs in database`);
    return processedPRs;
  } catch (error) {
    // Update chunk as failed
    await supabase
      .from('backfill_chunks')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error.message
      })
      .eq('id', chunkRecord.id);

    throw error;
  }
}

async function storePRsInDatabase(repositoryId, prs) {
  // This is a simplified version - in production, you'd want to handle
  // contributors, reviews, comments, etc.
  const prRecords = prs.map(pr => ({
    repository_id: repositoryId,
    github_id: pr.databaseId ? pr.databaseId.toString() : pr.id,
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
  const { data, error } = await supabase
    .from('pull_requests')
    .upsert(prRecords, {
      onConflict: 'repository_id,number',
      ignoreDuplicates: false
    });

  if (error) {
    throw new Error(`Failed to store PRs: ${error.message}`);
  }

  return prRecords.length;
}

async function getRateLimitInfo() {
  const client = getGraphQLClient();
  return client.getRateLimit();
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});