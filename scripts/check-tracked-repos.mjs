import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndUpdateTrackedRepos() {
  console.log('📊 Checking tracked repositories...');
  
  // First, let's see what's in tracked_repositories
  const { data: tracked, error } = await supabase
    .from('tracked_repositories')
    .select(`
      id,
      repository_name,
      priority,
      size,
      last_updated,
      repositories (
        owner,
        name
      )
    `)
    .order('repository_name', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching tracked repositories:', error.message);
    return;
  }
  
  console.log(`\nFound ${tracked.length} tracked repositories:`);
  tracked.forEach(repo => {
    const repoInfo = repo.repositories;
    const repoPath = repoInfo ? `${repoInfo.owner}/${repoInfo.name}` : repo.repository_name;
    const lastUpdate = repo.last_updated ? new Date(repo.last_updated).toLocaleDateString() : 'never';
    console.log(`  • ${repoPath} (${repo.size || 'no size'}, priority: ${repo.priority || 'none'}, updated: ${lastUpdate})`);
  });
  
  // Check for our target repos and update them
  const targetRepos = [
    'continuedev/continue',
    'better-auth/better-auth', 
    'etcd-io/etcd',
    'argoproj/argo-cd',
    'pgvector/pgvector'
  ];
  
  console.log('\n🎯 Updating target repositories for refresh:');
  
  for (const repoPath of targetRepos) {
    const found = tracked.find(t => {
      if (t.repositories) {
        return `${t.repositories.owner}/${t.repositories.name}` === repoPath;
      }
      return t.repository_name === repoPath;
    });
    
    if (found) {
      console.log(`🚀 Updating ${repoPath}...`);
      
      const { error: updateError } = await supabase
        .from('tracked_repositories')
        .update({ 
          priority: 'high',
          last_updated: new Date().toISOString()
        })
        .eq('id', found.id);
      
      if (updateError) {
        console.error(`❌ Failed to update ${repoPath}:`, updateError.message);
      } else {
        console.log(`✅ Updated ${repoPath} to high priority`);
      }
    } else {
      console.log(`❌ ${repoPath} not found in tracked repositories`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  console.log('\n🎉 Finished updating tracked repositories!');
}

checkAndUpdateTrackedRepos().catch(console.error);