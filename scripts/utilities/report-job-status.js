#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'util';

// Parse command line arguments
const { values } = parseArgs({
  options: {
    'job-id': { type: 'string' },
    status: { type: 'string' },
    conclusion: { type: 'string' },
  },
});

const jobId = values['job-id'];
const status = values['status'];
const conclusion = values['conclusion'];

if (!jobId) {
  console.error('Missing required argument: --job-id');
  process.exit(1);
}

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_TOKEN || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function reportJobStatus() {
  try {
    console.log(`Reporting job status for ${jobId}: ${status} (${conclusion})`);

    // Map GitHub Actions status to our job status
    let jobStatus = 'processing';
    if (status === 'completed') {
      switch (conclusion) {
        case 'success':
          jobStatus = 'completed';
          break;
        case 'failure':
        case 'cancelled':
        case 'timed_out':
          jobStatus = 'failed';
          break;
      }
    }

    // Update job status in database
    const { error } = await supabase
      .from('progressive_capture_jobs')
      .update({
        status: jobStatus,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        metadata: {
          github_status: status,
          github_conclusion: conclusion,
          workflow_run_url:
            process.env.GITHUB_SERVER_URL &&
            process.env.GITHUB_REPOSITORY &&
            process.env.GITHUB_RUN_ID
              ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
              : undefined,
        },
      })
      .eq('id', jobId);

    if (error) {
      console.error('Error updating job status:', error);
      process.exit(1);
    }

    console.log('Job status reported successfully');
  } catch (error) {
    console.error('Failed to report job status:', error);
    process.exit(1);
  }
}

reportJobStatus();
