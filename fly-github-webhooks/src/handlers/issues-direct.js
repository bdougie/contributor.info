import Logger from '../utils/logger.js';

/**
 * Direct issue opened handler
 * Posts welcome comments on newly opened issues
 */

export async function handleIssueOpenedDirect(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger
    ? parentLogger.child('IssueOpenedDirect')
    : new Logger('IssueOpenedDirect');
  const { issue, repository: repo, installation } = payload;

  logger.info('Processing opened issue #%s in %s', issue.number, repo.full_name);
  logger.info('  Issue author: %s', issue.user.login);

  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);

    // Check if this is the author's first issue to this repo
    const isFirstIssue = await checkIfFirstIssue(issue.user.login, repo, octokit);

    // Create welcome comment
    let comment = `👋 Thanks for opening this issue, @${issue.user.login}!`;

    if (isFirstIssue) {
      comment += `\n\nWelcome to ${repo.name}! This appears to be your first issue in this repository. 🎉`;
    }

    comment += `\n\nA maintainer will review your issue soon. Meanwhile, please make sure you've provided:`;
    comment += `\n- A clear description of the problem or feature request`;
    comment += `\n- Steps to reproduce (if it's a bug)`;
    comment += `\n- Your environment details (if relevant)`;

    // Check for common labels
    const labels = issue.labels.map((l) => l.name);
    if (labels.includes('bug')) {
      comment += `\n\n🐛 This issue has been labeled as a bug. Please ensure you've included reproduction steps.`;
    } else if (labels.includes('enhancement') || labels.includes('feature')) {
      comment += `\n\n✨ This looks like a feature request. Please describe your use case to help us understand the need.`;
    } else if (labels.includes('good first issue')) {
      comment += `\n\n🌟 This has been marked as a good first issue! Feel free to submit a PR if you'd like to work on it.`;
    }

    // Post comment
    await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: issue.number,
      body: comment,
    });

    logger.info('✅ Posted welcome comment on issue #%s', issue.number);

    // Track issue in database
    await trackIssue(issue, repo, supabase, logger);

    return { success: true, commented: true };
  } catch (error) {
    logger.error('Error handling issue opened:', error);
    // Don't throw - we don't want to trigger retries for comment failures
    return { success: false, error: error.message };
  }
}

async function checkIfFirstIssue(username, repo, octokit) {
  try {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: repo.owner.login,
      repo: repo.name,
      state: 'all',
      creator: username,
      per_page: 2,
    });

    // Filter out pull requests (they're included in issues API)
    const actualIssues = issues.filter((i) => !i.pull_request);

    // If we only find 1 issue (the current one), it's their first
    return actualIssues.length <= 1;
  } catch (error) {
    logger.error('Error checking issue history:', error);
    return false;
  }
}

async function trackIssue(issue, repo, supabase, logger) {
  try {
    // First ensure the repository is tracked
    await supabase.from('repositories').upsert(
      {
        github_id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        is_private: repo.private,
        html_url: repo.html_url,
        created_at: repo.created_at,
        updated_at: repo.updated_at,
      },
      {
        onConflict: 'github_id',
      }
    );

    // Track the contributor
    await supabase.from('contributors').upsert(
      {
        github_id: issue.user.id,
        username: issue.user.login,
        avatar_url: issue.user.avatar_url,
        html_url: issue.user.html_url,
        is_bot: issue.user.type === 'Bot',
      },
      {
        onConflict: 'github_id',
      }
    );

    // Track the issue
    await supabase.from('issues').upsert(
      {
        github_id: issue.id,
        repository_id: repo.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author_id: issue.user.id,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        html_url: issue.html_url,
        labels: issue.labels.map((l) => l.name),
      },
      {
        onConflict: 'github_id',
      }
    );

    logger.info('✅ Tracked issue #%s in database', issue.number);
  } catch (error) {
    logger.error('Error tracking issue in database:', error);
  }
}
