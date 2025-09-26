#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check for required environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL or VITE_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY');
  console.error('\nPlease ensure these are set in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Monitor and fix stuck jobs in the progressive capture system
 */
async function monitorStuckJobs() {
  console.log('🔍 Monitoring stuck progressive capture jobs...\n');

  try {
    // Find jobs that have been processing for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data: stuckJobs, error } = await supabase
      .from('progressive_capture_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('started_at', oneHourAgo.toISOString())
      .order('started_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching stuck jobs:', error);
      return;
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      console.log('✅ No stuck jobs found!');
      return;
    }

    console.log(`⚠️  Found ${stuckJobs.length} stuck jobs:\n`);

    // Group by processor type
    const byProcessor = stuckJobs.reduce((acc, job) => {
      acc[job.processor_type] = (acc[job.processor_type] || 0) + 1;
      return acc;
    }, {});

    console.log('By processor type:');
    Object.entries(byProcessor).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count} jobs`);
    });

    console.log('\nDetailed list:');

    for (const job of stuckJobs) {
      const duration = Date.now() - new Date(job.started_at).getTime();
      const hours = Math.floor(duration / (1000 * 60 * 60));
      const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`\n📋 Job ${job.id}`);
      console.log(`   Type: ${job.job_type}`);
      console.log(`   Processor: ${job.processor_type}`);
      console.log(`   Repository: ${job.metadata?.repository_name || 'Unknown'}`);
      console.log(`   Started: ${job.started_at}`);
      console.log(`   Duration: ${hours}h ${minutes}m`);

      // Check if there's a progress record
      const { data: progress } = await supabase
        .from('progressive_capture_progress')
        .select('*')
        .eq('job_id', job.id)
        .single();

      if (progress) {
        console.log(`   Progress: ${progress.processed_items}/${progress.total_items} items`);
        console.log(`   Failed items: ${progress.failed_items}`);
        console.log(`   Current item: ${progress.current_item}`);
      } else {
        console.log(`   Progress: No progress record found`);
      }
    }

    // Ask user if they want to fix the stuck jobs
    console.log('\n❓ What would you like to do?');
    console.log('   1. Mark all stuck jobs as failed');
    console.log('   2. Mark specific jobs as failed');
    console.log('   3. Retry all stuck jobs');
    console.log('   4. Just monitor (no action)');
    console.log(
      '\nNote: This script currently only monitors. To fix jobs, implement the action handlers.'
    );
  } catch (error) {
    console.error('❌ Monitoring error:', error);
  }
}

/**
 * Get statistics about job completion rates
 */
async function getJobStatistics() {
  console.log('\n📊 Job Statistics (last 24 hours):\n');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // Get counts by status
    const { data: stats, error } = await supabase
      .from('progressive_capture_jobs')
      .select('status, processor_type')
      .gte('created_at', oneDayAgo.toISOString());

    if (error || !stats) {
      console.error('❌ Error fetching statistics:', error);
      return;
    }

    // Calculate statistics
    const statusCounts = stats.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {});

    const processorCounts = stats.reduce((acc, job) => {
      const key = `${job.processor_type}_${job.status}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    // Display overall stats
    const total = stats.length;
    const completed = statusCounts.completed || 0;
    const failed = statusCounts.failed || 0;
    const processing = statusCounts.processing || 0;
    const pending = statusCounts.pending || 0;

    console.log('Overall:');
    console.log(`  Total jobs: ${total}`);
    console.log(
      `  Completed: ${completed} (${total ? ((completed / total) * 100).toFixed(1) : '0.0'}%)`
    );
    console.log(`  Failed: ${failed} (${total ? ((failed / total) * 100).toFixed(1) : '0.0'}%)`);
    console.log(
      `  Processing: ${processing} (${total ? ((processing / total) * 100).toFixed(1) : '0.0'}%)`
    );
    console.log(`  Pending: ${pending} (${total ? ((pending / total) * 100).toFixed(1) : '0.0'}%)`);

    // Display by processor
    console.log('\nBy processor:');
    console.log('  Inngest:');
    console.log(`    - Completed: ${processorCounts.inngest_completed || 0}`);
    console.log(`    - Failed: ${processorCounts.inngest_failed || 0}`);
    console.log(`    - Processing: ${processorCounts.inngest_processing || 0}`);

    console.log('  GitHub Actions:');
    console.log(`    - Completed: ${processorCounts.github_actions_completed || 0}`);
    console.log(`    - Failed: ${processorCounts.github_actions_failed || 0}`);
    console.log(`    - Processing: ${processorCounts.github_actions_processing || 0}`);

    // Calculate error rate
    if (total > 0) {
      const errorRate = total ? ((failed / total) * 100).toFixed(1) : '0.0';
      const successRate = total ? ((completed / total) * 100).toFixed(1) : '0.0';

      console.log('\n📈 Key Metrics:');
      console.log(`  Success rate: ${successRate}%`);
      console.log(`  Error rate: ${errorRate}%`);

      if (completed === 0 && failed > 0) {
        console.log('\n⚠️  WARNING: 100% error rate - no jobs completing successfully!');
      }
    }
  } catch (error) {
    console.error('❌ Statistics error:', error);
  }
}

// Run monitoring
console.log('🚀 Progressive Capture Job Monitor\n');

await monitorStuckJobs();
await getJobStatistics();

console.log('\n✅ Monitoring complete');
