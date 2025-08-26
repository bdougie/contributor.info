#!/usr/bin/env node

/**
 * Test script to verify GitHub API is returning PR statistics correctly
 */

async function testGitHubAPIStats() {
  console.log('🔍 Testing GitHub API PR statistics...\n');
  
  const GITHUB_TOKEN = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  
  if (!GITHUB_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN not found in environment variables');
    process.exit(1);
  }
  
  // Test with a known repository
  const owner = 'vercel';
  const repo = 'ai';
  
  try {
    // First, get list of PRs
    console.log(`📊 Fetching PRs from ${owner}/${repo}...\n`);
    
    const listResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=5`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    );
    
    if (!listResponse.ok) {
      throw new Error(`GitHub API error: ${listResponse.status}`);
    }
    
    const prs = await listResponse.json();
    
    console.log(`✅ Found ${prs.length} PRs\n`);
    console.log('📋 Checking PR Details for Statistics:\n');
    console.log('─'.repeat(80));
    
    // Check each PR's details
    for (const pr of prs.slice(0, 3)) {
      const detailResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`,
        {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (!detailResponse.ok) {
        console.error(`❌ Failed to fetch details for PR #${pr.number}`);
        continue;
      }
      
      const details = await detailResponse.json();
      
      console.log(`PR #${pr.number}: ${pr.title.substring(0, 50)}...`);
      console.log(`  Author: ${pr.user.login}`);
      console.log(`  State: ${pr.state}`);
      console.log(`  📈 Statistics from API:`);
      console.log(`     additions: ${details.additions ?? 'NOT IN RESPONSE'}`);
      console.log(`     deletions: ${details.deletions ?? 'NOT IN RESPONSE'}`);
      console.log(`     changed_files: ${details.changed_files ?? 'NOT IN RESPONSE'}`);
      
      if (details.additions !== undefined && details.deletions !== undefined && details.changed_files !== undefined) {
        console.log(`  ✅ All statistics fields present in API response`);
      } else {
        console.log(`  ⚠️  Some statistics fields missing from API response`);
      }
      
      console.log('─'.repeat(80));
    }
    
    console.log('\n✅ GitHub API test complete!');
    console.log('Note: If statistics are present in API but showing as 0 in the app,');
    console.log('the issue is in the data capture/storage layer.');
    
  } catch (error) {
    console.error('❌ Error testing GitHub API:', error);
    process.exit(1);
  }
}

// Run the test
testGitHubAPIStats().catch(console.error);