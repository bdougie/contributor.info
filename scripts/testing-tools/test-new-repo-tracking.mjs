#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testNewRepoTracking() {
  // Test repository that likely doesn't exist in our database
  const testOwner = 'pytorch';
  const testRepo = 'pytorch';
  
  console.log(`\nTesting repository tracking for: ${testOwner}/${testRepo}`);
  console.log('================================================\n');
  
  // Check if repository exists
  const { data: repoData, error: repoError } = await supabase
    .from('repositories')
    .select('id, owner, name')
    .eq('owner', testOwner)
    .eq('name', testRepo)
    .single();
    
  if (repoError && repoError.code === 'PGRST116') {
    console.log('✅ Repository not found in database (as expected for test)');
    console.log('   This would trigger the new repository notification\n');
  } else if (repoData) {
    console.log('⚠️  Repository already exists in database:');
    console.log(`   ID: ${repoData.id}`);
    console.log(`   Repository: ${repoData.owner}/${repoData.name}\n`);
  }
  
  // Check tracked_repositories table
  const { data: trackedData, error: trackedError } = await supabase
    .from('tracked_repositories')
    .select('*')
    .eq('organization_name', testOwner)
    .eq('repository_name', testRepo)
    .single();
    
  if (trackedError && trackedError.code === 'PGRST116') {
    console.log('✅ Repository not in tracked_repositories table');
    console.log('   Would be added when user searches for it\n');
  } else if (trackedData) {
    console.log('📊 Repository tracking status:');
    console.log(`   Tracking enabled: ${trackedData.tracking_enabled}`);
    console.log(`   Priority: ${trackedData.priority}`);
    console.log(`   Size: ${trackedData.size || 'Not calculated yet'}`);
    console.log(`   Created: ${new Date(trackedData.created_at).toLocaleString()}\n`);
  }
  
  console.log('🎯 Expected behavior when user searches for this repo:');
  console.log('   1. Show notification: "Setting up pytorch/pytorch..."');
  console.log('   2. Add to tracked_repositories table');
  console.log('   3. Trigger Inngest jobs for data sync');
  console.log('   4. Show welcome message with 1-2 minute estimate');
  console.log('   5. Display skeleton loaders while data loads');
}

testNewRepoTracking().catch(console.error);