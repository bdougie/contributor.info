import { PullRequestEvent, PullRequest, Repository } from '../types/github';
import { githubAppAuth } from '../lib/auth';
import { generatePRInsights, ContributorInsights } from '../services/insights';
import { formatPRComment, formatMinimalPRComment } from '../services/comments';
import { findSimilarIssues, SimilarIssue } from '../services/similarity';
import { suggestReviewers, ReviewerSuggestion } from '../services/reviewers';
import { supabase } from '../../src/lib/supabase';
import { 
  fetchContributorConfig, 
  isFeatureEnabled,
  isUserExcluded,
  generateCodeOwnersSuggestion
} from '../services/contributor-config';

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

    // Fetch configuration
    const config = await fetchContributorConfig(
      octokit,
      event.repository.owner.login,
      event.repository.name
    );

    // Check if PR author is excluded
    if (isUserExcluded(config, event.pull_request.user.login, 'author')) {
      console.log(`PR author ${event.pull_request.user.login} is excluded from comments`);
      return;
    }

    // Check if auto-comment is enabled
    if (!isFeatureEnabled(config, 'auto_comment')) {
      console.log('Auto-comment is disabled in .contributor config');
      return;
    }

    // Generate insights in parallel (only fetch what's enabled)
    const insightsPromises = [
      generatePRInsights(event.pull_request, event.repository),
    ];

    if (isFeatureEnabled(config, 'similar_issues')) {
      insightsPromises.push(findSimilarIssues(event.pull_request, event.repository));
    } else {
      insightsPromises.push(Promise.resolve([]));
    }

    if (isFeatureEnabled(config, 'reviewer_suggestions')) {
      insightsPromises.push(suggestReviewers(event.pull_request, event.repository, installationId));
    } else {
      insightsPromises.push(Promise.resolve({ suggestions: [], hasCodeOwners: false }));
    }

    const [contributorInsights, similarIssues, reviewerSuggestionsResult] = await Promise.all(insightsPromises);

    // Extract suggestions and hasCodeOwners flag
    const hasCodeOwners = reviewerSuggestionsResult?.hasCodeOwners || false;
    const reviewerSuggestions = reviewerSuggestionsResult?.suggestions || [];

    // Filter out excluded reviewers
    const filteredReviewers = reviewerSuggestions.filter(
      reviewer => !isUserExcluded(config, reviewer.login, 'reviewer')
    );

    // Format the comment based on style preference
    const comment = config.comment_style === 'minimal' 
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