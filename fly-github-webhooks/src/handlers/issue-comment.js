import Logger from '../utils/logger.js';

/**
 * Issue comment webhook handler
 * Handles comment events on issues and PRs
 */

export async function handleIssueCommentEvent(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('IssueComment') : new Logger('IssueComment');
  const { comment, issue, repository: repo, installation, action } = payload;

  logger.info('Processing comment %s on #%s in %s', action, issue.number, repo.full_name);

  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);

    // Handle different comment actions
    switch (action) {
      case 'created':
        await trackComment(comment, issue, repo, supabase, logger);

        // Check for special commands in comments
        await handleCommentCommands(comment, issue, repo, octokit);
        break;

      case 'edited':
        await updateComment(comment, issue, repo, supabase, logger);
        break;

      case 'deleted':
        await deleteComment(comment, supabase);
        break;

      default:
        logger.info('Unhandled comment action: %s', action);
    }

    return { success: true };
  } catch (error) {
    logger.error('Error handling comment event:', error);
    throw error;
  }
}

async function handleCommentCommands(comment, issue, repo, octokit) {
  const body = comment.body.toLowerCase();

  // Check for bot commands (customize as needed)
  if (body.includes('/help')) {
    await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: issue.number,
      body:
        `Available commands:\n` +
        `- \`/help\` - Show this help message\n` +
        `- \`/assign me\` - Assign yourself to this issue\n` +
        `- \`/label [label-name]\` - Add a label (maintainers only)`,
    });
  } else if (body.includes('/assign me')) {
    // Assign the commenter to the issue
    try {
      await octokit.rest.issues.addAssignees({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: issue.number,
        assignees: [comment.user.login],
      });

      await octokit.rest.reactions.createForIssueComment({
        owner: repo.owner.login,
        repo: repo.name,
        comment_id: comment.id,
        content: '+1',
      });
    } catch (error) {
      logger.error('Error assigning user:', error);
    }
  }
}

async function trackComment(comment, issue, repo, supabase, logger) {
  try {
    // Track the commenter
    await supabase.from('contributors').upsert(
      {
        github_id: comment.user.id,
        username: comment.user.login,
        avatar_url: comment.user.avatar_url,
        html_url: comment.user.html_url,
        is_bot: comment.user.type === 'Bot',
      },
      {
        onConflict: 'github_id',
      }
    );

    // Determine if this is an issue or PR comment
    const comment_type = issue.pull_request ? 'pr_comment' : 'issue_comment';

    // Track the comment
    const { error } = await supabase.from('comments').upsert(
      {
        github_id: comment.id,
        repository_id: repo.id,
        issue_number: issue.number,
        commenter_id: comment.user.id,
        body: comment.body,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        html_url: comment.html_url,
        comment_type: comment_type,
      },
      {
        onConflict: 'github_id',
      }
    );

    if (error) {
      logger.error('Error tracking comment:', error);
    } else {
      logger.info('✅ Tracked %s on #%s', comment_type, issue.number);
    }
  } catch (error) {
    logger.error('Error tracking comment:', error);
  }
}

async function updateComment(comment, issue, repo, supabase, logger) {
  try {
    const { error } = await supabase
      .from('comments')
      .update({
        body: comment.body,
        updated_at: comment.updated_at,
      })
      .eq('github_id', comment.id);

    if (error) {
      logger.error('Error updating comment:', error);
    } else {
      logger.info('✅ Updated comment %s', comment.id);
    }
  } catch (error) {
    logger.error('Error updating comment:', error);
  }
}

async function deleteComment(comment, supabase, logger) {
  try {
    const { error } = await supabase.from('comments').delete().eq('github_id', comment.id);

    if (error) {
      logger.error('Error deleting comment:', error);
    } else {
      logger.info('✅ Deleted comment %s from database', comment.id);
    }
  } catch (error) {
    logger.error('Error deleting comment:', error);
  }
}
