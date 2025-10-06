#!/usr/bin/env node
/**
 * Backfill AI summaries for GitHub Discussions
 * Generates LLM summaries for discussions that don't have them yet
 *
 * Usage:
 *   GITHUB_TOKEN=xxx node scripts/data-sync/backfill-discussion-summaries.mjs --repository-id=<uuid>
 *   GITHUB_TOKEN=xxx node scripts/data-sync/backfill-discussion-summaries.mjs --all
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('Error: VITE_SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const repositoryId = args.find((arg) => arg.startsWith('--repository-id='))?.split('=')[1];
const backfillAll = args.includes('--all');

if (!repositoryId && !backfillAll) {
  console.error('Error: Either --repository-id=<uuid> or --all flag is required');
  console.error('Usage:');
  console.error(
    '  node scripts/data-sync/backfill-discussion-summaries.mjs --repository-id=<uuid>'
  );
  console.error('  node scripts/data-sync/backfill-discussion-summaries.mjs --all');
  process.exit(1);
}

/**
 * Generate summary for a discussion using title fallback
 * In production, this would call the LLM service
 */
async function generateSummary(discussion) {
  // For now, use title as summary (placeholder until LLM integration)
  // In production: call llmService.generateDiscussionSummary()
  const summary =
    discussion.title.length > 150 ? discussion.title.substring(0, 147) + '...' : discussion.title;

  return summary;
}

/**
 * Backfill summaries for discussions
 */
async function backfillSummaries() {
  console.log('🔍 Finding discussions without summaries...\n');

  // Build query
  let query = supabase
    .from('discussions')
    .select('id, title, body, repository_id')
    .is('summary', null);

  if (repositoryId) {
    query = query.eq('repository_id', repositoryId);
  }

  const { data: discussions, error } = await query;

  if (error) {
    console.error('Error fetching discussions:', error);
    process.exit(1);
  }

  if (!discussions || discussions.length === 0) {
    console.log('✅ No discussions need summaries');
    return;
  }

  console.log(`Found ${discussions.length} discussions without summaries\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < discussions.length; i++) {
    const discussion = discussions[i];

    try {
      const summary = await generateSummary(discussion);

      const { error: updateError } = await supabase
        .from('discussions')
        .update({ summary })
        .eq('id', discussion.id);

      if (updateError) {
        console.error(`❌ Failed to update ${discussion.id}:`, updateError.message);
        failCount++;
      } else {
        successCount++;
        console.log(
          `✅ [${i + 1}/${discussions.length}] Generated summary for: ${discussion.title.substring(0, 60)}...`
        );
      }

      // Rate limiting: wait 100ms between requests
      if (i < discussions.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`❌ Error processing ${discussion.id}:`, error.message);
      failCount++;
    }
  }

  console.log(`\n✨ Summary:`);
  console.log(`  ✅ Success: ${successCount}`);
  if (failCount > 0) {
    console.log(`  ❌ Failed: ${failCount}`);
  }
  console.log(`\n🎉 Backfill complete!`);
}

// Run backfill
backfillSummaries().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
