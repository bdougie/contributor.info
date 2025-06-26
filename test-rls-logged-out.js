#!/usr/bin/env node

// Test script to verify logged-out user experience with RLS enabled
// This simulates anonymous/public access to ensure data is still accessible

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
  process.exit(1);
}

// Create a Supabase client with anon key (simulating logged-out user)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPublicAccess() {
  console.log('🧪 Testing public access to tables with RLS enabled...\n');

  const tests = [
    {
      name: 'Contributors table',
      query: () => supabase.from('contributors').select('*').limit(5)
    },
    {
      name: 'Repositories table',
      query: () => supabase.from('repositories').select('*').limit(5)
    },
    {
      name: 'Pull Requests table',
      query: () => supabase.from('pull_requests').select('*').limit(5)
    },
    {
      name: 'Reviews table',
      query: () => supabase.from('reviews').select('*').limit(5)
    },
    {
      name: 'Comments table',
      query: () => supabase.from('comments').select('*').limit(5)
    },
    {
      name: 'Organizations table',
      query: () => supabase.from('organizations').select('*').limit(5)
    },
    {
      name: 'Monthly Rankings table',
      query: () => supabase.from('monthly_rankings').select('*').limit(5)
    },
    {
      name: 'Contributor Stats view',
      query: () => supabase.from('contributor_stats').select('*').limit(5)
    },
    {
      name: 'Repository Stats view',
      query: () => supabase.from('repository_stats').select('*').limit(5)
    },
    {
      name: 'Recent Activity view',
      query: () => supabase.from('recent_activity').select('*').limit(5)
    },
    {
      name: 'Share Analytics Summary view',
      query: () => supabase.from('share_analytics_summary').select('*').limit(5)
    }
  ];

  let allPassed = true;

  for (const test of tests) {
    try {
      const { data, error } = await test.query();
      
      if (error) {
        console.error(`❌ ${test.name}: FAILED`);
        console.error(`   Error: ${error.message}`);
        allPassed = false;
      } else {
        console.log(`✅ ${test.name}: PASSED`);
        console.log(`   Records returned: ${data?.length || 0}`);
      }
    } catch (err) {
      console.error(`❌ ${test.name}: FAILED`);
      console.error(`   Error: ${err.message}`);
      allPassed = false;
    }
  }

  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('✅ All tests passed! Public access is working correctly.');
    console.log('   Logged-out users can view data as expected.');
  } else {
    console.log('❌ Some tests failed. Please check the errors above.');
    console.log('   You may need to apply the migration or check RLS policies.');
  }

  // Test write operations (should fail for anonymous users)
  console.log('\n🧪 Testing write restrictions for anonymous users...\n');
  
  try {
    const { error } = await supabase
      .from('contributors')
      .insert({ github_id: 999999, username: 'test-user' });
    
    if (error) {
      console.log('✅ Write restriction test: PASSED');
      console.log('   Anonymous users cannot insert data (as expected)');
    } else {
      console.log('❌ Write restriction test: FAILED');
      console.log('   Anonymous users should not be able to insert data!');
    }
  } catch (err) {
    console.log('✅ Write restriction test: PASSED');
    console.log('   Anonymous users cannot insert data (as expected)');
  }
}

// Run the tests
testPublicAccess().catch(console.error);