import { PullRequestEvent } from '../types/github';
import { githubAppAuth } from '../lib/auth';
import { generatePRInsights } from '../services/insights';
import { formatPRComment } from '../services/comments';
import { findSimilarIssues } from '../services/similarity';
import { suggestReviewers } from '../services/reviewers';
import { supabase } from '../../src/lib/supabase';

/**
 * Handle pull request webhook events
 */
export async function handlePullRequestEvent(event: PullRequestEvent) {
  // Only process opened or ready_for_review events
  if (event.action !== 'opened' && event.action !== 'ready_for_review') {
    return;
  }

  // Skip draft PRs unless they're marked ready
  if (event.pull_request.draft && event.action !== 'ready_for_review') {
    return;
  }

  try {
    console.log(`Processing PR #${event.pull_request.number} in ${event.repository.full_name}`);

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

    // Generate insights in parallel
    const [contributorInsights, similarIssues, reviewerSuggestions] = await Promise.all([
      generatePRInsights(event.pull_request, event.repository),
      findSimilarIssues(event.pull_request, event.repository),
      suggestReviewers(event.pull_request, event.repository),
    ]);

    // Format the comment
    const comment = formatPRComment({
      pullRequest: event.pull_request,
      repository: event.repository,
      contributorInsights,
      similarIssues,
      reviewerSuggestions,
    });

    // Post the comment
    const { data: postedComment } = await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body: comment,
    });

    console.log(`Posted comment ${postedComment.id} on PR #${event.pull_request.number}`);

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
 * Check if we should comment on this PR based on settings
 */
async function checkIfShouldComment(event: PullRequestEvent): Promise<boolean> {
  // Check installation settings
  const { data: settings } = await supabase
    .from('github_app_installation_settings')
    .select('*')
    .eq('installation_id', event.installation?.id)
    .single();

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
    .single();

  if (existingComment) {
    return false;
  }

  return true;
}

/**
 * Store PR insights in the database
 */
async function storePRInsights(data: {
  pullRequest: any;
  repository: any;
  contributorInsights: any;
  similarIssues: any[];
  reviewerSuggestions: any[];
  commentId: number;
}) {
  try {
    // First, ensure the repository exists in our database
    const { data: repo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', data.repository.id)
      .single();

    if (!repo) {
      // Repository not tracked yet, skip storing insights
      return;
    }

    // Store the PR if it doesn't exist
    const { data: pr } = await supabase
      .from('pull_requests')
      .upsert({
        github_id: data.pullRequest.id,
        repository_id: repo.id,
        number: data.pullRequest.number,
        title: data.pullRequest.title,
        state: data.pullRequest.state,
        created_at: data.pullRequest.created_at,
        updated_at: data.pullRequest.updated_at,
      })
      .select('id')
      .single();

    if (!pr) return;

    // Store the insights
    await supabase
      .from('pr_insights')
      .upsert({
        pull_request_id: pr.id,
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