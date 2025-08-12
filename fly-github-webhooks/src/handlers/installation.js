/**
 * Installation webhook handler
 * Handles GitHub App installation events
 */

export async function handleInstallationEvent(payload, githubApp, supabase) {
  const { action, installation, repositories, sender } = payload;
  
  console.log(`Processing installation ${action} by ${sender.login}`);
  console.log(`  Installation ID: ${installation.id}`);
  console.log(`  Account: ${installation.account.login} (${installation.account.type})`);
  
  try {
    switch (action) {
      case 'created':
        await handleNewInstallation(installation, repositories, supabase);
        break;
        
      case 'deleted':
        await handleRemovedInstallation(installation, supabase);
        break;
        
      case 'repositories_added':
        await handleRepositoriesAdded(installation, repositories, supabase);
        break;
        
      case 'repositories_removed':
        await handleRepositoriesRemoved(installation, repositories, supabase);
        break;
        
      default:
        console.log(`Unhandled installation action: ${action}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error handling installation event:', error);
    throw error;
  }
}

async function handleNewInstallation(installation, repositories, supabase) {
  console.log(`🎉 New installation for ${installation.account.login}`);
  
  try {
    // Track the installation
    const { data: installData, error: installError } = await supabase
      .from('installations')
      .upsert({
        github_id: installation.id,
        account_login: installation.account.login,
        account_type: installation.account.type,
        account_id: installation.account.id,
        target_type: installation.target_type,
        created_at: installation.created_at,
        updated_at: installation.updated_at,
        permissions: installation.permissions,
        events: installation.events,
        repository_selection: installation.repository_selection
      }, {
        onConflict: 'github_id'
      });
      
    if (installError) {
      console.error('Error tracking installation:', installError);
    } else {
      console.log(`✅ Tracked installation ${installation.id}`);
    }
    
    // Track repositories if provided
    if (repositories && repositories.length > 0) {
      for (const repo of repositories) {
        await trackRepository(repo, installation.id, supabase);
      }
      console.log(`✅ Tracked ${repositories.length} repositories`);
    }
    
    // Log summary
    console.log(`Installation complete:`, {
      account: installation.account.login,
      type: installation.account.type,
      repositories: repositories?.length || 'all',
      permissions: Object.keys(installation.permissions || {}).join(', ')
    });
    
  } catch (error) {
    console.error('Error handling new installation:', error);
  }
}

async function handleRemovedInstallation(installation, supabase) {
  console.log(`❌ Installation removed for ${installation.account.login}`);
  
  try {
    // Mark installation as deleted
    const { error } = await supabase
      .from('installations')
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq('github_id', installation.id);
      
    if (error) {
      console.error('Error marking installation as deleted:', error);
    } else {
      console.log(`✅ Marked installation ${installation.id} as deleted`);
    }
  } catch (error) {
    console.error('Error handling removed installation:', error);
  }
}

async function handleRepositoriesAdded(installation, repositories, supabase) {
  console.log(`➕ Adding ${repositories.length} repositories to installation ${installation.id}`);
  
  try {
    for (const repo of repositories) {
      await trackRepository(repo, installation.id, supabase);
    }
    console.log(`✅ Added ${repositories.length} repositories`);
  } catch (error) {
    console.error('Error adding repositories:', error);
  }
}

async function handleRepositoriesRemoved(installation, repositories, supabase) {
  console.log(`➖ Removing ${repositories.length} repositories from installation ${installation.id}`);
  
  try {
    for (const repo of repositories) {
      // Mark repository as removed from installation
      const { error } = await supabase
        .from('installation_repositories')
        .update({
          removed_at: new Date().toISOString()
        })
        .eq('repository_id', repo.id)
        .eq('installation_id', installation.id);
        
      if (error) {
        console.error(`Error removing repository ${repo.full_name}:`, error);
      }
    }
    console.log(`✅ Removed ${repositories.length} repositories`);
  } catch (error) {
    console.error('Error removing repositories:', error);
  }
}

async function trackRepository(repo, installationId, supabase) {
  try {
    // Track the repository
    await supabase
      .from('repositories')
      .upsert({
        github_id: repo.id,
        owner: repo.owner?.login || repo.full_name.split('/')[0],
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        is_private: repo.private,
        html_url: repo.html_url || `https://github.com/${repo.full_name}`,
        created_at: repo.created_at,
        updated_at: repo.updated_at
      }, {
        onConflict: 'github_id'
      });
    
    // Track the installation-repository relationship
    await supabase
      .from('installation_repositories')
      .upsert({
        installation_id: installationId,
        repository_id: repo.id,
        added_at: new Date().toISOString()
      }, {
        onConflict: 'installation_id,repository_id'
      });
      
    console.log(`  ✅ Tracked repository ${repo.full_name}`);
  } catch (error) {
    console.error(`Error tracking repository ${repo.full_name}:`, error);
  }
}