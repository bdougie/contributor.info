import Logger from '../utils/logger.js';

/**
 * Pull Request webhook handler
 * Handles pull request events from GitHub
 */

export async function handlePullRequestEvent(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('PullRequest') : new Logger('PullRequest');
  const { pull_request: pr, repository: repo, installation, action } = payload;
  
  logger.info('Processing PR %s: #%s in %s', action, pr.number, repo.full_name);
  
  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);
    
    // Handle different PR actions
    switch (action) {
      case 'opened':
      case 'reopened':
        // Track PR in database
        await trackPullRequest(pr, repo, supabase, logger);
        break;
        
      case 'closed':
        if (pr.merged) {
          logger.info('PR #%s was merged', pr.number);
          // Update PR status in database
          await updatePRStatus(pr, repo, 'merged', supabase, logger);
        } else {
          logger.info('PR #%s was closed without merging', pr.number);
          await updatePRStatus(pr, repo, 'closed', supabase, logger);
        }
        break;
        
      case 'synchronize':
        logger.info('PR #%s was updated with new commits', pr.number);
        // Update PR data
        await updatePullRequest(pr, repo, supabase, logger);
        break;
        
      default:
        logger.info('Unhandled PR action: %s', action);
    }
    
    return { success: true };
  } catch (error) {
    logger.error('Error handling pull request event:', error);
    throw error;
  }
}

async function trackPullRequest(pr, repo, supabase, logger) {
  try {
    const { data, error } = await supabase
      .from('pull_requests')
      .upsert({
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
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        commits: pr.commits,
        merged: pr.merged,
        merged_at: pr.merged_at
      }, {
        onConflict: 'github_id'
      });
      
    if (error) {
      logger.error('Error tracking PR in database:', error);
    } else {
      logger.info('✅ Tracked PR #%s in database', pr.number);
    }
  } catch (error) {
    logger.error('Error tracking pull request:', error);
  }
}

async function updatePRStatus(pr, repo, status, supabase, logger) {
  try {
    const { error } = await supabase
      .from('pull_requests')
      .update({
        state: status,
        closed_at: status === 'closed' || status === 'merged' ? new Date().toISOString() : null,
        merged: status === 'merged',
        merged_at: status === 'merged' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('github_id', pr.id);
      
    if (error) {
      logger.error('Error updating PR status:', error);
    } else {
      logger.info('✅ Updated PR #%s status to %s', pr.number, status);
    }
  } catch (error) {
    logger.error('Error updating PR status:', error);
  }
}

async function updatePullRequest(pr, repo, supabase, logger) {
  try {
    const { error } = await supabase
      .from('pull_requests')
      .update({
        title: pr.title,
        body: pr.body,
        updated_at: pr.updated_at,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        commits: pr.commits
      })
      .eq('github_id', pr.id);
      
    if (error) {
      logger.error('Error updating PR:', error);
    } else {
      logger.info('✅ Updated PR #%s data', pr.number);
    }
  } catch (error) {
    logger.error('Error updating pull request:', error);
  }
}