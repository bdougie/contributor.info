import { ProgressiveCaptureTrigger } from './src/lib/progressive-capture/manual-trigger.js';

async function refreshRepos() {
  const repos = [
    ['continuedev', 'continue'],
    ['better-auth', 'better-auth'], 
    ['etcd-io', 'etcd'],
    ['argoproj', 'argo-cd'],
    ['pgvector', 'pgvector']
  ];
  
  console.log('🔄 Refreshing stale example repositories...');
  
  for (const [owner, repo] of repos) {
    console.log(`\n🚀 Triggering refresh for ${owner}/${repo}...`);
    try {
      await ProgressiveCaptureTrigger.quickFix(owner, repo);
      console.log(`✅ Queued refresh for ${owner}/${repo}`);
    } catch (error) {
      console.error(`❌ Failed to queue ${owner}/${repo}:`, error.message);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎉 All repositories queued for refresh!');
}

refreshRepos().catch(console.error);