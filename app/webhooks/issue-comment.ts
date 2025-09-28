import { IssueCommentEvent } from '../types/github';
import { githubAppAuth } from '../lib/auth';
import { supabase } from '../../src/lib/supabase';
import { findContextualIssues } from '../services/issue-context';
import { formatContextComment } from '../services/comments';

/**
 * Check if a comment contains the .issues command
 */
export function containsIssuesCommand(commentBody: string): boolean {
  const normalizedBody = commentBody.toLowerCase().trim();

  // Check if comment starts with .issues
  if (normalizedBody.startsWith('.issues')) {
    return true;
  }

  // Check if .issues appears on its own line
  const lines = normalizedBody.split('\n');
  return lines.some((line) => line.trim().startsWith('.issues'));
}

/**
 * Handle issue comment webhook events
 */
export async function handleIssueCommentEvent(event: IssueCommentEvent) {
  // Only process comment creation on PRs
  if (event.action !== 'created' || !event.issue.pull_request) {
    return;
  }

  // Check if comment contains .issues command
  if (!containsIssuesCommand(event.comment.body)) {
    return;
  }

  try {
    console.log(
      `Processing .issues command on PR #${event.issue.number} in ${event.repository.full_name}`
    );

    // Get installation token
    const installationId = event.installation?.id;
    if (!installationId) {
      console.error('No installation ID found');
      return;
    }

    const octokit = await githubAppAuth.getInstallationOctokit(installationId);

    // Record command usage
    const startTime = Date.now();
    const { data: commandRecord } = await supabase
      .from('comment_commands')
      .insert({
        command: '.issues',
        comment_id: event.comment.id,
        comment_author_id: await getOrCreateContributor(event.comment.user),
      })
      .select('id')
      .maybeSingle();

    if (!commandRecord) {
      console.error('Failed to record command usage');
      return;
    }

    // Get the PR details from our database
    const { data: pullRequest } = await supabase
      .from('pull_requests')
      .select('*')
      .eq('number', event.issue.number)
      .eq('repository_id', event.repository.id)
      .maybeSingle();

    if (!pullRequest) {
      // PR might not be in our database yet
      await postErrorComment(
        octokit,
        event,
        'Pull request data not found. Please try again in a few moments.'
      );
      return;
    }

    // Get PR files changed from GitHub API with pagination
    const changedFiles: string[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const { data: files } = await octokit.pulls.listFiles({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        pull_number: event.issue.number,
        per_page: 100,
        page,
      });

      changedFiles.push(...files.map((f) => f.filename));

      // Check if there are more pages
      hasMorePages = files.length === 100;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 10) {
        console.warn(`PR #${event.issue.number} has more than 1000 files, stopping pagination`);
        break;
      }
    }

    // Find contextual issues and PRs
    const contextualItems = await findContextualIssues({
      pullRequestId: pullRequest.id,
      repositoryId: event.repository.id,
      changedFiles,
      prTitle: event.issue.title,
      prBody: event.issue.body || '',
    });

    // Format the response comment
    const commentBody = formatContextComment({
      pullRequest: event.issue,
      repository: event.repository,
      contextualItems,
      changedFiles,
    });

    // Post the response
    const { data: postedComment } = await octokit.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.issue.number,
      body: commentBody,
    });

    console.log(`Posted context comment ${postedComment.id} on PR #${event.issue.number}`);

    // Delete the command comment to keep PR clean
    try {
      await octokit.issues.deleteComment({
        owner: event.repository.owner.login,
        repo: event.repository.name,
        comment_id: event.comment.id,
      });
      console.log(`Deleted command comment ${event.comment.id}`);
    } catch (deleteError) {
      console.error('Failed to delete command comment:', deleteError);
      // Continue even if deletion fails
    }

    // Update command record
    const processingTime = Date.now() - startTime;
    await supabase
      .from('comment_commands')
      .update({
        pull_request_id: pullRequest.id,
        response_posted: true,
        response_comment_id: postedComment.id,
        results_count: contextualItems.length,
        processing_time_ms: processingTime,
      })
      .eq('id', commandRecord.id);
  } catch (error) {
    console.error('Error handling issue comment event:', error);

    // Try to post an error message
    try {
      const installationId = event.installation?.id;
      if (installationId) {
        const octokit = await githubAppAuth.getInstallationOctokit(installationId);
        await postErrorComment(
          octokit,
          event,
          'Sorry, an error occurred while processing your request.'
        );
      }
    } catch (e) {
      console.error('Failed to post error comment:', e);
    }
  }
}

/**
 * Post an error comment
 */
async function postErrorComment(octokit: any, event: IssueCommentEvent, message: string) {
  await octokit.issues.createComment({
    owner: event.repository.owner.login,
    repo: event.repository.name,
    issue_number: event.issue.number,
    body: `❌ **Error**: ${message}\n\n_If this persists, please contact support._`,
  });
}

/**
 * Get or create contributor from user data
 */
async function getOrCreateContributor(user: any): Promise<string | null> {
  try {
    const { data: contributor } = await supabase
      .from('contributors')
      .upsert({
        github_id: user.id,
        github_login: user.login,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
        type: user.type,
      })
      .select('id')
      .maybeSingle();

    return contributor?.id || null;
  } catch (error) {
    console.error('Error creating contributor:', error);
    return null;
  }
}
