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
        const result = await client.getPRDetails(owner, repo, prNumber);
        const prData = result?.pullRequest;

        if (!prData) {
          console.error(`❌ No data returned for PR #${prNumber}`);
          errorCount++;
          continue;
        }

        // Store PR data
        await storePullRequestData(options.repositoryId, options.repositoryName, prData);

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

async function storePullRequestData(repositoryId, repositoryFullName, prData) {
  // Ensure author exists
  const authorId = await ensureContributorExists(prData.author);

  // Update pull request with full details
  const { error: prError } = await supabase.from('pull_requests').upsert(
    {
      repository_id: repositoryId,
      repository_full_name: repositoryFullName,
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

  // Store reviews and the inline comments nested under each review
  for (const review of prData.reviews?.nodes ?? []) {
    await storeReview(repositoryId, prRecord.id, review);
    for (const comment of review.comments?.nodes ?? []) {
      await storeComment(repositoryId, prRecord.id, comment, 'review_comment');
    }
  }

  // Store general PR conversation comments
  for (const comment of prData.comments?.nodes ?? []) {
    await storeComment(repositoryId, prRecord.id, comment, 'issue_comment');
  }
}

/**
 * Returns the contributors.id for a GraphQL author, or null when GitHub gave
 * no numeric id (bots and deleted users). Conflicts on github_id, the same
 * key the Inngest capture job uses, so bots never collide with each other.
 */
async function ensureContributorExists(author) {
  if (!author?.login || !author?.databaseId) {
    return null;
  }

  const { data, error } = await supabase
    .from('contributors')
    .upsert(
      {
        github_id: author.databaseId,
        username: author.login,
        avatar_url: author.avatarUrl || null,
        is_bot: author.__typename === 'Bot' || author.login.endsWith('[bot]'),
      },
      {
        onConflict: 'github_id',
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

const REVIEW_STATES = new Set([
  'PENDING',
  'APPROVED',
  'CHANGES_REQUESTED',
  'COMMENTED',
  'DISMISSED',
]);

function normalizeReviewState(state) {
  const normalized = String(state || '').toUpperCase();
  return REVIEW_STATES.has(normalized) ? normalized : 'COMMENTED';
}

async function storeReview(repositoryId, prId, review) {
  const authorId = await ensureContributorExists(review.author);
  if (!authorId || !review.databaseId) {
    console.warn(
      `Skipping review on PR ${prId}: no author id (${review.author?.login ?? 'unknown'})`
    );
    return;
  }

  const { error } = await supabase.from('reviews').upsert(
    {
      repository_id: repositoryId,
      pull_request_id: prId,
      github_id: review.databaseId,
      author_id: authorId,
      reviewer_id: authorId,
      state: normalizeReviewState(review.state),
      body: review.body || '',
      submitted_at: review.submittedAt,
      commit_id: review.commit?.oid,
    },
    {
      onConflict: 'github_id',
    }
  );

  if (error) {
    console.warn(`Failed to store review ${review.databaseId}: ${error.message}`);
  }
}

/**
 * comments.in_reply_to_id is a UUID foreign key to comments.id, so a GitHub
 * reply id has to be resolved to the stored parent row. Returns null when the
 * parent has not been captured, which keeps the insert valid.
 */
async function resolveParentCommentId(parentGithubId) {
  if (!parentGithubId) return null;
  const { data } = await supabase
    .from('comments')
    .select('id')
    .eq('github_id', parentGithubId)
    .maybeSingle();
  return data?.id ?? null;
}

async function storeComment(repositoryId, prId, comment, commentType) {
  const commenterId = await ensureContributorExists(comment.author);
  if (!commenterId || !comment.databaseId) {
    console.warn(
      `Skipping ${commentType} on PR ${prId}: no author id (${comment.author?.login ?? 'unknown'})`
    );
    return;
  }

  const row = {
    repository_id: repositoryId,
    pull_request_id: prId,
    github_id: comment.databaseId,
    commenter_id: commenterId,
    body: comment.body || '',
    created_at: comment.createdAt,
    updated_at: comment.updatedAt,
    comment_type: commentType,
  };

  if (commentType === 'review_comment') {
    Object.assign(row, {
      path: comment.path,
      position: comment.position,
      original_position: comment.originalPosition ?? null,
      diff_hunk: comment.diffHunk,
      commit_id: comment.commit?.oid,
      original_commit_id: comment.originalCommit?.oid,
      in_reply_to_id: await resolveParentCommentId(comment.replyTo?.databaseId),
    });
  }

  const { error } = await supabase.from('comments').upsert(row, { onConflict: 'github_id' });

  if (error) {
    console.warn(`Failed to store ${commentType} ${comment.databaseId}: ${error.message}`);
  }
}

// Run the script
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
