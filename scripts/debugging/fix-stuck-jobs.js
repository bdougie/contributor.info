#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';

// Load environment variables
dotenv.config();

// Check for required environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Mark stuck jobs as failed
 */
async function markStuckJobsAsFailed() {
  console.log('\n🔧 Marking stuck jobs as failed...\n');

  try {
    // Find jobs that have been processing for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: stuckJobs, error: fetchError } = await supabase
      .from('progressive_capture_jobs')
      .select('id, job_type, repository_id, processor_type, started_at, metadata')
      .eq('status', 'processing')
      .lt('started_at', oneHourAgo.toISOString())
      .order('started_at', { ascending: true });

    if (fetchError) {
      console.error('❌ Error fetching stuck jobs:', fetchError);
      return;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found!');
      return;
    }

    console.log(`Found ${stuckJobs.length} stuck jobs to fix.\n`);

    // Batch update jobs
    const batchSize = 10;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < stuckJobs.length; i += batchSize) {
      const batch = stuckJobs.slice(i, i + batchSize);
      const jobIds = batch.map((job) => job.id);

      // Merge metadata properly
      const updatedMetadata = batch.map((job) => ({
        ...job.metadata,
        fixed_by_script: true,
        fixed_at: new Date().toISOString(),
        original_duration_hours: Math.floor(
          (Date.now() - new Date(job.started_at).getTime()) / (1000 * 60 * 60)
        ),
      }));

      // Update each job with its merged metadata
      const updatePromises = batch.map((job, index) =>
        supabase
          .from('progressive_capture_jobs')
          .update({
            status: 'failed',
            error: 'Job timed out - marked as failed by fix-stuck-jobs script',
            completed_at: new Date().toISOString(),
            metadata: updatedMetadata[index],
          })
          .eq('id', job.id)
      );

      const results = await Promise.all(updatePromises);
      const updateError = results.find((result) => result.error)?.error;

      if (updateError) {
        console.error(`❌ Error updating batch ${i / batchSize + 1}:`, updateError);
        failed += batch.length;
      } else {
        updated += batch.length;
        console.log(`✓ Updated batch ${i / batchSize + 1} (${batch.length} jobs)`);
      }

      // Small delay between batches
      if (i + batchSize < stuckJobs.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`\n📊 Results:`);
    console.log(`   Successfully updated: ${updated} jobs`);
    console.log(`   Failed to update: ${failed} jobs`);

    // Clean up any orphaned progress records
    console.log('\n🧹 Cleaning up orphaned progress records...');

    const jobIds = stuckJobs.map((job) => job.id);
    const { error: deleteError } = await supabase
      .from('progressive_capture_progress')
      .delete()
      .in('job_id', jobIds);

    if (deleteError) {
      console.error('❌ Error cleaning up progress records:', deleteError);
    } else {
      console.log('✅ Cleaned up progress records');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Create a monitoring job to track job health
 */
async function createMonitoringJob() {
  console.log('\n📊 Creating monitoring job...\n');

  try {
    // Check job statistics
    const { data: stats, error } = await supabase.rpc('get_progressive_capture_metrics', {
      days_back: 1,
    });

    if (error || !stats || stats.length === 0) {
      console.error('❌ Error getting job metrics:', error);
      return;
    }

    const stat = stats[0];
    console.log('Current job statistics (last 24 hours):');
    console.log(`  Total jobs: ${stat.total_jobs}`);
    console.log(`  Pending: ${stat.pending_jobs}`);
    console.log(`  Processing: ${stat.processing_jobs}`);
    console.log(`  Completed: ${stat.completed_jobs}`);
    console.log(`  Failed: ${stat.failed_jobs}`);

    if (stat.completed_jobs === 0 && stat.failed_jobs > 0) {
      console.log('\n⚠️  WARNING: 100% error rate detected!');
    }

    // Create monitoring record
    const { error: insertError } = await supabase.from('progressive_capture_jobs').insert({
      job_type: 'system-monitoring',
      processor_type: 'github_actions',
      status: 'completed',
      completed_at: new Date().toISOString(),
      metadata: {
        type: 'job_health_check',
        stats: stat,
        alert: stat.completed_jobs === 0 && stat.failed_jobs > 0 ? '100% error rate' : null,
        timestamp: new Date().toISOString(),
      },
    });

    if (insertError) {
      console.error('❌ Error creating monitoring record:', insertError);
    } else {
      console.log('✅ Monitoring record created');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

/**
 * Main menu
 */
async function main() {
  console.log('🚀 Progressive Capture Job Fixer\n');

  console.log('What would you like to do?');
  console.log('1. Mark all stuck jobs as failed');
  console.log('2. Create monitoring job');
  console.log('3. Both (recommended)');
  console.log('4. Exit');

  const choice = await question('\nEnter your choice (1-4): ');

  switch (choice.trim()) {
    case '1':
      await markStuckJobsAsFailed();
      break;
    case '2':
      await createMonitoringJob();
      break;
    case '3':
      await markStuckJobsAsFailed();
      await createMonitoringJob();
      break;
    case '4':
      console.log('👋 Goodbye!');
      break;
    default:
      console.log('❌ Invalid choice');
  }

  rl.close();
}

// Run the script
main().catch((error) => {
  console.error('❌ Script error:', error);
  rl.close();
  process.exit(1);
});
