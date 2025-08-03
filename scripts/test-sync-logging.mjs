#!/usr/bin/env node

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSyncLogging() {
  console.log('🧪 Testing sync logging functionality...\n');

  // 1. Find a repository with recent PRs
  const { data: repos, error: repoError } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .order('last_updated_at', { ascending: false })
    .limit(1);

  if (repoError || !repos?.length) {
    console.error('❌ No repositories found:', repoError);
    return;
  }

  const repo = repos[0];
  console.log(`📦 Using repository: ${repo.owner}/${repo.name}`);

  // 2. Find a recent PR from that repository
  const { data: prs, error: prError } = await supabase
    .from('pull_requests')
    .select('id, number, github_id')
    .eq('repository_id', repo.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (prError || !prs?.length) {
    console.error('❌ No PRs found:', prError);
    return;
  }

  const pr = prs[0];
  console.log(`🔗 Using PR #${pr.number}\n`);

  // 3. Check if we have comments/reviews for this PR
  const { count: commentCount } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('pull_request_id', pr.id);

  const { count: reviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('pull_request_id', pr.id);

  console.log(`📊 Current data for PR #${pr.number}:`);
  console.log(`   • Comments: ${commentCount || 0}`);
  console.log(`   • Reviews: ${reviewCount || 0}\n`);

  // 4. Trigger Inngest events to capture comments and reviews
  console.log('🚀 Triggering capture events...\n');

  // Send event to capture comments
  const commentResponse = await fetch('http://localhost:8888/api/queue-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventName: 'capture/pr.comments',
      data: {
        repositoryId: repo.id,
        prNumber: pr.number.toString(),
        prId: pr.id,
        prGithubId: pr.github_id,
        priority: 'high',
      },
    }),
  });

  if (commentResponse.ok) {
    console.log('✅ Comment capture event sent successfully');
  } else {
    console.error('❌ Failed to send comment capture event:', await commentResponse.text());
  }

  // Send event to capture reviews
  const reviewResponse = await fetch('http://localhost:8888/api/queue-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventName: 'capture/pr.reviews',
      data: {
        repositoryId: repo.id,
        prNumber: pr.number.toString(),
        prId: pr.id,
        prGithubId: pr.github_id,
        priority: 'high',
      },
    }),
  });

  if (reviewResponse.ok) {
    console.log('✅ Review capture event sent successfully\n');
  } else {
    console.error('❌ Failed to send review capture event:', await reviewResponse.text());
  }

  // 5. Wait a moment then check sync logs
  console.log('⏳ Waiting 5 seconds for processing...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 6. Check sync logs
  const { data: syncLogs, error: syncError } = await supabase
    .from('sync_logs')
    .select('*')
    .eq('repository_id', repo.id)
    .in('sync_type', ['pr_comments', 'pr_reviews'])
    .order('started_at', { ascending: false })
    .limit(5);

  if (syncError) {
    console.error('❌ Error fetching sync logs:', syncError);
    return;
  }

  console.log('📋 Recent sync logs:');
  if (syncLogs?.length) {
    syncLogs.forEach(log => {
      console.log(`\n   • Type: ${log.sync_type}`);
      console.log(`     Status: ${log.status}`);
      console.log(`     Started: ${new Date(log.started_at).toLocaleString()}`);
      console.log(`     Records: ${log.records_processed || 0} processed, ${log.records_inserted || 0} inserted`);
      console.log(`     API Calls: ${log.github_api_calls_used || 0}`);
      if (log.error_message) {
        console.log(`     ❌ Error: ${log.error_message}`);
      }
      if (log.metadata) {
        console.log(`     📊 Metadata:`, JSON.stringify(log.metadata, null, 2));
      }
    });
  } else {
    console.log('   ⚠️ No sync logs found - this might indicate the functions aren\'t running');
  }

  // 7. Check updated counts
  console.log('\n📊 Checking updated counts...\n');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { count: newCommentCount } = await supabase
    .from('comments')
    .select('*', { count: 'exact', head: true })
    .eq('pull_request_id', pr.id);

  const { count: newReviewCount } = await supabase
    .from('reviews')
    .select('*', { count: 'exact', head: true })
    .eq('pull_request_id', pr.id);

  console.log(`📈 Updated data for PR #${pr.number}:`);
  console.log(`   • Comments: ${commentCount || 0} → ${newCommentCount || 0}`);
  console.log(`   • Reviews: ${reviewCount || 0} → ${newReviewCount || 0}`);

  if ((newCommentCount || 0) > (commentCount || 0) || (newReviewCount || 0) > (reviewCount || 0)) {
    console.log('\n✅ Data capture is working! New data was added.');
  } else {
    console.log('\n⚠️ No new data was captured. Check the sync logs for errors.');
    console.log('💡 Common issues:');
    console.log('   • Missing or invalid GitHub token');
    console.log('   • Rate limiting');
    console.log('   • Inngest functions not running');
  }
}

// Run the test
testSyncLogging().catch(console.error);