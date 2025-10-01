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
  generateCodeOwnersSuggestion,
} from '../services/contributor-config';
import { handlePRCheckRuns } from './pr-check-runs';
import { webhookDataService } from '../services/webhook/data-service';
import { webhookSimilarityService } from '../services/webhook/similarity-updater';
import { eventRouter } from './event-router';
import { webhookMetricsService } from '../services/webhook-metrics';
import { similarityMetricsService } from '../services/similarity-metrics';

/**
 * Handle pull request webhook events with routing and prioritization
 */
export async function handlePullRequestEvent(event: PullRequestEvent) {
  // Handle opened, edited, synchronize events
  if (!['opened', 'ready_for_review', 'edited', 'synchronize'].includes(event.action)) {
    return;
  }

  // Route event through EventRouter for prioritization and debouncing
  await eventRouter.routeEvent(event);

  // Skip if PR is still a draft (for opened events)
  if (event.action === 'opened' && event.pull_request.draft) {
    return;
  }

  // Handle opened events with simple similarity comments + Check Runs
  if (event.action === 'opened') {
    // Run Check Runs and comments in parallel (dual feedback system)
    await Promise.all([handlePROpened(event), handlePRCheckRuns(event)]);
    return;
  }

  // Handle edited/synchronize events with real-time similarity updates
  if (event.action === 'edited' || event.action === 'synchronize') {
    await handlePRSimilarityUpdate(event);
    return;
  }

  try {
    console.log('Processing PR #%s in ${event.repository.full_name}', event.pull_request.number);

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

    // Generate insights in parallel (only fetch what's enabled)
    const insightsPromises = [generatePRInsights(event.pull_request, event.repository)];

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

    const [contributorInsights, similarIssues, reviewerSuggestionsResult] =
      await Promise.all(insightsPromises);

    // Extract suggestions and hasCodeOwners flag
    const hasCodeOwners = reviewerSuggestionsResult?.hasCodeOwners || false;
    const reviewerSuggestions = reviewerSuggestionsResult?.suggestions || [];

    // Filter out excluded reviewers
    const filteredReviewers = reviewerSuggestions.filter(
      (reviewer) => !isUserExcluded(config, reviewer.login, 'reviewer')
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

    // Post the comment and run Check Runs in parallel (dual feedback system)
    const [commentResult] = await Promise.allSettled([
      octokit.issues.createComment({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        issue_number: event.pull_request.number,
        body: comment,
      }),
      handlePRCheckRuns(event),
    ]);

    if (commentResult.status === 'fulfilled') {
      const postedComment = commentResult.value.data;
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
    } else {
      console.error('Failed to post comment: %o', commentResult.reason);
    }
  } catch (error) {
    console.error('Error handling pull request event:', error);
    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Handle PR opened events with simple similarity comments
 */
async function handlePROpened(event: PullRequestEvent) {
  const startTime = Date.now();

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
    const searchStartTime = Date.now();
    const similarIssues = await findSimilarIssues(event.pull_request, event.repository);
    const searchTimeMs = Date.now() - searchStartTime;

    // Track similarity search metrics
    await similarityMetricsService.trackPrediction({
      prId: event.pull_request.id,
      prNumber: event.pull_request.number,
      repositoryId: event.repository.id,
      predictedIssues: similarIssues,
      predictedAt: new Date().toISOString(),
      confidence: similarIssues[0]?.similarityScore || 0,
    });

    // Only comment if we found similar issues
    if (similarIssues.length === 0) {
      console.log('No similar issues found for PR');

      // Track webhook completion (no results)
      await webhookMetricsService.trackWebhookProcessing({
        eventType: 'pull_request',
        action: 'opened',
        priority: 'high',
        processingTimeMs: Date.now() - startTime,
        repositoryId: event.repository.id,
        installationId,
        cached: false,
      });

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

    // Trigger real-time similarity updates for repository
    const repoId = await webhookDataService.ensureRepository(event.repository);
    if (repoId) {
      await webhookSimilarityService.handlePREvent('opened', event.pull_request, event.repository);
    }

    // Track successful webhook processing
    await webhookMetricsService.trackWebhookProcessing({
      eventType: 'pull_request',
      action: 'opened',
      priority: 'high',
      processingTimeMs: Date.now() - startTime,
      repositoryId: event.repository.id,
      installationId,
      cached: false,
    });
  } catch (error) {
    console.error('Error handling PR opened event:', error);

    // Track error
    await webhookMetricsService.trackWebhookProcessing({
      eventType: 'pull_request',
      action: 'opened',
      priority: 'high',
      processingTimeMs: Date.now() - startTime,
      repositoryId: event.repository.id,
      installationId: event.installation?.id,
      cached: false,
      error: error instanceof Error ? error.message : String(error),
    });

    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Handle PR edited/synchronize events with real-time similarity updates
 */
async function handlePRSimilarityUpdate(event: PullRequestEvent) {
  const startTime = Date.now();

  try {
    console.log(
      'Processing PR %s event #%s in ${event.repository.full_name}',
      event.action,
      event.pull_request.number
    );

    // Store/update PR data
    const repoId = await webhookDataService.ensureRepository(event.repository);
    if (!repoId) {
      console.log('Repository not tracked, skipping similarity update');
      return;
    }

    // Update PR in database
    await webhookDataService.storePR(event.pull_request, repoId);

    // Trigger real-time similarity recalculation
    const updateStartTime = Date.now();
    const updatedSimilarities = await webhookSimilarityService.handlePREvent(
      event.action as 'edited' | 'synchronize',
      event.pull_request,
      event.repository
    );
    const updateTimeMs = Date.now() - updateStartTime;

    console.log(
      'Updated similarities for PR #%d: %d similar issues found',
      event.pull_request.number,
      updatedSimilarities.length
    );

    // Track similarity update
    await similarityMetricsService.trackSimilarityUpdate(
      event.pull_request.id,
      event.repository.id,
      event.action === 'edited' ? 'pr_edited' : 'pr_edited',
      0, // previousCount - would need to track this
      updatedSimilarities.length,
      updateTimeMs
    );

    // Update Check Runs with new similarity data (if Check Runs exist)
    if (updatedSimilarities.length > 0) {
      await handlePRCheckRuns(event);
    }

    // Track successful processing
    await webhookMetricsService.trackWebhookProcessing({
      eventType: 'pull_request',
      action: event.action,
      priority: 'medium',
      processingTimeMs: Date.now() - startTime,
      repositoryId: event.repository.id,
      installationId: event.installation?.id,
      cached: false,
    });
  } catch (error) {
    console.error('Error handling PR similarity update:', error);

    // Track error
    await webhookMetricsService.trackWebhookProcessing({
      eventType: 'pull_request',
      action: event.action,
      priority: 'medium',
      processingTimeMs: Date.now() - startTime,
      repositoryId: event.repository.id,
      installationId: event.installation?.id,
      cached: false,
      error: error instanceof Error ? error.message : String(error),
    });

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
    // Use shared service to ensure repository exists
    const repoId = await webhookDataService.ensureRepository(data.repository);
    if (!repoId) {
      // Repository not tracked yet, skip storing insights
      return;
    }

    // Use shared service to store PR
    const prId = await webhookDataService.storePR(data.pullRequest, repoId);
    if (!prId) return;

    // Store the insights
    await supabase.from('pr_insights').upsert({
      pull_request_id: prId,
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
    // Use shared service to ensure repository exists
    const repoId = await webhookDataService.ensureRepository(data.repository);
    if (!repoId) {
      // Repository not tracked yet, skip storing
      return;
    }

    // Use shared service to store PR
    const prId = await webhookDataService.storePR(data.pullRequest, repoId);
    if (!prId) return;

    // Store basic similarity tracking (lighter than full insights)
    await supabase.from('pr_insights').upsert({
      pull_request_id: prId,
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
