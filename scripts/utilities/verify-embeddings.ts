#!/usr/bin/env npx tsx

import { supabase } from '../src/lib/supabase';

/**
 * Script to verify embedding dimensions after migration
 */

async function verifyEmbeddings() {
  console.log('🔍 Verifying embedding dimensions...\n');

  try {
    // Check a sample issue embedding
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id, title, embedding')
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (issueError || !issue) {
      console.log('❌ No issues with embeddings found');
    } else {
      const embeddingArray = Array.isArray(issue.embedding)
        ? issue.embedding
        : JSON.parse(issue.embedding);
      console.log(`✅ Issue embedding dimensions: ${embeddingArray.length}`);
      console.log(`   Sample issue: "${issue.title}"`);
      console.log(`   Expected: 384 dimensions`);
      console.log(`   Status: ${embeddingArray.length === 384 ? '✅ Correct' : '❌ Incorrect'}`);
    }

    // Check a sample PR embedding
    const { data: pr, error: prError } = await supabase
      .from('pull_requests')
      .select('id, title, embedding')
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (prError || !pr) {
      console.log('\n❌ No pull requests with embeddings found');
    } else {
      const embeddingArray = Array.isArray(pr.embedding) ? pr.embedding : JSON.parse(pr.embedding);
      console.log(`\n✅ PR embedding dimensions: ${embeddingArray.length}`);
      console.log(`   Sample PR: "${pr.title}"`);
      console.log(`   Expected: 384 dimensions`);
      console.log(`   Status: ${embeddingArray.length === 384 ? '✅ Correct' : '❌ Incorrect'}`);
    }

    // Get counts
    const { count: totalIssues } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true });

    const { count: issuesWithEmbeddings } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    const { count: totalPRs } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true });

    const { count: prsWithEmbeddings } = await supabase
      .from('pull_requests')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    console.log('\n📊 Embedding Coverage:');
    console.log(
      `   Issues: ${issuesWithEmbeddings || 0}/${totalIssues || 0} (${totalIssues ? Math.round(((issuesWithEmbeddings || 0) / totalIssues) * 100) : 0}%)`
    );
    console.log(
      `   PRs: ${prsWithEmbeddings || 0}/${totalPRs || 0} (${totalPRs ? Math.round(((prsWithEmbeddings || 0) / totalPRs) * 100) : 0}%)`
    );

    // Test vector search function
    console.log('\n🧪 Testing vector search functions...');

    if (issue && issue.embedding) {
      const { data: searchResults, error: searchError } = await supabase.rpc(
        'find_similar_issues',
        {
          query_embedding: issue.embedding,
          match_count: 3,
        }
      );

      if (searchError) {
        console.log('❌ Vector search function failed:', searchError.message);
      } else {
        console.log('✅ Vector search function works!');
        console.log(`   Found ${searchResults?.length || 0} similar issues`);
      }
    }
  } catch (error) {
    console.error('❌ Error during verification:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  verifyEmbeddings()
    .then(() => {
      console.log('\n✨ Verification complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}
