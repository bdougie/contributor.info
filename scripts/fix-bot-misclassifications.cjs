const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

/**
 * Safe Bot Misclassification Fix Script
 * Fixes the 46 misclassified bot accounts found in comprehensive audit
 */

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        const value = trimmedLine.substring(equalIndex + 1).trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  });
} else {
  console.log('Warning: .env.local not found, using system environment');
}

// The 46 misclassified bot accounts from comprehensive audit
const MISCLASSIFIED_BOTS = [
  'dependabot',
  'github-actions', 
  'copilot-swe-agent',
  'angular-automatic-lock-bot[bot]',
  'meta-cla[bot]',
  'alerting-team[bot]',
  'microsoft-github-policy-service[bot]',
  'tiprow[bot]',
  'pull-checklist[bot]',
  'google-ml-butler[bot]',
  'welcome[bot]',
  'openhands-ai[bot]',
  'gitguardian[bot]',
  'bunnyshell[bot]',
  'ellipsis-dev[bot]',
  'cursor[bot]',
  'changeset-bot[bot]',
  'pingcap-cla-assistant[bot]',
  'ngbot[bot]',
  'dosubot[bot]',
  'sentry-io[bot]',
  'vs-code-engineering[bot]',
  'open-swe[bot]',
  'claude[bot]',
  'grafana-pr-approver[bot]',
  'ti-chi-bot[bot]',
  'coderabbitai[bot]',
  'github-merge-queue[bot]',
  'microsoft-github-operations[bot]',
  'rust-bors[bot]',
  'jsf-clabot',
  'b-bot',
  'nextjs-bot',
  'vercel-release-bot',
  'gcp-cherry-pick-bot',
  'askdevai-bot',
  'k8s-infra-cherrypick-robot',
  'sre-bot',
  'pytorchbot',
  'erdenekhuu-bot',
  'react-sizebot',
  'ti-chi-bot',
  'codecov-commenter',
  'codecov-io',
  'netlify',
  'pre-commit-ci'
];

async function fixMisclassifications() {
  console.log('🔧 Starting Bot Misclassification Fix');
  console.log('=====================================\n');

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TOKEN;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  console.log('🔍 Environment check:');
  console.log('   URL:', supabaseUrl);
  console.log('   Service Key loaded:', !!supabaseServiceKey);
  console.log('   Anon Key loaded:', !!supabaseAnonKey);

  if (!supabaseUrl) {
    console.error('❌ Missing VITE_SUPABASE_URL');
    process.exit(1);
  }

  // Try service role key first, fallback to anon key
  let supabase;
  let useServiceRole = false;
  
  if (supabaseServiceKey) {
    console.log('🔑 Attempting connection with service role key...');
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Test the connection
    try {
      const { data: testData, error: testError } = await supabase
        .from('contributors')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.log('⚠️  Service role key failed, trying anon key...');
        console.log('   Error:', testError.message);
      } else {
        useServiceRole = true;
        console.log('✅ Service role key working');
      }
    } catch (err) {
      console.log('⚠️  Service role key failed, trying anon key...');
      console.log('   Error:', err.message);
    }
  }

  if (!useServiceRole) {
    if (!supabaseAnonKey) {
      console.error('❌ No working authentication keys available');
      process.exit(1);
    }
    console.log('🔑 Using anon key (read-only operations)...');
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  try {
    console.log(`📋 Planning to fix ${MISCLASSIFIED_BOTS.length} misclassified bot accounts`);
    console.log('🔍 Step 1: Verification - checking current state...\n');

    // First, verify current state
    const { data: currentStates, error: fetchError } = await supabase
      .from('contributors')
      .select('username, is_bot')
      .in('username', MISCLASSIFIED_BOTS);

    if (fetchError) {
      console.error('❌ Error fetching current states:', fetchError.message);
      throw fetchError;
    }

    console.log('📊 Current Classification Status:');
    const foundAccounts = currentStates || [];
    const missingAccounts = MISCLASSIFIED_BOTS.filter(
      username => !foundAccounts.find(acc => acc.username === username)
    );

    foundAccounts.forEach((account, index) => {
      const status = account.is_bot ? '🤖 BOT' : '👤 HUMAN';
      const needsFix = !account.is_bot ? ' ⚠️  NEEDS FIX' : ' ✅ CORRECT';
      console.log(`  ${index + 1}. ${account.username} → ${status}${needsFix}`);
    });

    if (missingAccounts.length > 0) {
      console.log(`\n⚠️  Missing accounts (${missingAccounts.length}):`, missingAccounts);
    }

    const accountsNeedingFix = foundAccounts.filter(acc => !acc.is_bot);
    console.log(`\n📊 Summary:`);
    console.log(`   Total target accounts: ${MISCLASSIFIED_BOTS.length}`);
    console.log(`   Found in database: ${foundAccounts.length}`);
    console.log(`   Actually need fixing: ${accountsNeedingFix.length}`);
    console.log(`   Missing from database: ${missingAccounts.length}`);

    if (accountsNeedingFix.length === 0) {
      console.log('\n✅ All accounts are already correctly classified as bots!');
      console.log('   No database updates needed.');
      return { success: true, updatedCount: 0 };
    }

    console.log('\n🔧 Step 2: Applying fixes...');
    
    // Update only the accounts that actually need fixing
    const usernamesToFix = accountsNeedingFix.map(acc => acc.username);
    
    console.log(`   Updating ${usernamesToFix.length} accounts to is_bot = true`);
    console.log(`   Accounts: ${usernamesToFix.join(', ')}`);

    if (!useServiceRole) {
      console.log('\n⚠️  Read-only access detected. Cannot perform automatic updates.');
      console.log('   Please run the following SQL command in your Supabase Dashboard:');
      console.log('\n📋 SQL Command to fix bot misclassifications:');
      console.log('```sql');
      const sqlUsernames = usernamesToFix.map(u => `'${u}'`).join(', ');
      console.log(`UPDATE contributors SET is_bot = true WHERE username IN (${sqlUsernames});`);
      console.log('```');
      console.log('\n🔗 Supabase Dashboard SQL Editor:');
      console.log('   https://app.supabase.com/project/egcxzonpmmcirmgqdrla/sql');
      
      return { 
        success: true, 
        updatedCount: 0,
        requiresManualFix: true,
        sqlCommand: `UPDATE contributors SET is_bot = true WHERE username IN (${sqlUsernames});`,
        accountsToFix: usernamesToFix
      };
    }

    const { data: updateResults, error: updateError } = await supabase
      .from('contributors')
      .update({ is_bot: true })
      .in('username', usernamesToFix)
      .select('username, is_bot');

    if (updateError) {
      console.error('❌ Error updating accounts:', updateError.message);
      console.log('\n📋 Fallback SQL Command:');
      console.log('```sql');
      const sqlUsernames = usernamesToFix.map(u => `'${u}'`).join(', ');
      console.log(`UPDATE contributors SET is_bot = true WHERE username IN (${sqlUsernames});`);
      console.log('```');
      throw updateError;
    }

    console.log('\n✅ Step 3: Verification - checking updated state...');
    
    // Verify the updates
    const { data: verificationData, error: verifyError } = await supabase
      .from('contributors')
      .select('username, is_bot')
      .in('username', usernamesToFix);

    if (verifyError) {
      console.error('❌ Error verifying updates:', verifyError.message);
      throw verifyError;
    }

    const successfulUpdates = verificationData?.filter(acc => acc.is_bot) || [];
    const failedUpdates = verificationData?.filter(acc => !acc.is_bot) || [];

    console.log(`\n📊 Update Results:`);
    console.log(`   ✅ Successfully updated: ${successfulUpdates.length}`);
    console.log(`   ❌ Failed to update: ${failedUpdates.length}`);

    if (successfulUpdates.length > 0) {
      console.log('\n✅ Successfully fixed accounts:');
      successfulUpdates.forEach((acc, index) => {
        console.log(`   ${index + 1}. ${acc.username} → 🤖 BOT`);
      });
    }

    if (failedUpdates.length > 0) {
      console.log('\n❌ Failed to fix accounts:');
      failedUpdates.forEach((acc, index) => {
        console.log(`   ${index + 1}. ${acc.username} → still marked as human`);
      });
    }

    console.log('\n🎯 IMPACT ASSESSMENT:');
    console.log(`   • Fixed ${successfulUpdates.length} bot accounts`);
    console.log(`   • These accounts will now be properly excluded from health/activity tabs`);
    console.log(`   • Contributor statistics will be more accurate`);
    console.log(`   • Project health metrics will show correct human contributor counts`);

    console.log('\n✅ Bot misclassification fix completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Test the health and activity tabs to verify bots are filtered out');
    console.log('   2. Update data ingestion pipeline to use centralized bot detection');
    console.log('   3. Monitor for future misclassifications');

    return { 
      success: true, 
      updatedCount: successfulUpdates.length,
      failedCount: failedUpdates.length,
      totalTargeted: MISCLASSIFIED_BOTS.length 
    };

  } catch (error) {
    console.error('❌ Fix script failed:', error.message);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixMisclassifications().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

module.exports = { fixMisclassifications, MISCLASSIFIED_BOTS };