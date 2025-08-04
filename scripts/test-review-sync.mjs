#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TOKEN;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_TOKEN environment variable is required');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testReviewSync() {
  const owner = process.argv[2] || 'continuedev';
  const repo = process.argv[3] || 'continue';
  
  console.log(`\n🔍 Testing review/comment sync for ${owner}/${repo}\n`);

  try {
    // Get repository ID
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .select('id, owner, name')
      .eq('owner', owner)
      .eq('name', repo)
      .single();

    if (repoError || !repoData) {
      console.error('Repository not found:', owner, repo);
      return;
    }

    console.log('Repository found:', repoData.id);

    // Get recent PRs
    const { data: prs, error: prError } = await supabase
      .from('pull_requests')
      .select('id, number, title, created_at')
      .eq('repository_id', repoData.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (prError) {
      console.error('Error fetching PRs:', prError);
      return;
    }

    console.log(`\nFound ${prs.length} recent PRs\n`);

    // Check review/comment counts for each PR
    for (const pr of prs) {
      const { data: reviews, error: revError } = await supabase
        .from('reviews')
        .select('id')
        .eq('pull_request_id', pr.id);

      const { data: comments, error: comError } = await supabase
        .from('comments')
        .select('id')
        .eq('pull_request_id', pr.id);

      // Handle potential errors
      if (revError || comError) {
        console.log(`PR #${pr.number}: "${pr.title.slice(0, 50)}..."`);
        if (revError) {
          console.log(`  ⚠️  Error fetching reviews: ${revError.message}`);
        }
        if (comError) {
          console.log(`  ⚠️  Error fetching comments: ${comError.message}`);
        }
        console.log(`  Created: ${new Date(pr.created_at).toLocaleDateString()}\n`);
        continue;
      }

      const reviewCount = reviews?.length || 0;
      const commentCount = comments?.length || 0;

      console.log(`PR #${pr.number}: "${pr.title.slice(0, 50)}..."`);
      console.log(`  Reviews: ${reviewCount}, Comments: ${commentCount}`);
      console.log(`  Created: ${new Date(pr.created_at).toLocaleDateString()}\n`);
    }

    // Check overall stats
    const { data: stats, error: statsError } = await supabase
      .from('repositories')
      .select(`
        id,
        pull_requests!inner(id),
        reviews:pull_requests!inner(reviews!inner(id)),
        comments:pull_requests!inner(comments!inner(id))
      `)
      .eq('id', repoData.id)
      .single();

    console.log('\n📊 Repository Statistics:');
    
    if (statsError) {
      console.log('⚠️  Error fetching repository statistics:', statsError.message);
    } else {
      console.log('Total PRs:', stats?.pull_requests?.length || 0);
      console.log('Total Reviews:', stats?.reviews?.length || 0);
      console.log('Total Comments:', stats?.comments?.length || 0);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testReviewSync();