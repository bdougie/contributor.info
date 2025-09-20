const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

/**
 * Health Tab Data Integrity Test Script
 * 
 * Tests the specific issues identified in health tab components:
 * 1. lottery-factor.tsx contributor.login showing 'unknown'
 * 2. Bot filtering logic inconsistencies  
 * 3. Data source mismatches
 * 
 * Usage: node scripts/test-health-tab-integrity.cjs
 */

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key] = value;
    }
  });
} else {
  console.log('Warning: .env.local not found, using system environment');
}

async function testHealthTabIntegrity() {
  console.log('🧪 Testing Health Tab Data Integrity');
  console.log('=====================================\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    console.log('📊 Testing lottery factor data source integrity...\n');

    // Test 1: First check what contributors exist
    console.log('1️⃣ Checking bot contributors in database...');
    
    const { data: botContributors, error: botError } = await supabase
      .from('contributors')
      .select('id, username, is_bot, github_id')
      .in('username', ['dependabot', 'github-actions', 'copilot-swe-agent', 'dependabot[bot]', 'github-actions[bot]'])
      .limit(10);

    if (botError) {
      console.error('❌ Error fetching bot contributors:', botError.message);
      return;
    }

    console.log(`   Found ${botContributors?.length || 0} bot contributors`);
    if (botContributors && botContributors.length > 0) {
      botContributors.forEach(contributor => {
        console.log(`      • ${contributor.username} (is_bot: ${contributor.is_bot})`);
      });
    }

    // Test 2: Get sample repository data
    console.log('\n2️⃣ Finding repositories with pull requests...');
    
    const { data: repos, error: reposError } = await supabase
      .from('repositories')
      .select('id, owner, name, full_name')
      .limit(3);

    if (reposError) {
      console.error('❌ Error fetching repositories:', reposError.message);
      return;
    }

    if (!repos || repos.length === 0) {
      console.log('ℹ️  No repositories found in database');
      return;
    }

    console.log(`   Found ${repos.length} repositories:`);
    repos.forEach(repo => {
      console.log(`      • ${repo.full_name}`);
    });

    // Test 3: For each repository, analyze pull request data
    for (const repo of repos) {
      console.log(`\n🔍 Testing repository: ${repo.full_name}`);
      console.log(`   Repository ID: ${repo.id}`);

      // Get pull requests for this repository
      const { data: pullRequests, error: prError } = await supabase
        .from('pull_requests')
        .select('id, number, state, merged_at, created_at, author_id')
        .eq('repository_id', repo.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (prError) {
        console.error(`   ❌ Error fetching PRs: ${prError.message}`);
        continue;
      }

      console.log(`   📈 Pull Requests found: ${pullRequests?.length || 0}`);

      if (!pullRequests || pullRequests.length === 0) {
        console.log('   ⚠️  No pull requests found for this repository');
        continue;
      }

      // Test 4: Get contributor details for these PRs
      const authorIds = pullRequests.map(pr => pr.author_id);
      const uniqueAuthorIds = [...new Set(authorIds)];

      const { data: contributors, error: contributorsError } = await supabase
        .from('contributors')
        .select('id, username, is_bot, avatar_url')
        .in('id', uniqueAuthorIds);

      if (contributorsError) {
        console.error(`   ❌ Error fetching contributors: ${contributorsError.message}`);
        continue;
      }

      console.log(`   👥 Unique contributors: ${contributors?.length || 0}`);

      if (!contributors || contributors.length === 0) {
        console.log('   ⚠️  No contributors found for these pull requests');
        continue;
      }

      // Test 5: Analyze bot detection issues
      console.log('   🤖 Bot Detection Analysis:');
      
      const botsByFlag = contributors.filter(c => c.is_bot === true);
      const knownBotPatterns = contributors.filter(c => 
        /\[bot\]$/i.test(c.username) || 
        /^dependabot/i.test(c.username) ||
        /^github-actions/i.test(c.username) ||
        /^copilot/i.test(c.username)
      );
      
      console.log(`      • Database is_bot=true: ${botsByFlag.length} accounts`);
      console.log(`      • Pattern-based bots: ${knownBotPatterns.length} accounts`);
      
      const mismatchedBots = knownBotPatterns.filter(c => c.is_bot !== true);
      console.log(`      • Mismatched (pattern=bot, is_bot≠true): ${mismatchedBots.length} accounts`);
      
      if (mismatchedBots.length > 0) {
        console.log('      📋 Mismatched Bot Accounts:');
        mismatchedBots.forEach(c => {
          console.log(`         - ${c.username} (is_bot: ${c.is_bot})`);
        });
      }

      // Test 6: Simulate lottery factor calculation issues
      console.log('   📊 Lottery Factor Data Simulation:');
      
      // Group by contributor (simulating aggregation)
      const contributorMap = new Map();
      pullRequests.forEach(pr => {
        const contributor = contributors.find(c => c.id === pr.author_id);
        if (contributor) {
          const login = contributor.username;
          if (!contributorMap.has(login)) {
            contributorMap.set(login, {
              login,
              is_bot: contributor.is_bot,
              pullRequests: 0,
              avatar_url: contributor.avatar_url
            });
          }
          contributorMap.get(login).pullRequests++;
        }
      });

      const contributorStats = Array.from(contributorMap.values())
        .sort((a, b) => b.pullRequests - a.pullRequests)
        .slice(0, 5);

      console.log(`      • Top contributors: ${contributorStats.length}`);
      
      // Test 7: Check for data integrity issues
      let integrityIssues = 0;
      
      contributorStats.forEach((contributor, index) => {
        const hasValidLogin = contributor.login && contributor.login.trim() !== '';
        const hasValidAvatar = contributor.avatar_url && contributor.avatar_url !== '';
        
        if (!hasValidLogin) {
          console.log(`      ❌ Issue #${++integrityIssues}: Contributor ${index + 1} has invalid/empty login`);
        }
        
        if (!hasValidAvatar) {
          console.log(`      ⚠️  Issue #${++integrityIssues}: Contributor ${index + 1} (${contributor.login}) missing avatar`);
        }

        // Test the filtering logic that causes issues
        const wouldBeFilteredByFlag = contributor.is_bot === true;
        const shouldBeFilteredByPattern = /\[bot\]$/i.test(contributor.login) || 
          /^dependabot/i.test(contributor.login) ||
          /^github-actions/i.test(contributor.login);
        
        if (shouldBeFilteredByPattern && !wouldBeFilteredByFlag) {
          console.log(`      🚨 Critical Issue #${++integrityIssues}: ${contributor.login} should be filtered as bot but is_bot=${contributor.is_bot}`);
        }

        console.log(`         ${index + 1}. ${contributor.login} (${contributor.pullRequests} PRs, is_bot: ${contributor.is_bot})`);
      });

      if (integrityIssues === 0) {
        console.log('      ✅ No data integrity issues detected');
      } else {
        console.log(`      ❌ Found ${integrityIssues} data integrity issues`);
      }
    }

    // Test 8: Check contributors table for correlation
    console.log('\n📋 Testing Contributors Table Correlation...');
    
    const { data: dbContributors, error: contributorsError } = await supabase
      .from('contributors')
      .select('id, username, is_bot, github_id')
      .in('username', ['dependabot', 'github-actions', 'copilot-swe-agent'])
      .limit(10);

    if (contributorsError) {
      console.error('❌ Error fetching contributors:', contributorsError.message);
    } else {
      console.log(`   Contributors table entries: ${dbContributors?.length || 0}`);
      
      if (dbContributors && dbContributors.length > 0) {
        console.log('   Known bot accounts in contributors table:');
        dbContributors.forEach(contributor => {
          console.log(`      • ${contributor.username} (is_bot: ${contributor.is_bot})`);
        });
      }
    }

    console.log('\n✅ Health Tab Integrity Test Complete');
    console.log('\n💡 Summary:');
    console.log('   This test simulates the exact data flow used by lottery-factor.tsx');
    console.log('   Any issues found explain why contributor.login shows "unknown"');
    console.log('   Bot filtering mismatches cause data lookup failures');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testHealthTabIntegrity().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { testHealthTabIntegrity };