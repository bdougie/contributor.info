#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_TOKEN;

if (!supabaseUrl) {
  console.error('❌ Error: VITE_SUPABASE_URL environment variable is required');
  console.error('Please set it in your .env file or environment');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error(
    '❌ Error: SUPABASE_SERVICE_KEY or SUPABASE_TOKEN environment variable is required'
  );
  console.error('Please set it in your .env file or environment');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const PYTORCH_REPO_ID = 'a87980e2-e273-4e87-925b-b72559994b2b';
const CHUNK_SIZE = 25;
const MAX_CHUNKS = 10; // More than enough for 140 PRs
const TIMEOUT_BETWEEN_CHUNKS_MS = 2 * 60 * 1000; // 2 minutes

async function runPyTorch7DayBackfill() {
  console.log('🐍 Starting PyTorch 7-day backfill with 2-minute timeouts between chunks...\n');

  try {
    // Check current backfill status
    const { data: backfillState, error: stateError } = await supabase
      .from('progressive_backfill_state')
      .select('*')
      .eq('repository_id', PYTORCH_REPO_ID)
      .single();

    if (stateError || !backfillState) {
      console.error('❌ No backfill state found for PyTorch repository');
      return;
    }

    console.log('📊 Current backfill status:');
    console.log(`   Status: ${backfillState.status}`);
    console.log(`   Processed PRs: ${backfillState.processed_prs}`);
    console.log(`   Last cursor: ${backfillState.last_processed_cursor}`);
    console.log(`   Consecutive errors: ${backfillState.consecutive_errors}`);

    if (backfillState.status !== 'active') {
      console.log(`\n⚠️  Backfill is ${backfillState.status}. Activating...`);
      const { error: updateError } = await supabase
        .from('progressive_backfill_state')
        .update({
          status: 'active',
          consecutive_errors: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', backfillState.id);

      if (updateError) {
        console.error('❌ Failed to activate backfill:', updateError.message);
        return;
      }
    }

    // Run the progressive backfill with custom timeout
    console.log('\n🚀 Starting progressive backfill...');
    console.log(`   Chunk size: ${CHUNK_SIZE} PRs`);
    console.log(`   Max chunks: ${MAX_CHUNKS}`);
    console.log(`   Timeout between chunks: ${TIMEOUT_BETWEEN_CHUNKS_MS / 1000} seconds`);

    // Import and run the progressive backfill
    const { spawn } = await import('child_process');

    let chunksProcessed = 0;
    const startTime = Date.now();

    async function runChunk() {
      return new Promise((resolve, reject) => {
        console.log(`\n📦 Processing chunk ${chunksProcessed + 1}...`);

        const backfillProcess = spawn(
          'node',
          [
            'scripts/github-actions/progressive-backfill.js',
            `--repository-id=${PYTORCH_REPO_ID}`,
            `--chunk-size=${CHUNK_SIZE}`,
            '--max-chunks=1', // Process one chunk at a time
          ],
          {
            env: {
              ...process.env,
              VITE_SUPABASE_URL:
                process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co',
              SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_TOKEN,
              GITHUB_TOKEN: process.env.GITHUB_TOKEN,
            },
            stdio: 'inherit',
          }
        );

        backfillProcess.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Backfill process exited with code ${code}`));
          }
        });

        backfillProcess.on('error', (err) => {
          reject(err);
        });
      });
    }

    // Process chunks with timeout
    while (chunksProcessed < MAX_CHUNKS) {
      try {
        await runChunk();
        chunksProcessed++;

        // Check if we should continue
        const { data: currentState } = await supabase
          .from('progressive_backfill_state')
          .select('status, processed_prs, consecutive_errors')
          .eq('id', backfillState.id)
          .single();

        if (currentState?.status === 'completed') {
          console.log('\n✅ Backfill completed!');
          break;
        }

        if (currentState?.status === 'paused') {
          console.log('\n⚠️  Backfill was paused');
          break;
        }

        if (currentState?.consecutive_errors >= 3) {
          console.log('\n❌ Too many consecutive errors, stopping');
          break;
        }

        // Wait before next chunk
        if (chunksProcessed < MAX_CHUNKS) {
          console.log(
            `\n⏱️  Waiting ${TIMEOUT_BETWEEN_CHUNKS_MS / 1000} seconds before next chunk...`
          );
          await new Promise((resolve) => setTimeout(resolve, TIMEOUT_BETWEEN_CHUNKS_MS));
        }
      } catch (error) {
        console.error(`\n❌ Error processing chunk ${chunksProcessed + 1}:`, error.message);
        break;
      }
    }

    // Final summary
    const elapsedTime = Math.round((Date.now() - startTime) / 1000);
    const { data: finalState } = await supabase
      .from('progressive_backfill_state')
      .select('processed_prs, status')
      .eq('id', backfillState.id)
      .single();

    console.log('\n📊 Backfill Summary:');
    console.log(`   Chunks processed: ${chunksProcessed}`);
    console.log(
      `   Total time: ${Math.floor(elapsedTime / 60)} minutes ${elapsedTime % 60} seconds`
    );
    console.log(`   Final status: ${finalState?.status || 'unknown'}`);
    console.log(
      `   PRs processed: ${(finalState?.processed_prs || 0) - backfillState.processed_prs}`
    );
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the backfill
runPyTorch7DayBackfill()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
