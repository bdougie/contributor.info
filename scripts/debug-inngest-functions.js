#!/usr/bin/env node

// Debug script to check function registration
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const INNGEST_API_URL = 'http://localhost:8288';

async function checkFunctions() {
  try {
    // Check if dev server is running
    const healthResponse = await fetch(`${INNGEST_API_URL}/health`);
    if (healthResponse.ok) {
      console.log('✅ Inngest dev server is running\n');
    }
  } catch (error) {
    console.error('❌ Inngest dev server is not running at localhost:8288');
    console.log('   Make sure npm start is running\n');
    return;
  }

  try {
    // Get all registered functions
    const functionsResponse = await fetch(`${INNGEST_API_URL}/api/v1/functions`);
    const functions = await functionsResponse.json();
    
    console.log(`📋 Total registered functions: ${functions.length}\n`);
    
    // Check for GraphQL functions
    const graphqlFunctions = functions.filter(fn => 
      fn.id.includes('graphql') || 
      fn.triggers?.some(t => t.event?.includes('graphql'))
    );
    
    if (graphqlFunctions.length > 0) {
      console.log(`✅ Found ${graphqlFunctions.length} GraphQL functions:\n`);
      graphqlFunctions.forEach(fn => {
        console.log(`   - ${fn.name || fn.id}`);
        console.log(`     ID: ${fn.id}`);
        console.log(`     Triggers: ${fn.triggers?.map(t => t.event).join(', ')}`);
        console.log('');
      });
    } else {
      console.log('❌ No GraphQL functions found!\n');
    }
    
    // Check for sync logger functions
    const syncFunctions = functions.filter(fn => 
      fn.id.includes('capture') || 
      fn.triggers?.some(t => t.event?.includes('capture'))
    );
    
    console.log(`📦 Found ${syncFunctions.length} capture functions:\n`);
    syncFunctions.forEach(fn => {
      console.log(`   - ${fn.name || fn.id}`);
    });
    
  } catch (error) {
    console.error('Error checking functions:', error.message);
  }
}

async function checkRecentRuns() {
  try {
    // Get recent runs
    const runsResponse = await fetch(`${INNGEST_API_URL}/api/v1/runs?limit=10`);
    const runs = await runsResponse.json();
    
    console.log(`\n🏃 Recent function runs: ${runs.length}\n`);
    
    if (runs.length > 0) {
      runs.forEach(run => {
        const status = run.status === 'completed' ? '✅' : 
                      run.status === 'failed' ? '❌' : '⏳';
        console.log(`   ${status} ${run.function_id}`);
        console.log(`      Event: ${run.event_name}`);
        console.log(`      Status: ${run.status}`);
        if (run.error) {
          console.log(`      Error: ${run.error.message || run.error}`);
        }
        console.log(`      Started: ${new Date(run.created_at).toLocaleTimeString()}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error checking runs:', error.message);
  }
}

async function main() {
  console.log('🔍 Inngest Function Registration Debug\n');
  
  await checkFunctions();
  await checkRecentRuns();
  
  console.log('\n💡 Troubleshooting tips:');
  console.log('1. If no GraphQL functions are registered:');
  console.log('   - Check for module initialization errors in console');
  console.log('   - Verify GITHUB_TOKEN is set in .env');
  console.log('   - Try restarting npm start');
  console.log('\n2. If functions are registered but not running:');
  console.log('   - Check event names match exactly');
  console.log('   - Look for errors in function runs above');
  console.log('   - Check Netlify dev console for errors');
}

main().catch(console.error);