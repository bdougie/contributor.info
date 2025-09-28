import Logger from '../utils/logger.js';
// Phase 2: reuse shared contributor utility via dynamic import path (not TypeScript here)
// We intentionally avoid relative traversal into app/; progressive scripts own shared utils.
import { ensureContributor as sharedEnsureContributor } from '../../../scripts/progressive-capture/lib/contributor-utils.js';

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

// Wrap shared ensureContributor to keep logging behavior
async function ensureContributor(supabase, githubUser, logger) {
  const id = await sharedEnsureContributor(supabase, githubUser);
  if (!id) logger.error('Failed upserting contributor %s', githubUser?.login);
  return id;
}

async function trackPullRequest(pr, repo, supabase, logger) {
  try {
    // Ensure repository (return internal UUID)
    const { data: repoData, error: repoError } = await supabase
      .from('repositories')
      .upsert(
        {
          github_id: repo.id,
          owner: repo.owner.login,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          is_private: repo.private,
          html_url: repo.html_url,
          github_created_at: repo.created_at,
          github_updated_at: repo.updated_at,
        },
        { onConflict: 'github_id' }
      )
      .select('id')
      .maybeSingle();

    if (repoError || !repoData) {
      logger.error('Failed to ensure repository record: %s', repoError?.message);
      return;
    }

    // Ensure contributor and get internal UUID
    const contributorId = await ensureContributor(supabase, pr.user, logger);
    if (!contributorId) {
      logger.error('Could not determine contributor UUID, aborting PR track');
      return;
    }

    // Upsert PR with proper foreign keys
    const { error: prError } = await supabase.from('pull_requests').upsert(
      {
        github_id: pr.id,
        repository_id: repoData.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: (pr.state || '').toLowerCase(),
        author_id: contributorId,
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
      { onConflict: 'github_id' }
    );

    if (prError) {
      logger.error('Failed to upsert PR #%s: %s', pr.number, prError.message);
      return;
    }
    logger.info('✅ Tracked PR #%s in database', pr.number);
  } catch (error) {
    logger.error('Error tracking PR in database:', error);
  }
}
