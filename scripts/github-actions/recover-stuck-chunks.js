#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';
import { ChunkRecovery } from './lib/chunk-recovery.js';

// Initialize Supabase client
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Parse command line arguments
program
  .option(
    '--stuck-threshold <minutes>',
    'Minutes after which a chunk is considered stuck',
    parseInt,
    30
  )
  .option(
    '--cleanup-days <days>',
    'Clean up completed chunks older than this many days',
    parseInt,
    30
  )
  .option('--dry-run', 'Run without making changes')
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log('🔧 Starting chunk recovery process...');
  console.log(`Options: ${JSON.stringify(options)}`);

  const recovery = new ChunkRecovery(supabase);

  try {
    // Get initial statistics
    console.log('\n📊 Current chunk statistics:');
    const statsBefore = await recovery.getChunkStatistics();
    console.log(`   Total chunks: ${statsBefore.total}`);
    console.log(`   Processing: ${statsBefore.processing}`);
    console.log(`   Completed: ${statsBefore.completed}`);
    console.log(`   Failed: ${statsBefore.failed}`);

    // Recover stuck chunks
    console.log(`\n🔍 Looking for chunks stuck for more than ${options.stuckThreshold} minutes...`);

    if (!options.dryRun) {
      const results = await recovery.recoverStuckChunks(options.stuckThreshold);

      console.log('\n📈 Recovery results:');
      console.log(`   Found stuck chunks: ${results.foundStuckChunks}`);
      console.log(`   Successfully recovered: ${results.recoveredChunks}`);
      console.log(`   Failed recoveries: ${results.failedRecoveries}`);

      if (results.errors.length > 0) {
        console.log('\n❌ Recovery errors:');
        results.errors.forEach((err) => {
          console.log(`   Chunk ${err.chunkId}: ${err.error}`);
        });
      }
    } else {
      console.log('   [DRY RUN] Would recover stuck chunks');
    }

    // Clean up old chunks
    if (options.cleanupDays > 0) {
      console.log(`\n🧹 Cleaning up completed chunks older than ${options.cleanupDays} days...`);

      if (!options.dryRun) {
        const cleanedUp = await recovery.cleanupOldChunks(options.cleanupDays);
        console.log(`   Cleaned up ${cleanedUp} old chunks`);
      } else {
        console.log('   [DRY RUN] Would clean up old chunks');
      }
    }

    // Get final statistics
    if (!options.dryRun) {
      console.log('\n📊 Updated chunk statistics:');
      const statsAfter = await recovery.getChunkStatistics();
      console.log(`   Total chunks: ${statsAfter.total}`);
      console.log(
        `   Processing: ${statsAfter.processing} (${statsAfter.processing - statsBefore.processing})`
      );
      console.log(
        `   Completed: ${statsAfter.completed} (+${statsAfter.completed - statsBefore.completed})`
      );
      console.log(`   Failed: ${statsAfter.failed} (+${statsAfter.failed - statsBefore.failed})`);
    }

    console.log('\n✅ Chunk recovery complete!');
  } catch (error) {
    console.error('❌ Fatal error in chunk recovery:', error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
