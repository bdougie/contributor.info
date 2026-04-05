import {
  PullRequestEvent,
  Repository,
  PullRequest,
  SimilarIssueResult,
  ReviewerSuggestion,
  WebhookCommentData,
} from '../types/github';
import { formatMinimalPRComment } from '../services/comments';
import { suggestReviewers } from '../services/reviewers';
import {
  fetchContributorConfig,
  isFeatureEnabled,
  isUserExcluded,
} from '../services/contributor-config';
import { supabase } from '../../src/lib/supabase';
import type { GitHubAppAuth } from '../lib/auth';
import { createLogger } from '../services/logger';

const logger = createLogger('pull-request-direct');

// Lazy load auth to avoid initialization errors
let githubAppAuth: GitHubAppAuth | null = null;

async function getAuth() {
  if (!githubAppAuth) {
    try {
      const { githubAppAuth: auth } = await import('../lib/auth');
      githubAppAuth = auth;
      logger.info('GitHub App auth loaded');
    } catch (error) {
      logger.error('Failed to load GitHub App auth:', error);
      throw error;
    }
  }
  return githubAppAuth;
}

/**
 * Direct webhook handler that uses repository info from webhook payload
 * instead of requiring database lookup. This ensures comments work even
 * if the repository isn't tracked in our database yet.
 */
export async function handlePROpenedDirect(event: PullRequestEvent) {
  logger.info('handlePROpenedDirect called');

  try {
    const { pull_request: pr, repository: repo, installation } = event;

    logger.info('Processing opened PR #%d in %s', pr.number, repo.full_name);
    logger.info('  Repository GitHub ID from webhook: %s', repo.id);
    logger.info('  Installation ID: %s', installation?.id);
    logger.info('  PR author: %s', pr.user.login);

    // Get installation token
    const installationId = installation?.id;
    if (!installationId) {
      logger.error('No installation ID found in webhook payload');
      return;
    }

    logger.info('Getting auth module...');
    const auth = await getAuth();

    logger.info('Getting installation Octokit...');
    const octokit = await auth.getInstallationOctokit(installationId);
    logger.info('Got installation Octokit');

    // Fetch configuration from the repository
    const config = await fetchContributorConfig(octokit, repo.owner.login, repo.name);

    // Check if PR author is excluded
    if (isUserExcluded(config, pr.user.login, 'author')) {
      logger.info('PR author %s is excluded from comments', pr.user.login);
      return;
    }

    // Check if auto-comment is enabled
    if (!isFeatureEnabled(config, 'auto_comment')) {
      logger.info('Auto-comment is disabled in .contributor config');
      return;
    }

    // Gather insights based on configuration
    const promises = [];

    // Get similar issues if enabled (this will work with direct repo info)
    if (isFeatureEnabled(config, 'similar_issues')) {
      promises.push(findSimilarIssuesDirect(pr, repo));
    } else {
      promises.push(Promise.resolve([]));
    }

    // Get reviewer suggestions if enabled
    if (isFeatureEnabled(config, 'reviewer_suggestions')) {
      promises.push(suggestReviewers(pr, repo, installationId));
    } else {
      promises.push(Promise.resolve({ suggestions: [], hasCodeOwners: false }));
    }

    const [similarIssues, reviewerSuggestionsResult] = await Promise.all(promises);

    // Extract and filter suggestions
    const hasCodeOwners = reviewerSuggestionsResult?.hasCodeOwners || false;
    const reviewerSuggestions = (reviewerSuggestionsResult?.suggestions || []).filter(
      (reviewer) => !isUserExcluded(config, reviewer.login, 'reviewer')
    );

    // Only post if we have something to share
    if (similarIssues.length === 0 && reviewerSuggestions.length === 0) {
      logger.info('No similar issues or reviewer suggestions found');

      // Optionally store the repository info for future use
      await ensureRepositoryTracked(repo);
      return;
    }

    // Format the comment
    let comment = '';

    // Add similar issues section if found
    if (similarIssues.length > 0) {
      comment += '## 🔗 Related Issues\n\n';
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
    }

    // Add reviewer suggestions section if found
    if (reviewerSuggestions.length > 0) {
      comment += '## 👥 Suggested Reviewers\n\n';

      if (hasCodeOwners) {
        comment += '_Based on CODEOWNERS and contribution history:_\n\n';
      } else {
        comment += '_Based on contribution history:_\n\n';
      }

      for (const reviewer of reviewerSuggestions.slice(0, 3)) {
        comment += `- **@${reviewer.login}** - `;

        if (reviewer.reasons.length > 0) {
          comment += reviewer.reasons.join(', ');
        } else {
          comment += `${reviewer.contributions} contributions`;
        }

        if (reviewer.lastActive) {
          const daysAgo = Math.floor(
            (Date.now() - new Date(reviewer.lastActive).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysAgo < 30) {
            comment += ` (active ${daysAgo === 0 ? 'today' : `${daysAgo} days ago`})`;
          }
        }

        comment += '\n';
      }

      comment += '\n';
    }

    // Add footer
    comment += '_This helps connect related work and find the right reviewers. ';
    comment += 'Powered by [contributor.info](https://contributor.info)_ 🤖';

    // Post the comment using repository info from webhook
    const { data: postedComment } = await octokit.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pr.number,
      body: comment,
    });

    logger.info('Posted comment %d on PR #%d', postedComment.id, pr.number);
    logger.info('  - Similar issues: %d', similarIssues.length);
    logger.info('  - Reviewer suggestions: %d', reviewerSuggestions.length);

    // Store the repository for future use if not already tracked
    await ensureRepositoryTracked(repo);

    // Optionally store comment tracking info
    await trackWebhookComment({
      pullRequest: pr,
      repository: repo,
      similarIssues,
      reviewerSuggestions,
      commentId: postedComment.id,
    });
  } catch (error) {
    logger.error('Error handling PR opened event:', error);
    // Don't throw - we don't want GitHub to retry
  }
}

/**
 * Find similar issues using repository info directly from webhook
 */
async function findSimilarIssuesDirect(
  pr: PullRequest,
  repo: Repository
): Promise<SimilarIssueResult[]> {
  try {
    // First check if repository is in database
    const { data: dbRepo } = await supabase
      .from('repositories')
      .select('id')
      .eq('github_id', repo.id)
      .maybeSingle();

    if (!dbRepo) {
      logger.info('Repository not in database, no similar issues available');
      return [];
    }

    // Now we can look for similar issues
    const { data: issues } = await supabase
      .from('issues')
      .select('*')
      .eq('repository_id', dbRepo.id)
      .limit(100);

    if (!issues || issues.length === 0) {
      logger.info('No issues found in database for similarity matching');
      return [];
    }

    // Simple similarity matching (can be enhanced)
    const similar = [];
    const prTitleLower = pr.title.toLowerCase();
    const prBodyLower = (pr.body || '').toLowerCase();

    for (const issue of issues) {
      const titleLower = (issue.title || '').toLowerCase();
      const bodyLower = (issue.body || '').toLowerCase();

      // Check for keyword matches
      const reasons = [];
      let similarityScore = 0;

      // Check if PR mentions the issue number
      if (pr.body && pr.body.includes(`#${issue.number}`)) {
        reasons.push(`mentioned in PR`);
        similarityScore = 1.0;
      }

      // Check for similar titles
      const titleWords = prTitleLower.split(/\s+/);
      const issueTitleWords = titleLower.split(/\s+/);
      const commonWords = titleWords.filter(
        (word) => word.length > 3 && issueTitleWords.includes(word)
      );

      if (commonWords.length > 2) {
        similarityScore = Math.max(similarityScore, commonWords.length / titleWords.length);
        if (similarityScore > 0.5) {
          reasons.push('similar title');
        }
      }

      if (similarityScore > 0.3 || reasons.length > 0) {
        similar.push({
          issue: {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            html_url: issue.html_url,
          },
          similarityScore,
          reasons,
          relationship: reasons.includes('mentioned in PR') ? 'fixes' : 'relates_to',
        });
      }
    }

    // Sort by similarity score and return top 5
    return similar.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
  } catch (error) {
    logger.error('Error finding similar issues:', error);
    return [];
  }
}

/**
 * Ensure repository is tracked in database with correct GitHub ID
 */
async function ensureRepositoryTracked(repo: Repository): Promise<string | null> {
  try {
    // Check if repository exists with correct GitHub ID
    const { data: existing } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('github_id', repo.id)
      .maybeSingle();

    if (existing) {
      logger.info('Repository %s already tracked with correct GitHub ID', repo.full_name);
      return existing.id;
    }

    // Check if repository exists with wrong GitHub ID (by owner/name)
    const { data: wrongId } = await supabase
      .from('repositories')
      .select('id, github_id')
      .eq('owner', repo.owner.login)
      .eq('name', repo.name)
      .maybeSingle();

    if (wrongId) {
      logger.warn(
        'Repository %s has wrong GitHub ID: %s vs %s',
        repo.full_name,
        wrongId.github_id,
        repo.id
      );

      // Update with correct GitHub ID
      const { error: updateError } = await supabase
        .from('repositories')
        .update({
          github_id: repo.id,
          last_updated_at: new Date().toISOString(),
        })
        .eq('id', wrongId.id);

      if (!updateError) {
        logger.info('Fixed GitHub ID for %s', repo.full_name);
      }
      return wrongId.id;
    }

    // Repository doesn't exist, create it
    logger.info('Adding new repository %s to database', repo.full_name);

    const { data: newRepo, error } = await supabase
      .from('repositories')
      .insert({
        github_id: repo.id,
        full_name: repo.full_name,
        owner: repo.owner.login,
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stargazers_count: repo.stargazers_count || 0,
        forks_count: repo.forks_count || 0,
        open_issues_count: repo.open_issues_count || 0,
        is_private: repo.private || false,
        default_branch: repo.default_branch || 'main',
        github_created_at: repo.created_at,
        github_updated_at: repo.updated_at,
      })
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Failed to create repository: %s', error.message);
      return null;
    }

    logger.info('Created repository %s with GitHub ID %s', repo.full_name, repo.id);
    return newRepo.id;
  } catch (error) {
    logger.error('Error ensuring repository tracked:', error);
    return null;
  }
}

/**
 * Track webhook comment for analytics
 */
async function trackWebhookComment(data: WebhookCommentData & { commentId: number }) {
  try {
    // Store webhook activity for analytics
    await supabase.from('webhook_activities').insert({
      event_type: 'pull_request.opened',
      repository_github_id: data.repository.id,
      repository_name: data.repository.full_name,
      pr_number: data.pullRequest.number,
      comment_posted: true,
      comment_id: data.commentId,
      similar_issues_count: data.similarIssues.length,
      reviewer_suggestions_count: data.reviewerSuggestions.length,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    // Non-critical, just log
    const err = error as Error;
    logger.warn('Could not track webhook activity: %s', err.message);
  }
}
