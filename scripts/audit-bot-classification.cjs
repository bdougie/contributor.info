const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

/**
 * Bot Classification Audit Script (CommonJS)
 * 
 * Comprehensive bot detection audit using pattern-based searching.
 * Uses only public read access via anon key for database queries.
 * 
 * Usage:
 *   node scripts/audit-bot-classification.cjs
 * 
 * Requirements:
 *   - .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
 *   - Node.js with @supabase/supabase-js installed
 * 
 * Features:
 * - 35+ bot detection patterns
 * - 31 search patterns for database scanning
 * - Misclassification detection and reporting
 * - SQL fix generation
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

// Bot detection patterns - enhanced based on findings
const KNOWN_BOT_PATTERNS = [
  /\[bot\]$/i,                    // Most reliable: [bot] suffix
  /^dependabot/i,
  /^renovate/i,
  /^github-actions/i,
  /^copilot/i,                    // GitHub Copilot
  /-bot$/i,                       // ends with -bot
  /^.*-bot$/i,                    // any prefix followed by -bot
  /^.*bot$/i,                     // ends with bot (but not [bot])
  /^codecov/i,
  /^allcontributors/i,
  /^imgbot/i,
  /^semantic-release-bot/i,
  /^snyk-bot/i,
  /^snyk/i,                       // Snyk bots
  /^whitesource/i,
  /^pyup-bot/i,
  /^pyup/i,                       // PyUp bots
  /^stale/i,
  /^weblate/i,
  /^crowdin/i,
  /^linguist/i,
  /^sourcery-ai/i,
  /^sourcery/i,                   // Sourcery bots
  /^deepsource/i,
  /^gitpod-io/i,
  /^gitpod/i,                     // Gitpod bots
  /^codesandbox/i,
  /^netlify/i,
  /^vercel/i,
  /^houndci/i,
  /^codeclimate/i,
  /^sonarcloud/i,
  /^depfu/i,
  /^security/i,
  /^lgtm-com/i,
  /^lgtm/i,                       // LGTM bots
  /^pullrequest/i,
  /^auto-merge/i,
  /^merge-me/i,
  /^auto-fix/i,
  /^auto/i,                       // Auto bots
  /-ci$/i,
  /^ci-/i
];

function detectBot(contributor) {
  // Check username patterns for what SHOULD be classified
  const username = contributor.username || '';
  
  for (const pattern of KNOWN_BOT_PATTERNS) {
    if (pattern.test(username)) {
      return { isBot: true, reason: `Pattern match: ${pattern}` };
    }
  }

  return { isBot: false, reason: 'No bot indicators' };
}

async function runAudit() {
  console.log('🔍 Starting Comprehensive Bot Classification Audit');
  console.log('==================================================\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('❌ VITE_SUPABASE_URL is required');
    process.exit(1);
  }

  if (!supabaseAnonKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY is required');
    process.exit(1);
  }

  console.log('📝 Environment check:');
  console.log(`   URL: ${supabaseUrl}`);
  console.log(`   Key: ${supabaseAnonKey.substring(0, 20)}...`);
  console.log();

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  try {
    console.log('📊 Running comprehensive pattern-based audit...');
    
    // Define search patterns for each known bot type
    const botSearchPatterns = [
      { pattern: 'dependabot%', name: 'Dependabot' },
      { pattern: 'renovate%', name: 'Renovate' },
      { pattern: 'github-actions%', name: 'GitHub Actions' },
      { pattern: 'copilot%', name: 'GitHub Copilot' },
      { pattern: '%[bot]', name: '[bot] suffix' },
      { pattern: '%bot%', name: 'General bot' },
      { pattern: 'codecov%', name: 'Codecov' },
      { pattern: 'allcontributors%', name: 'All Contributors' },
      { pattern: 'imgbot%', name: 'ImgBot' },
      { pattern: 'snyk%', name: 'Snyk' },
      { pattern: 'whitesource%', name: 'WhiteSource' },
      { pattern: 'pyup%', name: 'PyUp' },
      { pattern: 'stale%', name: 'Stale Bot' },
      { pattern: 'weblate%', name: 'Weblate' },
      { pattern: 'crowdin%', name: 'Crowdin' },
      { pattern: 'linguist%', name: 'Linguist' },
      { pattern: 'sourcery%', name: 'Sourcery' },
      { pattern: 'deepsource%', name: 'DeepSource' },
      { pattern: 'gitpod%', name: 'Gitpod' },
      { pattern: 'codesandbox%', name: 'CodeSandbox' },
      { pattern: 'netlify%', name: 'Netlify' },
      { pattern: 'vercel%', name: 'Vercel' },
      { pattern: 'houndci%', name: 'Hound CI' },
      { pattern: 'codeclimate%', name: 'Code Climate' },
      { pattern: 'sonarcloud%', name: 'SonarCloud' },
      { pattern: 'depfu%', name: 'Depfu' },
      { pattern: '%security%', name: 'Security bots' },
      { pattern: 'lgtm%', name: 'LGTM' },
      { pattern: '%auto%', name: 'Auto bots' },
      { pattern: '%-ci', name: 'CI suffix' },
      { pattern: 'ci-%', name: 'CI prefix' }
    ];

    const allMisclassifications = [];
    let totalChecked = 0;
    let totalBotPatternMatches = 0;

    for (const searchPattern of botSearchPatterns) {
      console.log(`  Checking ${searchPattern.name} (${searchPattern.pattern})...`);
      
      const { data: patternMatches, error } = await supabase
        .from('contributors')
        .select('id, username, is_bot')
        .ilike('username', searchPattern.pattern)
        .limit(50); // Reasonable limit per pattern

      if (error) {
        console.error(`    ❌ Error: ${error.message}`);
        continue;
      }

      if (patternMatches && patternMatches.length > 0) {
        console.log(`    Found ${patternMatches.length} matches`);
        totalBotPatternMatches += patternMatches.length;
        
        patternMatches.forEach(user => {
          const detection = detectBot(user);
          const isMismatch = detection.isBot !== (user.is_bot === true);
          
          if (isMismatch) {
            // Check if we already have this user to avoid duplicates
            const existing = allMisclassifications.find(m => m.username === user.username);
            if (!existing) {
              allMisclassifications.push({
                username: user.username,
                current: user.is_bot ? 'bot' : 'human',
                should_be: detection.isBot ? 'bot' : 'human',
                reason: detection.reason,
                pattern: searchPattern.name
              });
            }
          }
          
          const status = isMismatch ? '⚠️  MISMATCH' : '✅';
          console.log(`      • ${user.username} (is_bot: ${user.is_bot}) → should be ${detection.isBot ? 'bot' : 'human'} ${status}`);
        });
      } else {
        console.log(`    No matches found`);
      }
      
      totalChecked += patternMatches?.length || 0;
    }

    console.log(`\n📊 Pattern Search Summary:`);
    console.log(`Total contributors checked: ${totalChecked}`);
    console.log(`Total bot-like patterns found: ${totalBotPatternMatches}`);
    console.log(`Total misclassifications found: ${allMisclassifications.length}`);
    console.log();

    // Get general statistics
    console.log('📈 Getting overall statistics...');
    const { count: totalCount } = await supabase
      .from('contributors')
      .select('*', { count: 'exact', head: true });

    const { count: botCount } = await supabase
      .from('contributors')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot', true);

    const { count: humanCount } = await supabase
      .from('contributors')
      .select('*', { count: 'exact', head: true })
      .eq('is_bot', false);

    const { count: nullCount } = await supabase
      .from('contributors')
      .select('*', { count: 'exact', head: true })
      .is('is_bot', null);

    console.log('📈 Database Statistics:');
    console.log('=======================');
    console.log(`Total contributors: ${totalCount}`);
    console.log(`Marked as bots: ${botCount}`);
    console.log(`Marked as humans: ${humanCount}`);
    console.log(`Unclassified (null): ${nullCount}`);
    console.log();

    console.log('⚠️  COMPREHENSIVE MISCLASSIFICATION REPORT:');
    console.log('==========================================');
    if (allMisclassifications.length > 0) {
      console.log(`Found ${allMisclassifications.length} total misclassified contributors:\n`);
      
      // Group by pattern for better reporting
      const byPattern = {};
      allMisclassifications.forEach(item => {
        if (!byPattern[item.pattern]) {
          byPattern[item.pattern] = [];
        }
        byPattern[item.pattern].push(item);
      });

      Object.keys(byPattern).forEach(pattern => {
        console.log(`📋 ${pattern} Pattern (${byPattern[pattern].length} issues):`)
        byPattern[pattern].forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.username}`);
          console.log(`     Currently: ${item.current}`);
          console.log(`     Should be: ${item.should_be}`);
          console.log(`     Reason: ${item.reason}`);
        });
        console.log();
      });

      console.log('🔧 IMPACT: These misclassifications would cause:');
      console.log('   • Bots to appear in health/activity tabs as human contributors');
      console.log('   • Skewed contributor statistics');  
      console.log('   • Misleading project health metrics');
      console.log();
      
      console.log('💡 SQL UPDATE NEEDED:');
      const usernames = allMisclassifications.map(m => `'${m.username}'`).join(', ');
      console.log(`UPDATE contributors SET is_bot = true WHERE username IN (${usernames});`);
      console.log();
      
      console.log(`📊 SUMMARY: ${allMisclassifications.length} out of ${totalChecked} checked contributors need correction`);
      console.log(`📊 IMPACT SCALE: ${((allMisclassifications.length / totalCount) * 100).toFixed(2)}% of total database affected`);
      
    } else {
      console.log('✅ No misclassifications found in the comprehensive audit!');
    }

    console.log('\n✅ Comprehensive audit completed successfully');
    console.log('\n💡 This comprehensive audit checks all major bot patterns');
    console.log('   and should catch the vast majority of misclassifications.');

    // Return results for further processing
    return {
      totalChecked,
      totalMisclassifications: allMisclassifications.length,
      misclassifications: allMisclassifications,
      databaseStats: { totalCount, botCount, humanCount, nullCount }
    };

  } catch (error) {
    console.error('❌ Audit failed:', error.message);
    throw error;
  }
}

// Run the audit
if (require.main === module) {
  runAudit().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { runAudit, detectBot };