#!/usr/bin/env node

/**
 * Check the status of seed data generation jobs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });
dotenv.config({ path: join(__dirname, '../../.env') });

// Configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Run: npm run env:local');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Check seed data status
 */
async function checkSeedStatus() {
  console.log('📊 Checking Seed Data Status');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Get all seed generation jobs
  const { data: jobs, error: jobError } = await supabase
    .from('progressive_capture_jobs')
    .select('*')
    .eq('job_type', 'seed_data_capture')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (jobError) {
    console.error('❌ Failed to fetch jobs:', jobError.message);
    return;
  }
  
  if (!jobs || jobs.length === 0) {
    console.log('No seed data jobs found.');
    console.log('Run: npm run db:seed');
    return;
  }
  
  // Count by status
  const statusCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  const recentJobs = [];
  
  jobs.forEach(job => {
    statusCounts[job.status]++;
    if (job.metadata?.repository_name) {
      recentJobs.push({
        repo: job.metadata.repository_name,
        status: job.status,
        created: new Date(job.created_at).toLocaleString()
      });
    }
  });
  
  // Display overall status
  console.log('📈 Overall Status:');
  console.log(`  ⏳ Pending: ${statusCounts.pending}`);
  console.log(`  🔄 Processing: ${statusCounts.processing}`);
  console.log(`  ✅ Completed: ${statusCounts.completed}`);
  console.log(`  ❌ Failed: ${statusCounts.failed}`);
  console.log('');
  
  // Display recent jobs
  if (recentJobs.length > 0) {
    console.log('📋 Recent Seed Jobs:');
    console.log('─'.repeat(70));
    
    recentJobs.slice(0, 10).forEach(job => {
      const statusIcon = {
        pending: '⏳',
        processing: '🔄',
        completed: '✅',
        failed: '❌'
      }[job.status] || '❓';
      
      console.log(`${statusIcon} ${job.repo.padEnd(40)} ${job.status.padEnd(12)} ${job.created}`);
    });
  }
  
  // Check data availability
  console.log('\n📊 Data Availability:');
  console.log('─'.repeat(70));
  
  // Count repositories
  const { count: repoCount } = await supabase
    .from('repositories')
    .select('*', { count: 'exact', head: true });
  
  // Count pull requests
  const { count: prCount } = await supabase
    .from('pull_requests')
    .select('*', { count: 'exact', head: true });
  
  // Count contributors
  const { count: contribCount } = await supabase
    .from('contributors')
    .select('*', { count: 'exact', head: true });
  
  // Count reviews
  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true });
  
  // Count comments
  const { count: commentCount } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  📦 Repositories: ${repoCount || 0}`);
  console.log(`  🔀 Pull Requests: ${prCount || 0}`);
  console.log(`  👥 Contributors: ${contribCount || 0}`);
  console.log(`  ✍️ Reviews: ${reviewCount || 0}`);
  console.log(`  💬 Comments: ${commentCount || 0}`);
  
  // Provide recommendations
  console.log('\n💡 Recommendations:');
  
  if (statusCounts.pending > 0) {
    console.log('  • Start Inngest to process pending jobs: npm run dev:inngest');
  }
  
  if (statusCounts.failed > 0) {
    console.log('  • Check failed jobs for errors and retry if needed');
  }
  
  if (statusCounts.completed === 0 && statusCounts.processing === 0) {
    console.log('  • Generate seed data: npm run db:seed');
  }
  
  if (prCount > 0) {
    console.log('  • ✅ Data is ready! Start dev server: npm run dev');
  }
  
  console.log('');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkSeedStatus().catch(console.error);
}