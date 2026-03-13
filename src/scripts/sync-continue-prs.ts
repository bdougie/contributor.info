import { supabase } from '@/lib/supabase';

async function syncContinuePRs() {
  console.log('🔄 Local sync for continuedev/continue PRs #8164 and #8166');

  // Get the repository ID
  const { data: repoData, error: repoError } = await supabase
    .from('repositories')
    .select('id')
    .eq('full_name', 'continuedev/continue')
    .maybeSingle();

  if (repoError || !repoData) {
    console.error('❌ Repository not found:', repoError);
    return;
  }

  const repoId = repoData.id;
  console.log('✅ Found repository: %s', repoId);

  // Fetch PRs from GitHub
  console.log('🔄 Fetching PRs from GitHub API...');
  const response = await fetch(
    'https://api.github.com/repos/continuedev/continue/pulls?state=all&per_page=30&sort=created&direction=desc',
    {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'contributor.info',
      },
    }
  );

  interface GitHubPR {
    id: number;
    number: number;
    title: string;
    body?: string;
    state: string;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    merged_at?: string;
    draft?: boolean;
    additions?: number;
    deletions?: number;
    changed_files?: number;
    commits?: number;
    html_url: string;
    base?: { ref: string };
    head?: { ref: string };
    user: {
      id: number;
      login: string;
      avatar_url?: string;
    };
  }

  const prs = (await response.json()) as GitHubPR[];

  // Filter for PRs #8164 and #8166
  const targetPRs = prs.filter((pr) => pr.number === 8164 || pr.number === 8166);

  if (targetPRs.length === 0) {
    console.error('❌ PRs #8164 and #8166 not found in GitHub API response');
    return;
  }

  console.log('✅ Found %s PRs to insert', targetPRs.length);

  for (const pr of targetPRs) {
    console.log('\n📝 Processing PR #%s: %s', pr.number, pr.title);

    // First ensure the contributor exists
    let contributorId = null;
    if (pr.user && pr.user.id) {
      const { data: contribData } = await supabase
        .from('contributors')
        .upsert(
          {
            github_id: pr.user.id.toString(),
            username: pr.user.login,
            avatar_url: pr.user.avatar_url,
          },
          {
            onConflict: 'github_id',
          }
        )
        .select('id')
        .maybeSingle();

      if (contribData) {
        contributorId = contribData.id;
        console.log('  ✅ Contributor: %s (%s)', pr.user.login, contributorId);
      }
    }

    // Prepare PR data matching the exact schema
    const prData = {
      number: pr.number,
      github_id: pr.id.toString(),
      repository_id: repoId,
      repository_full_name: 'continuedev/continue',
      title: pr.title,
      body: pr.body || '',
      state: pr.state,
      author_id: contributorId,
      author_login: pr.user?.login,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changed_files: pr.changed_files || 0,
      commits: pr.commits || 0,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at,
      merged_at: pr.merged_at,
      draft: pr.draft || false,
      base_branch: pr.base?.ref || 'main',
      head_branch: pr.head?.ref || 'unknown',
      html_url: pr.html_url,
      last_synced_at: new Date().toISOString(),
    };

    console.log('  📅 Created: %s', pr.created_at);
    console.log('  🔧 State: %s', pr.state);
    console.log('  🆔 GitHub ID: %s', pr.id);

    // Insert/update the PR
    const { error } = await supabase.from('pull_requests').upsert(prData, {
      onConflict: 'github_id',
    });

    if (error) {
      console.error('  ❌ Failed to insert PR #%s:', pr.number, error);
    } else {
      console.log('  ✅ Successfully upserted PR #%s', pr.number);
    }
  }

  // Verify the PRs are in the database
  console.log('\n🔍 Verifying PRs in database...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('pull_requests')
    .select('number, title, created_at, github_id')
    .eq('repository_id', repoId)
    .in('number', [8164, 8166]);

  if (verifyData && verifyData.length > 0) {
    console.log('✅ PRs in database:');
    verifyData.forEach((pr) => {
      console.log('  PR #%s: %s', pr.number, pr.title);
      console.log('    Created: %s', pr.created_at);
      console.log('    GitHub ID: %s', pr.github_id);
    });
  } else {
    console.log('❌ PRs not found in database');
    if (verifyError) {
      console.error('Verify error:', verifyError);
    }
  }
}

// Run the sync
syncContinuePRs()
  .then(() => {
    console.log('\n✅ Local sync complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  });
