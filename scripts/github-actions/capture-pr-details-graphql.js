#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { program } from 'commander';
import { getGraphQLClient } from '../../src/lib/inngest/graphql-client.js';

// Initialize Supabase client
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Parse command line arguments
program
  .option('--repository-id <id>', 'Repository ID')
  .option('--repository-name <name>', 'Repository name (owner/name)')
  .option('--pr-numbers <numbers>', 'Comma-separated PR numbers')
  .option('--job-id <id>', 'Progressive capture job ID')
  .parse(process.argv);

const options = program.opts();

async function main() {
  console.log('🚀 Starting PR details capture...');
  console.log(`Repository: ${options.repositoryName}`);
  console.log(`PR Numbers: ${options.prNumbers}`);

  try {
    const [owner, repo] = options.repositoryName.split('/');
    const prNumbers = options.prNumbers.split(',').map((n) => parseInt(n.trim()));

    console.log(`📊 Capturing details for ${prNumbers.length} PRs`);

    const client = getGraphQLClient();
    let successCount = 0;
    let errorCount = 0;

    for (const prNumber of prNumbers) {
      try {
        console.log(`\n🔄 Processing PR #${prNumber}...`);

        // Fetch comprehensive PR data using GraphQL
        const prData = await client.getPullRequestDetails(owner, repo, prNumber);

        if (!prData) {
          console.error(`❌ No data returned for PR #${prNumber}`);
          errorCount++;
          continue;
        }

        // Store PR data
        await storePullRequestData(options.repositoryId, prData);

        successCount++;
        console.log(`✅ Successfully captured PR #${prNumber}`);

        // Log rate limit info
        const rateLimit = client.getRateLimit();
        if (rateLimit) {
          console.log(`📊 Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);

          // Pause if rate limit is low
          if (rateLimit.remaining < 100) {
            console.log('⚠️  Rate limit low, pausing for 30 seconds...');
            await new Promise((resolve) => setTimeout(resolve, 30000));
          }
        }
      } catch (error) {
        console.error(`❌ Error processing PR #${prNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ Capture complete!`);
    console.log(`   Success: ${successCount}/${prNumbers.length} PRs`);
    console.log(`   Errors: ${errorCount}`);

    if (errorCount > 0 && successCount === 0) {
      throw new Error('All PR captures failed');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

async function storePullRequestData(repositoryId, prData) {
  // Ensure author exists
  const authorId = await ensureContributorExists(prData.author);

  // Update pull request with full details
  const { error: prError } = await supabase.from('pull_requests').upsert(
    {
      repository_id: repositoryId,
      github_id: prData.databaseId.toString(),
      number: prData.number,
      title: prData.title,
      body: prData.body,
      state: prData.state.toLowerCase(),
      author_id: authorId,
      created_at: prData.createdAt,
      updated_at: prData.updatedAt,
      closed_at: prData.closedAt,
      merged_at: prData.mergedAt,
      merged: prData.merged,
      draft: prData.isDraft,
      additions: prData.additions,
      deletions: prData.deletions,
      changed_files: prData.changedFiles,
      commits: prData.commits.totalCount,
      base_branch: prData.baseRefName,
      head_branch: prData.headRefName,
      html_url: prData.url,
    },
    {
      onConflict: 'repository_id,number',
    }
  );

  if (prError) {
    throw new Error(`Failed to store PR: ${prError.message}`);
  }

  // Get the PR record to get its ID
  const { data: prRecord } = await supabase
    .from('pull_requests')
    .select('id')
    .eq('repository_id', repositoryId)
    .eq('number', prData.number)
    .single();

  if (!prRecord) {
    throw new Error('Failed to retrieve PR record after insert');
  }

  // Store reviews
  if (prData.reviews && prData.reviews.nodes) {
    for (const review of prData.reviews.nodes) {
      await storeReview(prRecord.id, review);
    }
  }

  // Store comments
  if (prData.comments && prData.comments.nodes) {
    for (const comment of prData.comments.nodes) {
      await storeComment(prRecord.id, comment, 'issue');
    }
  }

  // Store review comments (inline PR comments)
  if (prData.reviewComments && prData.reviewComments.nodes) {
    for (const comment of prData.reviewComments.nodes) {
      await storeComment(prRecord.id, comment, 'review');
    }
  }
}

async function ensureContributorExists(author) {
  if (!author?.login) {
    throw new Error('Author login is required');
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: author.databaseId?.toString() || author.id?.toString() || '0',
        username: author.login,
        avatar_url: author.avatarUrl || null,
        is_bot: author.__typename === 'Bot' || false,
      },
      {
        onConflict: 'username',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to ensure contributor exists: ${error.message}`);
  }

  return data.id;
}

async function storeReview(prId, review) {
  try {
    const authorId = await ensureContributorExists(review.author);

    await supabase.from('reviews').upsert(
      {
        pull_request_id: prId,
        github_id: review.databaseId?.toString() || review.id,
        author_id: authorId,
        state: review.state,
        body: review.body,
        submitted_at: review.submittedAt || review.createdAt,
        commit_id: review.commit?.oid,
      },
      {
        onConflict: 'github_id',
      }
    );
  } catch (error) {
    console.warn(`Failed to store review ${review.id}:`, error.message);
  }
}

async function storeComment(prId, comment, commentType) {
  try {
    const commenterId = await ensureContributorExists(comment.author);

    await supabase.from('comments').upsert(
      {
        pull_request_id: prId,
        github_id: comment.databaseId?.toString() || comment.id,
        commenter_id: commenterId,
        body: comment.body,
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        comment_type: commentType,
      },
      {
        onConflict: 'github_id',
      }
    );
  } catch (error) {
    console.warn(`Failed to store ${commentType} comment ${comment.id}:`, error.message);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
