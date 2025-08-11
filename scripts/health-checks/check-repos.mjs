import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRepositories() {
  console.log('📊 Checking repositories in database...');
  
  const { data: repos, error } = await supabase
    .from('repositories')
    .select('owner, name, size')
    .order('owner', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching repositories:', error.message);
    return;
  }
  
  console.log(`\n Found ${repos.length} repositories:`);
  repos.forEach(repo => {
    console.log(`  • ${repo.owner}/${repo.name} (${repo.size || 'no size'})`);
  });
  
  // Check specifically for our target repos
  const targetRepos = [
    'continuedev/continue',
    'better-auth/better-auth', 
    'etcd-io/etcd',
    'argoproj/argo-cd',
    'pgvector/pgvector'
  ];
  
  console.log('\n🎯 Checking target repositories:');
  for (const repoPath of targetRepos) {
    const [owner, name] = repoPath.split('/');
    const found = repos.find(r => r.owner === owner && r.name === name);
    console.log(`  ${found ? '✅' : '❌'} ${repoPath}${found ? ` (${found.size || 'no size'})` : ''}`);
  }
}

checkRepositories().catch(console.error);