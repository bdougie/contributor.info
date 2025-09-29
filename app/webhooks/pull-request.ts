import { PullRequestEvent, PullRequest, Repository } from '../types/github';
import { githubAppAuth } from '../lib/auth';
import { generatePRInsights, ContributorInsights } from '../services/insights';
import { formatPRComment, formatMinimalPRComment } from '../services/comments';
import { findSimilarIssues, SimilarIssue } from '../services/similarity';
import { suggestReviewers, ReviewerSuggestion } from '../services/reviewers';
import { supabase } from '../../src/lib/supabase';
import { ensureContributorForWebhook } from '../lib/webhook-contributor-utils';
import {
  fetchContributorConfig,
  isFeatureEnabled,
  isUserExcluded,
  generateCodeOwnersSuggestion,
} from '../services/contributor-config';

/**
 * Handle pull request webhook events
 */
export async function handlePullRequestEvent(event: PullRequestEvent) {
  // Only process opened and ready_for_review events
  if (!['opened', 'ready_for_review'].includes(event.action)) {
    return;
  }

  // Skip if PR is still a draft (for opened events)
  if (event.action === 'opened' && event.pull_request.draft) {
    return;
  }

  // Handle opened events with simple similarity comments
  if (event.action === 'opened') {
    return handlePROpened(event);
  }

  try {
    console.log('Processing PR #%s in ${event.repository.full_name}', event.pull_request.number);

    // Ensure contributor record early so subsequent operations have author UUID
    const authorId = await ensureContributorForWebhook(event.pull_request.user);
    if (!authorId) {
      console.error('Failed to ensure contributor for PR author');
      return;
    }

    // Check if we should comment on this PR
    const shouldComment = await checkIfShouldComment(event);
    if (!shouldComment) {
      console.log('Skipping PR comment based on settings');
      return;
    }

    // Get installation token
    const installationId = event.installation?.id;
    if (!installationId) {
      console.error('No installation ID found');
      return;
    }

    const octokit = await githubAppAuth.getInstallationOctokit(installationId);

    // Fetch configuration
    const config = await fetchContributorConfig(
      octokit,
      event.repository.owner.login,
      event.repository.name
    );

    // Check if PR author is excluded
    if (isUserExcluded(config, event.pull_request.user.login, 'author')) {
      console.log('PR author %s is excluded from comments', event.pull_request.user.login);
      return;
    }

    // Check if auto-comment is enabled
    if (!isFeatureEnabled(config, 'auto_comment')) {
      console.log('Auto-comment is disabled in .contributor config');
      return;
    }

    // Generate insights in parallel
    const [contributorInsights, similarIssues, reviewerSuggestionsResult] = await Promise.all([
      generatePRInsights(event.pull_request, event.repository),
      isFeatureEnabled(config, 'similar_issues')
        ? findSimilarIssues(event.pull_request, event.repository)
        : Promise.resolve([] as SimilarIssue[]),
      isFeatureEnabled(config, 'reviewer_suggestions')
        ? suggestReviewers(event.pull_request, event.repository, installationId)
        : Promise.resolve({ suggestions: [], hasCodeOwners: false })
    ]);

    // Extract suggestions and hasCodeOwners flag
    const hasCodeOwners = reviewerSuggestionsResult?.hasCodeOwners || false;
    const reviewerSuggestions = reviewerSuggestionsResult?.suggestions || [];

    // Filter out excluded reviewers
    const filteredReviewers = reviewerSuggestions.filter(
      (reviewer: ReviewerSuggestion) => !isUserExcluded(config, reviewer.login, 'reviewer')
    );

    // Format the comment based on style preference
    const comment =
      config.comment_style === 'minimal'
        ? formatMinimalPRComment({
            pullRequest: event.pull_request,
            repository: event.repository,
            contributorInsights,
            similarIssues,
            reviewerSuggestions: filteredReviewers,
            hasCodeOwners,
            config,
          })
        : formatPRComment({
            pullRequest: event.pull_request,
            repository: event.repository,
            contributorInsights,
            similarIssues,
            reviewerSuggestions: filteredReviewers,
            hasCodeOwners,
            config,
          });

    // Post the comment
    const { data: postedComment } = await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body: comment,
    });

    console.log('Posted comment %s on PR #${event.pull_request.number}', postedComment.id);

    // Store insights in database
    await storePRInsights({
      pullRequest: event.pull_request,
      repository: event.repository,
      contributorInsights,
      similarIssues,
      reviewerSuggestions,
      commentId: postedComment.id,
    });
  } catch (error) {
    console.error('Error handling pull request event:', error);
    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Handle PR opened events with simple similarity comments
 */
async function handlePROpened(event: PullRequestEvent) {
  try {
    console.log(
      'Processing opened PR #%s in ${event.repository.full_name}',
      event.pull_request.number
    );

    // Check if we should comment on this PR
    const shouldComment = await checkIfShouldComment(event);
    if (!shouldComment) {
      console.log('Skipping PR comment based on settings');
      return;
    }

    // Get installation token
    const installationId = event.installation?.id;
    if (!installationId) {
      console.error('No installation ID found');
      return;
    }

    const octokit = await githubAppAuth.getInstallationOctokit(installationId);

    // Fetch configuration
    const config = await fetchContributorConfig(
      octokit,
      event.repository.owner.login,
      event.repository.name
    );

    // Check if PR author is excluded
    if (isUserExcluded(config, event.pull_request.user.login, 'author')) {
      console.log('PR author %s is excluded from comments', event.pull_request.user.login);
      return;
    }

    // Check if auto-comment is enabled
    if (!isFeatureEnabled(config, 'auto_comment')) {
      console.log('Auto-comment is disabled in .contributor config');
      return;
    }

    // Check if similar_issues feature is enabled
    if (!isFeatureEnabled(config, 'similar_issues')) {
      console.log('Similar issues feature is disabled in .contributor config');
      return;
    }

    // Find similar issues using existing similarity service
    const similarIssues = await findSimilarIssues(event.pull_request, event.repository);

    // Only comment if we found similar issues
    if (similarIssues.length === 0) {
      console.log('No similar issues found for PR');
      return;
    }

    // Format simple similarity comment
    const comment = formatSimplePRSimilarityComment(similarIssues, event.pull_request);

    // Post the comment
    const { data: postedComment } = await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body: comment,
    });

    console.log(
      'Posted similarity comment %s on PR #${event.pull_request.number}',
      postedComment.id
    );

    // Store basic tracking info (lightweight compared to full insights)
    await storePRSimilarityComment({
      pullRequest: event.pull_request,
      repository: event.repository,
      similarIssues,
      commentId: postedComment.id,
    });
  } catch (error) {
    console.error('Error handling PR opened event:', error);
    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Check if we should comment on this PR based on settings
 */
async function checkIfShouldComment(event: PullRequestEvent): Promise<boolean> {
  // Check installation settings
  const { data: settings } = await supabase
    .from('github_app_installation_settings')
    .select('*')
    .eq('installation_id', event.installation?.id)
    .maybeSingle();

  if (settings) {
    // Check if commenting is enabled
    if (!settings.comment_on_prs) {
      return false;
    }

    // Check if this repo is excluded
    if (settings.excluded_repos?.includes(event.repository.full_name)) {
      return false;
    }

    // Check if PR author is excluded
    if (settings.excluded_users?.includes(event.pull_request.user.login)) {
      return false;
    }
  }

  // Check if we've already commented on this PR
  const { data: existingComment } = await supabase
    .from('pr_insights')
    .select('id')
    .eq('github_pr_id', event.pull_request.id)
    .eq('comment_posted', true)
    .maybeSingle();

  if (existingComment) {
    return false;
  }

  return true;
}

/**
 * Store PR insights in the database
 */
interface StorePRInsightsData {
  pullRequest: PullRequest;
  repository: Repository;
  contributorInsights: ContributorInsights;
  similarIssues: SimilarIssue[];
  reviewerSuggestions: ReviewerSuggestion[];
  commentId: number;
}

async function storePRInsights(data: StorePRInsightsData) {
  try {
    // First, ensure the repository exists in our database
    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', data.repository.id)
      .maybeSingle();

    if (!repo) {
      // Repository not tracked yet, skip storing insights
      return;
    }

    // Ensure contributor for this PR (again in case storePRInsights used independently)
    const contributorId = await ensureContributorForWebhook(data.pullRequest.user);
    if (!contributorId) {
      console.error('Unable to store insights: contributor not ensured');
      return;
    }

    // Store the PR with author_id
    const { data: pr } = await supabase
      .from('pull_requests')
      .upsert(
        {
          github_id: data.pullRequest.id,
          repository_id: repo.id,
          number: data.pullRequest.number,
          title: data.pullRequest.title,
          state: data.pullRequest.state,
          author_id: contributorId,
          created_at: data.pullRequest.created_at,
          updated_at: data.pullRequest.updated_at,
        },
        { onConflict: 'github_id' }
      )
      .select('id')
      .maybeSingle();

    if (!pr) return;

    // Store the insights
    await supabase.from('pr_insights').upsert({
      pull_request_id: pr.id,
      github_pr_id: data.pullRequest.id,
      contributor_stats: data.contributorInsights,
      suggested_reviewers: data.reviewerSuggestions,
      similar_issues: data.similarIssues,
      comment_posted: true,
      comment_id: data.commentId,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error storing PR insights:', error);
  }
}

/**
 * Format simple similarity comment for PR opened events
 */
function formatSimplePRSimilarityComment(
  similarIssues: SimilarIssue[],
  pullRequest: PullRequest
): string {
  let comment = '## 🔗 Related Issues\n\n';
  comment += 'I found the following issues that may be related to this PR:\n\n';

  for (const similar of similarIssues) {
    const stateEmoji = similar.issue.state === 'open' ? '🟢' : '🔴';
    const relationshipEmoji =
      similar.relationship === 'fixes'
        ? '🔧'
        : similar.relationship === 'implements'
          ? '⚡'
          : similar.relationship === 'relates_to'
            ? '🔗'
            : '💭';

    comment += `- ${stateEmoji} ${relationshipEmoji} [#${similar.issue.number} - ${similar.issue.title}](${similar.issue.html_url}) `;

    if (similar.reasons.length > 0) {
      comment += `(${similar.reasons.join(', ')})\n`;
    } else {
      comment += `(${Math.round(similar.similarityScore * 100)}% similar)\n`;
    }
  }

  comment += '\n';
  comment += '_This helps connect related work and avoid duplicate efforts. ';
  comment += 'Powered by [contributor.info](https://contributor.info)_ 🤖';

  return comment;
}

/**
 * Store basic PR similarity comment tracking
 */
interface StorePRSimilarityData {
  pullRequest: PullRequest;
  repository: Repository;
  similarIssues: SimilarIssue[];
  commentId: number;
}

async function storePRSimilarityComment(data: StorePRSimilarityData) {
  try {
    // First, ensure the repository exists in our database
    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', data.repository.id)
      .maybeSingle();

    if (!repo) {
      // Repository not tracked yet, skip storing
      return;
    }

    const contributorId = await ensureContributorForWebhook(data.pullRequest.user);
    if (!contributorId) {
      console.error('Unable to store similarity comment: contributor not ensured');
      return;
    }

    // Store the PR with author_id if it doesn't exist
    const { data: pr } = await supabase
      .from('pull_requests')
      .upsert(
        {
          github_id: data.pullRequest.id,
          repository_id: repo.id,
          number: data.pullRequest.number,
          title: data.pullRequest.title,
          state: data.pullRequest.state,
          author_id: contributorId,
          created_at: data.pullRequest.created_at,
          updated_at: data.pullRequest.updated_at,
        },
        { onConflict: 'github_id' }
      )
      .select('id')
      .maybeSingle();

    if (!pr) return;

    // Store basic similarity tracking (lighter than full insights)
    await supabase.from('pr_insights').upsert({
      pull_request_id: pr.id,
      github_pr_id: data.pullRequest.id,
      similar_issues: data.similarIssues,
      comment_posted: false,
      comment_id: data.commentId,
      generated_at: new Date().toISOString(),
      comment_type: 'similarity', // Mark as similarity-only comment
    });
  } catch (error) {
    console.error('Error storing PR similarity comment:', error);
  }
}
// (Phase 2) Local helper removed in favor of shared utility import.
