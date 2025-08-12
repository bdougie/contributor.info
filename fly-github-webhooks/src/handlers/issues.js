/**
 * Issues webhook handler
 * Handles issue events from GitHub
 */

export async function handleIssuesEvent(payload, githubApp, supabase) {
  const { issue, repository: repo, installation, action } = payload;
  
  console.log(`Processing issue ${action}: #${issue.number} in ${repo.full_name}`);
  
  try {
    // Handle different issue actions
    switch (action) {
      case 'opened':
        await trackIssue(issue, repo, supabase);
        break;
        
      case 'closed':
        await updateIssueStatus(issue, repo, 'closed', supabase);
        break;
        
      case 'reopened':
        await updateIssueStatus(issue, repo, 'open', supabase);
        break;
        
      case 'edited':
        await updateIssue(issue, repo, supabase);
        break;
        
      default:
        console.log(`Unhandled issue action: ${action}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error handling issue event:', error);
    throw error;
  }
}

async function trackIssue(issue, repo, supabase) {
  try {
    // Ensure repository is tracked
    const { error: repoError } = await supabase
      .from('repositories')
      .upsert({
        github_id: repo.id,
        owner: repo.owner.login,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        is_private: repo.private,
        html_url: repo.html_url,
        created_at: repo.created_at,
        updated_at: repo.updated_at
      }, {
        onConflict: 'github_id'
      });
    
    if (repoError) {
      console.error('Error upserting repository:', repoError);
      throw repoError;
    }
    
    // Track the contributor
    const { error: contributorError } = await supabase
      .from('contributors')
      .upsert({
        github_id: issue.user.id,
        username: issue.user.login,
        avatar_url: issue.user.avatar_url,
        html_url: issue.user.html_url,
        is_bot: issue.user.type === 'Bot'
      }, {
        onConflict: 'github_id'
      });
    
    if (contributorError) {
      console.error('Error upserting contributor:', contributorError);
      throw contributorError;
    }
    
    // Track the issue
    const { error } = await supabase
      .from('issues')
      .upsert({
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
        labels: issue.labels.map(l => l.name)
      }, {
        onConflict: 'github_id'
      });
      
    if (error) {
      console.error('Error tracking issue:', error);
    } else {
      console.log(`✅ Tracked issue #${issue.number} in database`);
    }
  } catch (error) {
    console.error('Error tracking issue:', error);
  }
}

async function updateIssueStatus(issue, repo, status, supabase) {
  try {
    const { error } = await supabase
      .from('issues')
      .update({
        state: status,
        closed_at: status === 'closed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('github_id', issue.id);
      
    if (error) {
      console.error('Error updating issue status:', error);
    } else {
      console.log(`✅ Updated issue #${issue.number} status to ${status}`);
    }
  } catch (error) {
    console.error('Error updating issue status:', error);
  }
}

async function updateIssue(issue, repo, supabase) {
  try {
    const { error } = await supabase
      .from('issues')
      .update({
        title: issue.title,
        body: issue.body,
        updated_at: issue.updated_at,
        labels: issue.labels.map(l => l.name)
      })
      .eq('github_id', issue.id);
      
    if (error) {
      console.error('Error updating issue:', error);
    } else {
      console.log(`✅ Updated issue #${issue.number} data`);
    }
  } catch (error) {
    console.error('Error updating issue:', error);
  }
}