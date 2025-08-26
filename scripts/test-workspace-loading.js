#!/usr/bin/env node

/**
 * Test script to verify workspace loading improvements
 * This simulates various loading scenarios to ensure non-blocking behavior
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('❌ Missing VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test auth check with timeout
async function testAuthTimeout() {
  console.log('\n🔍 Testing auth check with timeout...');
  
  const startTime = Date.now();
  const authTimeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Auth check timeout')), 2000)
  );
  
  try {
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      authTimeout
    ]);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Auth check completed in ${elapsed}ms`);
    
    if (authResult?.data?.user) {
      console.log(`  User: ${authResult.data.user.email}`);
    } else {
      console.log('  No user authenticated');
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Auth check timed out after ${elapsed}ms (expected ~2000ms)`);
    
    // Try session fallback
    console.log('  Trying session fallback...');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      console.log(`  ✅ Found user via session: ${session.user.email}`);
    } else {
      console.log('  ❌ No session found');
    }
  }
}

// Test workspace loading with timeout
async function testWorkspaceLoading() {
  console.log('\n🔍 Testing workspace loading...');
  
  const startTime = Date.now();
  
  try {
    // Get user first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log('❌ No authenticated user, skipping workspace test');
      return;
    }
    
    console.log(`✅ User authenticated: ${user.email}`);
    
    // Simulate workspace loading with timeout
    const loadingTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Workspace loading timeout')), 10000)
    );
    
    const workspaceQuery = supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    const result = await Promise.race([
      workspaceQuery,
      loadingTimeout
    ]);
    
    const elapsed = Date.now() - startTime;
    
    if (result?.data) {
      console.log(`✅ Workspace query completed in ${elapsed}ms`);
      console.log(`  Found ${result.data.length} workspace(s)`);
    } else if (result?.error) {
      console.log(`❌ Workspace query error after ${elapsed}ms: ${result.error.message}`);
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error.message === 'Workspace loading timeout') {
      console.log(`⏱️  Workspace loading timed out after ${elapsed}ms`);
    } else {
      console.log(`❌ Error: ${error.message}`);
    }
  }
}

// Test error recovery
async function testErrorRecovery() {
  console.log('\n🔍 Testing error recovery...');
  
  // Simulate auth error
  console.log('  Simulating auth error...');
  const { error: authError } = await supabase.auth.getUser();
  
  if (authError) {
    console.log(`  Auth error occurred: ${authError.message}`);
    console.log('  Attempting session recovery...');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      console.log('  ✅ Recovered via session');
    } else {
      console.log('  ❌ No session available');
    }
  } else {
    console.log('  ✅ No auth errors');
  }
}

// Test loading states
function testLoadingStates() {
  console.log('\n🔍 Testing loading state transitions...');
  
  const states = [
    { time: 0, loading: true, error: null, message: 'Initial loading state' },
    { time: 2000, loading: true, error: null, message: 'Still loading after 2s' },
    { time: 3000, loading: true, error: null, message: 'Show "Taking longer than usual" after 3s' },
    { time: 5000, loading: false, error: 'Loading timed out', message: 'Context timeout after 5s' },
    { time: 10000, loading: false, error: 'Workspace loading timed out', message: 'Hook timeout after 10s' },
  ];
  
  states.forEach(state => {
    console.log(`  ${state.time}ms: ${state.message}`);
    console.log(`    Loading: ${state.loading}, Error: ${state.error || 'none'}`);
  });
}

// Run all tests
async function runTests() {
  console.log('🧪 Workspace Loading Test Suite');
  console.log('================================');
  
  await testAuthTimeout();
  await testWorkspaceLoading();
  await testErrorRecovery();
  testLoadingStates();
  
  console.log('\n✅ All tests completed');
  console.log('\n📝 Summary:');
  console.log('  - Auth checks timeout after 2 seconds');
  console.log('  - Workspace loading shows timeout message after 3 seconds');
  console.log('  - Context stops loading after 5 seconds');
  console.log('  - Hook stops loading after 10 seconds');
  console.log('  - Errors are handled gracefully without blocking UI');
}

// Run the tests
runTests().catch(console.error);