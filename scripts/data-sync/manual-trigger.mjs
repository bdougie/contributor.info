import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_ANON_KEY environment variable not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function triggerDataRefresh() {
  const repos = [
    'continuedev/continue',
    'better-auth/better-auth', 
    'etcd-io/etcd',
    'argoproj/argo-cd',
    'pgvector/pgvector'
  ];
  
  console.log('🔄 Triggering data refresh for stale repositories...');
  
  for (const repoPath of repos) {
    const [owner, name] = repoPath.split('/');
    
    console.log(`\n🚀 Processing ${owner}/${name}...`);
    
    try {
      // Check if repository exists in database
      const { data: repo, error } = await supabase
        .from('repositories')
        .select('id, size')
        .eq('owner', owner)
        .eq('name', name)
        .single();
      
      if (error || !repo) {
        console.log(`⚠️ Repository ${owner}/${name} not found in database`);
        continue;
      }
      
      // Update last_data_update to mark it for refresh
      const { error: updateError } = await supabase
        .from('tracked_repositories')
        .update({ 
          last_updated: new Date().toISOString(),
          priority: 'high'
        })
        .eq('repository_id', repo.id);
      
      if (updateError) {
        console.error(`❌ Failed to update ${owner}/${name}:`, updateError.message);
      } else {
        console.log(`✅ Marked ${owner}/${name} for high-priority refresh (size: ${repo.size || 'unknown'})`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${owner}/${name}:`, error.message);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n🎉 All repositories marked for refresh!');
  console.log('📊 The progressive capture system will automatically process these in the background.');
}

triggerDataRefresh().catch(console.error);