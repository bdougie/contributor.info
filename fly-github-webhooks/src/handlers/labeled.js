/**
 * Labeled event handler
 * Handles when labels are added to issues or PRs
 */

import Logger from '../utils/logger.js';

export async function handleLabeledEvent(payload, githubApp, supabase, parentLogger) {
  const logger = parentLogger ? parentLogger.child('Labeled') : new Logger('Labeled');
  const { label, issue, pull_request, repository: repo, installation } = payload;
  
  // Determine if this is an issue or PR
  const item = pull_request || issue;
  const itemType = pull_request ? 'pull request' : 'issue';
  
  logger.info('Label "%s" added to %s #%d in %s', label.name, itemType, item.number, repo.full_name);
  
  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);
    
    // Handle specific labels with automated responses
    await handleSpecialLabels(label, item, itemType, repo, octokit, logger);
    
    // Update labels in database
    await updateLabelsInDatabase(item, itemType, repo, supabase, logger);
    
    return { success: true };
  } catch (error) {
    logger.error('Error handling labeled event: %s', error.message);
    throw error;
  }
}

async function handleSpecialLabels(label, item, itemType, repo, octokit, logger) {
  const labelName = label.name.toLowerCase();
  
  try {
    // Good first issue label
    if (labelName === 'good first issue' || labelName === 'good-first-issue') {
      const comment = `🌟 This ${itemType} has been marked as a **good first issue**!\n\n` +
                     `If you're interested in working on this:\n` +
                     `1. Comment below to claim it\n` +
                     `2. Fork the repository\n` +
                     `3. Create a new branch for your changes\n` +
                     `4. Submit a pull request when ready\n\n` +
                     `Feel free to ask questions if you need help getting started!`;
      
      await octokit.rest.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: item.number,
        body: comment
      });
      
      logger.info('✅ Posted good first issue guidance on #%d', item.number);
    }
    
    // Help wanted label
    else if (labelName === 'help wanted' || labelName === 'help-wanted') {
      const comment = `🤝 This ${itemType} has been marked as **help wanted**!\n\n` +
                     `The maintainers are looking for community contributions on this. ` +
                     `If you have expertise in this area, your help would be appreciated!\n\n` +
                     `Please comment below if you'd like to work on this.`;
      
      await octokit.rest.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: item.number,
        body: comment
      });
      
      logger.info('✅ Posted help wanted message on #%d', item.number);
    }
    
    // contributor.info label - for testing and debugging
    else if (labelName === 'contributor.info') {
      const timestamp = new Date().toISOString();
      const comment = `🤖 **Contributor.info Webhook Test**\n\n` +
                     `✅ Webhook successfully received and processed!\n\n` +
                     `**Debug Information:**\n` +
                     `- Timestamp: ${timestamp}\n` +
                     `- Event Type: \`labeled\`\n` +
                     `- ${itemType === 'pull request' ? 'PR' : 'Issue'} Number: #${item.number}\n` +
                     `- Repository: ${repo.full_name}\n` +
                     `- Label Applied: \`${label.name}\`\n` +
                     `- Author: @${item.user.login}\n` +
                     `- Webhook Service: [Health Status](https://contributor-info-webhooks.fly.dev/health)\n\n` +
                     `This is an automated test response from the contributor.info GitHub App webhook handler.`;
      
      await octokit.rest.issues.createComment({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: item.number,
        body: comment
      });
      
      logger.info('✅ Posted contributor.info test response on #%d', item.number);
    }
    
    // Bug label
    else if (labelName === 'bug') {
      // Only comment if this is a newly opened issue
      if (item.created_at === item.updated_at) {
        const comment = `🐛 Thanks for reporting this bug!\n\n` +
                       `To help us resolve this quickly, please ensure you've provided:\n` +
                       `- Steps to reproduce the issue\n` +
                       `- Expected behavior\n` +
                       `- Actual behavior\n` +
                       `- Environment details (OS, browser, version, etc.)\n` +
                       `- Any error messages or screenshots\n\n` +
                       `A maintainer will investigate this soon.`;
        
        await octokit.rest.issues.createComment({
          owner: repo.owner.login,
          repo: repo.name,
          issue_number: item.number,
          body: comment
        });
        
        logger.info('✅ Posted bug report template on #%d', item.number);
      }
    }
    
    // Priority labels
    else if (labelName.includes('priority') || labelName.includes('critical')) {
      // Add a reaction to acknowledge priority
      await octokit.rest.reactions.createForIssue({
        owner: repo.owner.login,
        repo: repo.name,
        issue_number: item.number,
        content: 'eyes'
      });
      
      logger.info('✅ Acknowledged priority label on #%d', item.number);
    }
    
  } catch (error) {
    logger.error('Error handling special label "%s": %s', label.name, error.message);
    // Don't throw - we don't want label handling to fail the webhook
  }
}

async function updateLabelsInDatabase(item, itemType, repo, supabase, logger) {
  try {
    const labels = item.labels.map(l => l.name);
    
    if (itemType === 'pull request') {
      const { error } = await supabase
        .from('pull_requests')
        .update({
          labels: labels,
          updated_at: new Date().toISOString()
        })
        .eq('github_id', item.id);
        
      if (error) {
        logger.error('Error updating PR labels: %s', error.message);
      } else {
        logger.info('✅ Updated labels for PR #%d', item.number);
      }
    } else {
      const { error } = await supabase
        .from('issues')
        .update({
          labels: labels,
          updated_at: new Date().toISOString()
        })
        .eq('github_id', item.id);
        
      if (error) {
        logger.error('Error updating issue labels: %s', error.message);
      } else {
        logger.info('✅ Updated labels for issue #%d', item.number);
      }
    }
  } catch (error) {
    logger.error('Error updating labels in database: %s', error.message);
  }
}