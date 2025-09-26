#!/usr/bin/env node

/**
 * Debug GitHub Actions errors from stored artifacts
 *
 * This script helps analyze why GitHub Actions jobs are succeeding but
 * producing errors that get stored as artifacts.
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeGitHubActionsErrors() {
  console.log('🔍 Analyzing GitHub Actions errors...\n');

  try {
    // Get recent failed jobs from the database
    const { data: failedJobs, error: failedJobsError } = await supabase
      .from('progressive_capture_jobs')
      .select('*')
      .eq('processor_type', 'github_actions')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(50);

    if (failedJobsError) {
      console.error('❌ Error fetching failed jobs:', failedJobsError);
      return;
    }

    if (!failedJobs || failedJobs.length === 0) {
      console.log('No failed GitHub Actions jobs found in the database.');
      console.log('\n🤔 Possible reasons:');
      console.log('1. Jobs are completing successfully but storing errors as artifacts');
      console.log('2. Job status is not being updated correctly after workflow completion');
      console.log('3. The workflow is not reporting failures back to the database\n');

      // Check for jobs that might have errors in metadata
      const { data: allJobs, error: allJobsError } = await supabase
        .from('progressive_capture_jobs')
        .select('*')
        .eq('processor_type', 'github_actions')
        .not('metadata->error', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (allJobsError) {
        console.error('❌ Error fetching jobs with metadata errors:', allJobsError);
        return;
      }

      if (allJobs && allJobs.length > 0) {
        console.log(`Found ${allJobs.length} GitHub Actions jobs with errors in metadata:\n`);
        allJobs.forEach((job) => {
          console.log(`Job ID: ${job.id}`);
          console.log(`Status: ${job.status}`);
          console.log(`Created: ${new Date(job.created_at).toLocaleString()}`);
          console.log(
            `Error in metadata: ${JSON.stringify(job.metadata?.error || 'No error', null, 2)}`
          );
          console.log('---');
        });
      }
    } else {
      console.log(`Found ${failedJobs.length} failed GitHub Actions jobs:\n`);

      // Group errors by type
      const errorGroups = {};
      failedJobs.forEach((job) => {
        const errorType = job.error?.split('\n')[0] || 'Unknown error';
        if (!errorGroups[errorType]) {
          errorGroups[errorType] = [];
        }
        errorGroups[errorType].push(job);
      });

      // Display error summary
      console.log('📊 Error Summary:');
      Object.entries(errorGroups).forEach(([errorType, jobs]) => {
        console.log(`\n${errorType}: ${jobs.length} occurrences`);
        console.log('Recent examples:');
        jobs.slice(0, 3).forEach((job) => {
          console.log(`  - Job ${job.id} (${new Date(job.created_at).toLocaleString()})`);
          if (job.metadata?.repository_name) {
            console.log(`    Repository: ${job.metadata.repository_name}`);
          }
        });
      });
    }

    // Check for common issues
    console.log('\n🔧 Checking for common issues...\n');

    // 1. Check if GITHUB_TOKEN is configured
    const hasGitHubToken = process.env.GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN;
    console.log(
      `✓ GITHUB_TOKEN configured: ${hasGitHubToken ? 'Yes' : 'No (THIS IS LIKELY THE ISSUE!)'}`
    );

    // 2. Check repository access
    console.log('\n📦 Checking workflow repository configuration:');
    console.log('  - Jobs repository: bdougie/jobs');
    console.log('  - Ensure the GITHUB_TOKEN has access to dispatch workflows in this repository');
    console.log('  - Verify the workflow files exist in the repository:');
    console.log('    • historical-pr-sync.yml');
    console.log('    • historical-reviews-sync.yml');
    console.log('    • historical-comments-sync.yml');
    console.log('    • bulk-file-changes.yml');

    // 3. Suggest debugging steps
    console.log('\n🐛 Debugging steps:');
    console.log('1. Check the GitHub Actions logs in the bdougie/jobs repository');
    console.log('2. Look for artifact files that contain error details');
    console.log('3. Verify the workflow files are using proper error handling');
    console.log('4. Ensure the CLI scripts in the jobs repository have correct dependencies');
    console.log('5. Check if the Supabase connection from GitHub Actions is working');

    // Get system metrics directly from database
    console.log('\n📈 System Metrics:');
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: metricsData, error: metricsError } = await supabase
      .from('progressive_capture_jobs')
      .select('processor_type, status')
      .eq('processor_type', 'github_actions')
      .gte('created_at', twentyFourHoursAgo.toISOString());

    if (metricsError) {
      console.error('❌ Error fetching metrics:', metricsError);
      return;
    }

    if (metricsData && metricsData.length > 0) {
      const total = metricsData.length;
      const completed = metricsData.filter((j) => j.status === 'completed').length;
      const failed = metricsData.filter((j) => j.status === 'failed').length;
      const processing = metricsData.filter((j) => j.status === 'processing').length;
      const pending = metricsData.filter((j) => j.status === 'pending').length;

      const successRate = total > 0 ? (completed / total) * 100 : 0;
      const errorRate = total > 0 ? (failed / total) * 100 : 0;

      console.log(`Total Jobs: ${total}`);
      console.log(`Success Rate: ${successRate.toFixed(1)}%`);
      console.log(`Error Rate: ${errorRate.toFixed(1)}%`);
      console.log(
        `Status breakdown: ${completed} completed, ${failed} failed, ${processing} processing, ${pending} pending`
      );

      if (errorRate > 50) {
        console.log('\n⚠️ High error rate detected - check GitHub Actions configuration');
      }
    } else {
      console.log('No GitHub Actions jobs found in the last 24 hours');
    }
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

// Run the analysis
analyzeGitHubActionsErrors();
