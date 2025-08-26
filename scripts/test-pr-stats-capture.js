#!/usr/bin/env node

/**
 * Test script to verify that PR statistics (additions, deletions, changed_files) 
 * are being captured correctly from the GitHub API
 */

import { fetchPullRequests } from '../src/lib/github.ts';

async function testPRStatsCapture() {
  console.log('🔍 Testing PR statistics capture from GitHub API...\n');
  
  // Test with a known repository that has recent PRs
  const testRepo = {
    owner: 'vercel',
    repo: 'ai',
    maxPRs: 5
  };
  
  try {
    console.log(`📊 Fetching PRs from ${testRepo.owner}/${testRepo.repo}...\n`);
    
    const prs = await fetchPullRequests(
      testRepo.owner, 
      testRepo.repo,
      '30' // 30 days
    );
    
    // Take first few PRs for testing
    const testPRs = prs.slice(0, testRepo.maxPRs);
    
    console.log(`✅ Successfully fetched ${prs.length} PRs\n`);
    console.log('📋 PR Statistics Summary:\n');
    console.log('─'.repeat(80));
    
    let allFieldsPresent = true;
    
    testPRs.forEach((pr, index) => {
      console.log(`PR #${pr.number}: ${pr.title.substring(0, 50)}...`);
      console.log(`  Author: ${pr.user.login}`);
      console.log(`  State: ${pr.state}`);
      console.log(`  Created: ${new Date(pr.created_at).toLocaleDateString()}`);
      console.log(`  📈 Statistics:`);
      console.log(`     Additions: ${pr.additions ?? 'MISSING'}`);
      console.log(`     Deletions: ${pr.deletions ?? 'MISSING'}`);
      console.log(`     Changed Files: ${pr.changed_files ?? 'MISSING'}`);
      
      // Check if any fields are missing
      if (pr.additions === undefined || pr.deletions === undefined || pr.changed_files === undefined) {
        console.log(`  ⚠️  WARNING: Missing statistics fields!`);
        allFieldsPresent = false;
      }
      
      // Calculate total lines changed
      const totalLines = (pr.additions || 0) + (pr.deletions || 0);
      console.log(`     Total Lines Changed: ${totalLines}`);
      
      console.log('─'.repeat(80));
    });
    
    // Summary
    console.log('\n📊 Overall Statistics:');
    const statsPresent = testPRs.filter(pr => 
      pr.additions !== undefined && 
      pr.deletions !== undefined && 
      pr.changed_files !== undefined
    );
    
    console.log(`  PRs with complete stats: ${statsPresent.length}/${testPRs.length}`);
    
    if (allFieldsPresent) {
      console.log('\n✅ SUCCESS: All PR statistics fields are being captured correctly!');
    } else {
      console.log('\n❌ ISSUE: Some PR statistics fields are missing from the API response.');
      console.log('   Please check the fetchPullRequests function in src/lib/github.ts');
    }
    
    // Test with actual values
    const prWithStats = testPRs.find(pr => 
      (pr.additions || 0) > 0 || 
      (pr.deletions || 0) > 0 || 
      (pr.changed_files || 0) > 0
    );
    
    if (prWithStats) {
      console.log(`\n✅ Found PR with actual statistics:`);
      console.log(`   PR #${prWithStats.number}: +${prWithStats.additions} -${prWithStats.deletions} in ${prWithStats.changed_files} files`);
    } else {
      console.log(`\n⚠️  WARNING: All tested PRs show 0 for all statistics.`);
      console.log(`   This might indicate a data capture issue.`);
    }
    
  } catch (error) {
    console.error('❌ Error testing PR statistics capture:', error);
    process.exit(1);
  }
}

// Run the test
testPRStatsCapture().catch(console.error);