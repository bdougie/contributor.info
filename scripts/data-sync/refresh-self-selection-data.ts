#!/usr/bin/env tsx

/**
 * Script to refresh self-selection rate data
 * 
 * This script:
 * 1. Refreshes the repository_contribution_stats materialized view
 * 2. Shows repositories that have confidence data but no self-selection data
 * 3. Provides insights into data coverage
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://egcxzonpmmcirmgqdrla.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_TOKEN;

if (!supabaseServiceKey) {
  console.error('❌ SUPABASE_TOKEN environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function refreshSelfSelectionData() {
  console.log('🔄 Refreshing self-selection rate data...\n');

  try {
    // 1. Get current stats before refresh
    console.log('📊 Current statistics:');
    const { data: beforeStats } = await supabase
      .from('repository_contribution_stats')
      .select('repository_owner, repository_name')
      .limit(1000);
    
    console.log(`   • Repositories with self-selection data: ${beforeStats?.length || 0}`);

    // 2. Refresh the materialized view
    console.log('\n🔄 Refreshing materialized view...');
    const { error: refreshError } = await supabase.rpc('refresh_contribution_stats');
    
    if (refreshError) {
      console.error('❌ Error refreshing materialized view:', refreshError.message);
      return;
    }
    
    console.log('✅ Materialized view refreshed successfully');

    // 3. Get updated stats
    const { data: afterStats } = await supabase
      .from('repository_contribution_stats')
      .select('repository_owner, repository_name')
      .limit(1000);
    
    console.log(`   • Repositories with self-selection data: ${afterStats?.length || 0}`);

    // 4. Check for repositories with confidence but no self-selection data
    console.log('\n🔍 Checking for repositories missing self-selection data...');
    
    const { data: missingData } = await supabase.rpc('execute_sql', {
      query: `
        WITH confidence_repos AS (
          SELECT DISTINCT repository_owner, repository_name 
          FROM contributor_roles 
          WHERE role = 'contributor'
        ),
        self_selection_repos AS (
          SELECT DISTINCT repository_owner, repository_name 
          FROM repository_contribution_stats
        )
        SELECT 
          cr.repository_owner, 
          cr.repository_name,
          'missing_self_selection' as reason
        FROM confidence_repos cr
        LEFT JOIN self_selection_repos sr 
          ON cr.repository_owner = sr.repository_owner 
          AND cr.repository_name = sr.repository_name
        WHERE sr.repository_owner IS NULL
      `
    });

    if (missingData && missingData.length > 0) {
      console.log(`⚠️  Found ${missingData.length} repositories with confidence data but no self-selection data:`);
      missingData.forEach((repo: { repository_owner: string; repository_name: string }) => {
        console.log(`   • ${repo.repository_owner}/${repo.repository_name}`);
      });
      console.log('\nℹ️  This is normal for repositories that have GitHub events but no pull request data.');
    } else {
      console.log('✅ All repositories with confidence data also have self-selection data');
    }

    // 5. Show sample self-selection rates
    console.log('\n📈 Sample self-selection rates:');
    const { data: sampleData } = await supabase
      .rpc('get_repository_confidence_summary_simple')
      .limit(5);

    if (sampleData) {
      sampleData.forEach((repo: { repository_owner: string; repository_name: string; self_selection_rate: number }) => {
        console.log(`   • ${repo.repository_owner}/${repo.repository_name}: ${repo.self_selection_rate}%`);
      });
    }

    // 6. Provide summary
    console.log('\n📊 Summary:');
    const { data: totalRepos } = await supabase
      .from('contributor_roles')
      .select('repository_owner, repository_name', { count: 'exact' })
      .eq('role', 'contributor');

    const totalWithSelfSelection = afterStats?.length || 0;
    const coverage = totalRepos?.length ? ((totalWithSelfSelection / totalRepos.length) * 100).toFixed(1) : '0';
    
    console.log(`   • Total repositories with confidence data: ${totalRepos?.length || 0}`);
    console.log(`   • Repositories with self-selection data: ${totalWithSelfSelection}`);
    console.log(`   • Coverage: ${coverage}%`);

    console.log('\n✅ Self-selection data refresh completed!');
    console.log('\nℹ️  The confidence analytics dashboard will now show updated self-selection rates.');

  } catch (error) {
    console.error('❌ Error during refresh:', error);
    process.exit(1);
  }
}

// Allow running via CLI or importing
if (import.meta.url === `file://${process.argv[1]}`) {
  refreshSelfSelectionData().then(() => process.exit(0));
}

export { refreshSelfSelectionData };