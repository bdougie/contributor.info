#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Test job completion by running a simple capture script
 */
async function testJobCompletion() {
  console.log('🧪 Testing Job Completion\n');

  try {
    // Create a test job record
    const { data: testJob, error: createError } = await supabase
      .from('progressive_capture_jobs')
      .insert({
        job_type: 'test-job',
        repository_id: 'test-repo-id',
        processor_type: 'github_actions',
        status: 'pending',
        metadata: {
          repository_name: 'test/repo',
          test: true,
          created_by: 'test-job-completion',
        },
      })
      .select()
      .single();

    if (createError || !testJob) {
      console.error('❌ Failed to create test job:', createError);
      return;
    }

    console.log(`✅ Created test job: ${testJob.id}`);

    // Test the capture script with proper environment variables
    console.log('\n📦 Testing capture script...\n');

    const env = {
      ...process.env,
      JOB_ID: testJob.id,
      REPOSITORY_ID: 'c2c65b3e-a5e3-4f9f-8c1f-95e2a0e3f0f1', // continuedev/continue
      REPOSITORY_NAME: 'continuedev/continue',
      PR_NUMBERS: '1,2,3', // Test with specific PRs
      TIME_RANGE: '7',
    };

    const captureProcess = spawn('node', ['scripts/progressive-capture/capture-pr-details.js'], {
      env,
      stdio: 'inherit',
    });

    captureProcess.on('exit', async (code) => {
      console.log(`\n📊 Capture script exited with code: ${code}`);

      // Check if job was updated
      const { data: updatedJob, error: fetchError } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('id', testJob.id)
        .single();

      if (fetchError || !updatedJob) {
        console.error('❌ Failed to fetch updated job:', fetchError);
        return;
      }

      console.log('\n📋 Job Status After Script:');
      console.log(`   Status: ${updatedJob.status}`);
      console.log(`   Started at: ${updatedJob.started_at}`);
      console.log(`   Completed at: ${updatedJob.completed_at}`);
      console.log(`   Error: ${updatedJob.error || 'None'}`);

      // Check for progress record
      const { data: progress } = await supabase
        .from('progressive_capture_progress')
        .select('*')
        .eq('job_id', testJob.id)
        .single();

      if (progress) {
        console.log('\n📈 Progress Record:');
        console.log(`   Total items: ${progress.total_items}`);
        console.log(`   Processed: ${progress.processed_items}`);
        console.log(`   Failed: ${progress.failed_items}`);
        console.log(`   Current: ${progress.current_item}`);
      } else {
        console.log('\n⚠️  No progress record found');
      }

      // Clean up test job
      await supabase.from('progressive_capture_jobs').delete().eq('id', testJob.id);

      if (progress) {
        await supabase.from('progressive_capture_progress').delete().eq('job_id', testJob.id);
      }

      console.log('\n🧹 Cleaned up test data');

      // Final verdict
      if (updatedJob.status === 'completed') {
        console.log('\n✅ SUCCESS: Job completion is working properly!');
      } else {
        console.log('\n❌ FAILURE: Job did not complete properly');
        console.log('   Please check the error logs above');
      }
    });
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testJobCompletion();
