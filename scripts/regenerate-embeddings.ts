#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase';
import { generateAndStoreEmbeddings, getItemsNeedingEmbeddings } from '../app/services/embeddings';

/**
 * Script to regenerate all embeddings after migrating from OpenAI to MiniLM embeddings
 * This should be run after applying the 20250802000001_update_to_minilm_embeddings.sql migration
 */

async function regenerateEmbeddings() {
  console.log('🚀 Starting embedding regeneration process...');
  console.log('This will regenerate embeddings for all issues and pull requests using MiniLM-L6-v2');
  
  try {
    // Get counts of items needing embeddings
    const { data: issueCount } = await supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    
    const { data: prCount } = await supabase
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    
    console.log(`\n📊 Items needing embeddings:`);
    console.log(`   - Issues: ${issueCount || 0}`);
    console.log(`   - Pull Requests: ${prCount || 0}`);
    
    if (!issueCount && !prCount) {
      console.log('\n✅ All items already have embeddings!');
      return;
    }
    
    // Process in batches to avoid overwhelming the system
    const BATCH_SIZE = 100;
    let processedIssues = 0;
    let processedPRs = 0;
    let hasMore = true;
    
    console.log(`\n🔄 Processing in batches of ${BATCH_SIZE}...`);
    
    while (hasMore) {
      // Get items needing embeddings
      const items = await getItemsNeedingEmbeddings(BATCH_SIZE);
      
      if (items.length === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`\n📦 Processing batch of ${items.length} items...`);
      
      // Generate and store embeddings
      await generateAndStoreEmbeddings(items);
      
      // Count processed items
      items.forEach(item => {
        if (item.type === 'issue') processedIssues++;
        else if (item.type === 'pull_request') processedPRs++;
      });
      
      console.log(`   ✓ Processed ${processedIssues} issues, ${processedPRs} pull requests so far`);
      
      // Add a small delay between batches to avoid rate limiting
      if (hasMore && items.length === BATCH_SIZE) {
        console.log('   ⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n🎉 Embedding regeneration complete!');
    console.log(`   Total processed: ${processedIssues} issues, ${processedPRs} pull requests`);
    
    // Verify all items have embeddings
    const { data: remainingIssues } = await supabase
      .from('issues')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    
    const { data: remainingPRs } = await supabase
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .is('embedding', null);
    
    if (remainingIssues || remainingPRs) {
      console.log(`\n⚠️  Warning: Some items still missing embeddings:`);
      console.log(`   - Issues: ${remainingIssues || 0}`);
      console.log(`   - Pull Requests: ${remainingPRs || 0}`);
      console.log('   You may need to run this script again.');
    } else {
      console.log('\n✅ All items now have embeddings!');
    }
    
  } catch (error) {
    console.error('\n❌ Error during embedding regeneration:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  regenerateEmbeddings()
    .then(() => {
      console.log('\n✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { regenerateEmbeddings };