#!/usr/bin/env node

/**
 * Backfill script to capture missing reviews and comments for existing PRs
 * This script identifies PRs that lack review/comment data and triggers
 * the appropriate Inngest functions to capture them.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TOKEN;
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_PRODUCTION_EVENT_KEY;
const API_URL = process.env.VITE_API_URL || 'https://contributor.info/api';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function findPRsWithoutReviewsComments(repositoryId, limit = 100) {
  // Query to find PRs that have no reviews or comments
  const { data: prs, error } = await supabase
    .from('pull_requests')
    .select(`
      id,
      github_id,
      number,
      title,
      created_at,
      state,
      reviews!left(id),
      comments!left(id)
    `)
    .eq('repository_id', repositoryId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching PRs:', error);
    return [];
  }

  // Filter PRs that have no reviews AND no comments
  return prs.filter(pr => 
    (!pr.reviews || pr.reviews.length === 0) && 
    (!pr.comments || pr.comments.length === 0)
  );
}

async function triggerReviewCommentCapture(repositoryId, prs) {
  const events = [];
  
  for (const pr of prs) {
    // Create events for review capture
    events.push({
      name: "capture/pr.reviews",
      data: {
        repositoryId,
        prNumber: pr.number.toString(),
        prId: pr.id,
        prGithubId: pr.github_id.toString(),
        priority: 'backfill',
        reason: 'missing_data_backfill'
      }
    });
    
    // Create events for comment capture
    events.push({
      name: "capture/pr.comments",
      data: {
        repositoryId,
        prNumber: pr.number.toString(),
        prId: pr.id,
        prGithubId: pr.github_id.toString(),
        priority: 'backfill',
        reason: 'missing_data_backfill'
      }
    });
  }

  if (!INNGEST_EVENT_KEY) {
    console.log('\nWARNING: No INNGEST_EVENT_KEY found. Would have sent these events:');
    console.log(JSON.stringify(events.slice(0, 5), null, 2));
    console.log(`... and ${events.length - 5} more events`);
    return;
  }

  // Send events to Inngest
  try {
    const response = await fetch(`${API_URL}/inngest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-inngest-event-key': INNGEST_EVENT_KEY
      },
      body: JSON.stringify(events)
    });

    if (!response.ok) {
      throw new Error(`Failed to send events: ${response.status} ${response.statusText}`);
    }

    console.log(`✅ Successfully queued ${events.length} capture events`);
  } catch (error) {
    console.error('Error sending events to Inngest:', error);
  }
}

async function backfillReviewsComments() {
  const owner = process.argv[2];
  const repo = process.argv[3];
  const limit = parseInt(process.argv[4]) || 50;
  
  if (!owner || !repo) {
    console.log('Usage: node backfill-reviews-comments.mjs <owner> <repo> [limit]');
    console.log('Example: node backfill-reviews-comments.mjs continuedev continue 100');
    process.exit(1);
  }

  console.log(`\n🔄 Backfilling reviews/comments for ${owner}/${repo}\n`);

  try {
    // Get repository
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      console.error('Repository not found:', owner, repo);
      return;
    }

    // Find PRs without reviews/comments
    const prsWithoutData = await findPRsWithoutReviewsComments(repoData.id, limit);
    
    console.log(`Found ${prsWithoutData.length} PRs without reviews/comments (checked ${limit} most recent PRs)\n`);
    
    if (prsWithoutData.length === 0) {
      console.log('✨ All PRs have review/comment data!');
      return;
    }

    // Show sample of PRs to be processed
    console.log('Sample PRs to be processed:');
    prsWithoutData.slice(0, 5).forEach(pr => {
      console.log(`  PR #${pr.number}: "${pr.title.slice(0, 50)}..."`);
    });
    
    if (prsWithoutData.length > 5) {
      console.log(`  ... and ${prsWithoutData.length - 5} more\n`);
    }

    // Trigger capture for these PRs
    await triggerReviewCommentCapture(repoData.id, prsWithoutData);
    
    console.log('\n📊 Next steps:');
    console.log('1. Monitor Inngest dashboard for job progress');
    console.log('2. Run test-review-sync.mjs to verify data is being captured');
    console.log('3. Check the feed page to see reviews/comments appearing');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

backfillReviewsComments();