/**
 * Labeled event handler
 * Handles when labels are added to issues or PRs
 */

export async function handleLabeledEvent(payload, githubApp, supabase) {
  const { label, issue, pull_request, repository: repo, installation } = payload;
  
  // Determine if this is an issue or PR
  const item = pull_request || issue;
  const itemType = pull_request ? 'pull request' : 'issue';
  
  console.log(`Label "${label.name}" added to ${itemType} #${item.number} in ${repo.full_name}`);
  
  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);
    
    // Handle specific labels with automated responses
    await handleSpecialLabels(label, item, itemType, repo, octokit);
    
    // Update labels in database
    await updateLabelsInDatabase(item, itemType, repo, supabase);
    
    return { success: true };
  } catch (error) {
    console.error('Error handling labeled event:', error);
    throw error;
  }
}

async function handleSpecialLabels(label, item, itemType, repo, octokit) {
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
      
      console.log(`✅ Posted good first issue guidance on #${item.number}`);
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
      
      console.log(`✅ Posted help wanted message on #${item.number}`);
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
        
        console.log(`✅ Posted bug report template on #${item.number}`);
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
      
      console.log('✅ Acknowledged priority label on #%d', item.number);
    }
    
  } catch (error) {
    console.error('Error handling special label "%s":', label.name, error);
    // Don't throw - we don't want label handling to fail the webhook
  }
}

async function updateLabelsInDatabase(item, itemType, repo, supabase) {
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
        console.error('Error updating PR labels:', error);
      } else {
        console.log(`✅ Updated labels for PR #${item.number}`);
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
        console.error('Error updating issue labels:', error);
      } else {
        console.log(`✅ Updated labels for issue #${item.number}`);
      }
    }
  } catch (error) {
    console.error('Error updating labels in database:', error);
  }
}