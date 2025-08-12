/**
 * Pull Request webhook handler
 * Handles pull request events from GitHub
 */

export async function handlePullRequestEvent(payload, githubApp, supabase) {
  const { pull_request: pr, repository: repo, installation, action } = payload;
  
  console.log(`Processing PR ${action}: #${pr.number} in ${repo.full_name}`);
  
  try {
    // Get installation Octokit
    const octokit = await githubApp.getInstallationOctokit(installation.id);
    
    // Handle different PR actions
    switch (action) {
      case 'opened':
      case 'reopened':
        // Track PR in database
        await trackPullRequest(pr, repo, supabase);
        break;
        
      case 'closed':
        if (pr.merged) {
          console.log(`PR #${pr.number} was merged`);
          // Update PR status in database
          await updatePRStatus(pr, repo, 'merged', supabase);
        } else {
          console.log(`PR #${pr.number} was closed without merging`);
          await updatePRStatus(pr, repo, 'closed', supabase);
        }
        break;
        
      case 'synchronize':
        console.log(`PR #${pr.number} was updated with new commits`);
        // Update PR data
        await updatePullRequest(pr, repo, supabase);
        break;
        
      default:
        console.log(`Unhandled PR action: ${action}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error handling pull request event:', error);
    throw error;
  }
}

async function trackPullRequest(pr, repo, supabase) {
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
      console.error('Error tracking PR in database:', error);
    } else {
      console.log(`✅ Tracked PR #${pr.number} in database`);
    }
  } catch (error) {
    console.error('Error tracking pull request:', error);
  }
}

async function updatePRStatus(pr, repo, status, supabase) {
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
      console.error('Error updating PR status:', error);
    } else {
      console.log(`✅ Updated PR #${pr.number} status to ${status}`);
    }
  } catch (error) {
    console.error('Error updating PR status:', error);
  }
}

async function updatePullRequest(pr, repo, supabase) {
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
      console.error('Error updating PR:', error);
    } else {
      console.log(`✅ Updated PR #${pr.number} data`);
    }
  } catch (error) {
    console.error('Error updating pull request:', error);
  }
}