#!/usr/bin/env tsx
/**
 * Emergency script to fix missing subscription records
 * This syncs workspace tiers with subscription records
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixSubscriptions() {
  console.log('🔧 Starting subscription fix...\n');

  try {
    // 1. Find all workspaces with paid tiers but no subscriptions
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select(
        `
        id,
        name,
        tier,
        owner_id,
        created_at,
        updated_at
      `
      )
      .in('tier', ['pro', 'team', 'enterprise'])
      .order('created_at', { ascending: false });

    if (workspaceError) {
      console.error('❌ Error fetching workspaces:', workspaceError);
      return;
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('✅ No workspaces with paid tiers found');
      return;
    }

    console.log(`Found ${workspaces.length} workspace(s) with paid tiers\n`);

    // 2. Check each workspace owner's subscription status
    for (const workspace of workspaces) {
      console.log(`\n📦 Processing workspace: ${workspace.name} (${workspace.tier})`);
      console.log(`   Owner ID: ${workspace.owner_id}`);

      // Check if subscription exists
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', workspace.owner_id)
        .maybeSingle();

      if (subError && subError.code !== 'PGRST116') {
        console.error(`   ❌ Error checking subscription:`, subError);
        continue;
      }

      if (!subscription) {
        console.log(`   ⚠️  No subscription found - creating one...`);

        // Create subscription record based on workspace tier
        const newSubscription = {
          user_id: workspace.owner_id,
          tier: workspace.tier,
          status: 'active', // Assuming active since they have a paid workspace
          max_workspaces: workspace.tier === 'team' ? 3 : 1,
          max_repos_per_workspace: 3,
          created_at: workspace.created_at,
          updated_at: new Date().toISOString(),
          // Note: We're not setting polar_subscription_id since we don't have it
          // This will need to be updated when the webhook fires
        };

        const { error: createError } = await supabase
          .from('subscriptions')
          .insert(newSubscription)
          .select()
          .maybeSingle();

        if (createError) {
          console.error(`   ❌ Failed to create subscription:`, createError);
        } else {
          console.log(`   ✅ Created subscription with tier: ${workspace.tier}`);
        }
      } else {
        // Check if subscription tier matches workspace tier
        if (subscription.tier !== workspace.tier) {
          console.log(
            `   ⚠️  Tier mismatch! Subscription: ${subscription.tier}, Workspace: ${workspace.tier}`
          );
          console.log(`   🔄 Updating subscription to match workspace tier...`);

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              tier: workspace.tier,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', workspace.owner_id);

          if (updateError) {
            console.error(`   ❌ Failed to update subscription:`, updateError);
          } else {
            console.log(`   ✅ Updated subscription tier to: ${workspace.tier}`);
          }
        } else {
          console.log(`   ✅ Subscription exists and matches (${subscription.tier})`);
        }
      }
    }

    console.log('\n✅ Subscription fix complete!');

    // 3. Show summary
    const { data: summary, error: summaryError } = await supabase
      .from('subscriptions')
      .select('tier', { count: 'exact' })
      .neq('tier', 'free');

    if (!summaryError && summary) {
      console.log('\n📊 Subscription Summary:');
      const tierCounts: Record<string, number> = {};
      summary.forEach((sub) => {
        tierCounts[sub.tier] = (tierCounts[sub.tier] || 0) + 1;
      });
      Object.entries(tierCounts).forEach(([tier, count]) => {
        console.log(`   ${tier}: ${count} subscription(s)`);
      });
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixSubscriptions()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
