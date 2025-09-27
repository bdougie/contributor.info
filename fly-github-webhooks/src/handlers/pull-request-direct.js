import Logger from '../utils/logger.js';

/**
 * Direct PR opened handler
 * Posts welcome comments on newly opened PRs
 */

export async function handlePROpenedDirect(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('PROpenedDirect') : new Logger('PROpenedDirect');
  const { pull_request: pr, repository: repo, installation } = payload;

  logger.info('Processing opened PR #%s in %s', pr.number, repo.full_name);
  logger.info('  PR author: %s', pr.user.login);

  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);

    // Check if this is the author's first PR to this repo
    const isFirstPR = await checkIfFirstPR(pr.user.login, repo, octokit);

    // Create welcome comment
    let comment = `👋 Thanks for opening this pull request, @${pr.user.login}!`;

    if (isFirstPR) {
      comment += `\n\nWelcome to ${repo.name}! This appears to be your first contribution to this repository. 🎉`;
    }

    comment += `\n\nThe maintainers will review your PR soon. In the meantime, please ensure:`;
    comment += `\n- [ ] Your PR has a clear description`;
    comment += `\n- [ ] You've included any necessary tests`;
    comment += `\n- [ ] Your code follows the project's style guidelines`;

    // Post comment
    await octokit.rest.issues.createComment({
      owner: repo.owner.login,
      repo: repo.name,
      issue_number: pr.number,
      body: comment,
    });

    logger.info('✅ Posted welcome comment on PR #%s', pr.number);

    // Track PR in database
    await trackPullRequest(pr, repo, supabase, logger);

    return { success: true, commented: true };
  } catch (error) {
    logger.error('Error handling PR opened:', error);
    // Don't throw - we don't want to trigger retries for comment failures
    return { success: false, error: error.message };
  }
}

async function checkIfFirstPR(username, repo, octokit) {
  try {
    // Note: GitHub API doesn't support 'creator' parameter for pulls.list
    // We need to fetch more PRs and filter by author
    const { data: prs } = await octokit.rest.pulls.list({
      owner: repo.owner.login,
      repo: repo.name,
      state: 'all',
      per_page: 100,
    });

    // Filter PRs by the specific user
    const userPrs = prs.filter((pr) => pr.user.login === username);

    // If we only find 1 PR (the current one), it's their first
    return userPrs.length <= 1;
  } catch (error) {
    logger.error('Error checking PR history:', error);
    return false;
  }
}

async function trackPullRequest(pr, repo, supabase, logger) {
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
        github_id: pr.user.id,
        username: pr.user.login,
        avatar_url: pr.user.avatar_url,
        html_url: pr.user.html_url,
        is_bot: pr.user.type === 'Bot',
      },
      {
        onConflict: 'github_id',
      }
    );

    // Track the PR
    await supabase.from('pull_requests').upsert(
      {
        github_id: pr.id,
        repository_id: repo.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author_id: pr.user.id,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        html_url: pr.html_url,
        base_branch: pr.base.ref,
        head_branch: pr.head.ref,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changed_files: pr.changed_files || 0,
        commits: pr.commits || 0,
        merged: false,
        merged_at: null,
      },
      {
        onConflict: 'github_id',
      }
    );

    logger.info('✅ Tracked PR #%s in database', pr.number);
  } catch (error) {
    logger.error('Error tracking PR in database:', error);
  }
}
