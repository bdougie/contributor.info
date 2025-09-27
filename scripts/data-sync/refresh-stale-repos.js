// Script to refresh stale example repositories
// Run this in browser console when app is loaded

async function refreshStaleRepos() {
  const staleRepos = [
    'continuedev/continue',
    'better-auth/better-auth',
    'etcd-io/etcd',
    'argoproj/argo-cd',
    'pgvector/pgvector',
  ];

  console.log('🔄 Starting refresh for stale repositories...');

  for (const repo of staleRepos) {
    const [owner, name] = repo.split('/');
    console.log(`\n🚀 Triggering refresh for ${repo}...`);

    try {
      await ProgressiveCapture.quickFix(owner, name);
      console.log(`✅ Queued refresh for ${repo}`);
    } catch (error) {
      console.error(`❌ Failed to queue ${repo}:`, error);
    }

    // Small delay between requests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n🎉 All stale repositories queued for refresh!');
  console.log('📊 Check status with: ProgressiveCapture.status()');
}

// Auto-run if ProgressiveCapture is available
if (typeof ProgressiveCapture !== 'undefined') {
  refreshStaleRepos();
} else {
  console.log('ProgressiveCapture not yet available. Run refreshStaleRepos() manually when ready.');
}
