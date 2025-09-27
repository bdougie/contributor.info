import { PullRequestEvent } from '../types/github';
import { githubAppAuth } from '../lib/auth';
import { formatMinimalPRComment } from '../services/comments';
import { findSimilarIssues } from '../services/similarity';
import { suggestReviewers } from '../services/reviewers';
import {
  fetchContributorConfig,
  isFeatureEnabled,
  isUserExcluded,
} from '../services/contributor-config';

/**
 * Improved handler for PR opened events that posts reviewer suggestions
 * even when no similar issues are found
 */
export async function handlePROpenedImproved(event: PullRequestEvent) {
  try {
    console.log(
      'Processing opened PR #%s in ${event.repository.full_name}',
      event.pull_request.number
    );

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

    // Gather insights in parallel
    const promises = [];

    // Always check for similar issues if enabled
    if (isFeatureEnabled(config, 'similar_issues')) {
      promises.push(findSimilarIssues(event.pull_request, event.repository));
    } else {
      promises.push(Promise.resolve([]));
    }

    // Always check for reviewer suggestions if enabled
    if (isFeatureEnabled(config, 'reviewer_suggestions')) {
      promises.push(suggestReviewers(event.pull_request, event.repository, installationId));
    } else {
      promises.push(Promise.resolve({ suggestions: [], hasCodeOwners: false }));
    }

    const [similarIssues, reviewerSuggestionsResult] = await Promise.all(promises);

    // Extract suggestions and filter excluded reviewers
    const hasCodeOwners = reviewerSuggestionsResult?.hasCodeOwners || false;
    const reviewerSuggestions = (reviewerSuggestionsResult?.suggestions || []).filter(
      (reviewer) => !isUserExcluded(config, reviewer.login, 'reviewer')
    );

    // Only post if we have something to share
    if (similarIssues.length === 0 && reviewerSuggestions.length === 0) {
      console.log('No similar issues or reviewer suggestions found');
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

    // Post the comment
    const { data: postedComment } = await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body: comment,
    });

    console.log('Posted comment %s on PR #${event.pull_request.number}', postedComment.id);
    console.log('  - Similar issues: %s', similarIssues.length);
    console.log('  - Reviewer suggestions: %s', reviewerSuggestions.length);
  } catch (error) {
    console.error('Error handling PR opened event:', error);
    // Don't throw - we don't want GitHub to retry
  }
}
