#!/usr/bin/env tsx

/**
 * Script to classify all unclassified tracked repositories
 * Run with: npx tsx scripts/classify-repositories.ts
 */

import { RepositorySizeClassifier } from '../src/lib/repository-size-classifier';

async function main() {
  console.log('🔍 Starting repository classification...');
  
  // Get GitHub token from environment
  const githubToken = process.env.VITE_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  
  if (!githubToken) {
    console.error('❌ Error: GITHUB_TOKEN or VITE_GITHUB_TOKEN environment variable is required');
    process.exit(1);
  }
  
  try {
    // Initialize classifier
    const classifier = new RepositorySizeClassifier(githubToken);
    
    // Get unclassified repositories
    console.log('📊 Fetching unclassified repositories...');
    const unclassifiedRepos = await classifier.getUnclassifiedRepositories();
    
    if (unclassifiedRepos.length === 0) {
      console.log('✅ All repositories are already classified!');
      return;
    }
    
    console.log(`📋 Found ${unclassifiedRepos.length} repositories to classify:`);
    unclassifiedRepos.forEach(repo => {
      console.log(`   - ${repo.owner}/${repo.name}`);
    });
    
    // Classify in batches to avoid overwhelming the GitHub API
    const batchSize = 5; // Process 5 repositories at a time
    const batches = [];
    
    for (let i = 0; i < unclassifiedRepos.length; i += batchSize) {
      batches.push(unclassifiedRepos.slice(i, i + batchSize));
    }
    
    console.log(`\n🚀 Processing ${batches.length} batches of up to ${batchSize} repositories each...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n📦 Processing batch ${i + 1}/${batches.length}:`);
      
      batch.forEach(repo => {
        console.log(`   ⏳ ${repo.owner}/${repo.name}`);
      });
      
      try {
        await classifier.classifyBatch(batch);
        console.log(`   ✅ Batch ${i + 1} completed successfully`);
      } catch (error) {
        console.error(`   ❌ Batch ${i + 1} failed:`, error);
      }
      
      // Add a delay between batches to respect rate limits
      if (i < batches.length - 1) {
        console.log('   ⏸️  Waiting 5 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log('\n🎉 Repository classification complete!');
    
    // Get final stats
    const remainingUnclassified = await classifier.getUnclassifiedRepositories();
    const classified = unclassifiedRepos.length - remainingUnclassified.length;
    
    console.log(`\n📊 Final Results:`);
    console.log(`   ✅ Successfully classified: ${classified}`);
    console.log(`   ❌ Failed to classify: ${remainingUnclassified.length}`);
    
    if (remainingUnclassified.length > 0) {
      console.log(`\n❌ Failed repositories:`);
      remainingUnclassified.forEach(repo => {
        console.log(`   - ${repo.owner}/${repo.name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error during classification:', error);
    process.exit(1);
  }
}

main().catch(console.error);