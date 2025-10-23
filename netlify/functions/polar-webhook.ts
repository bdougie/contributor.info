import { Handler } from '@netlify/functions';
import { Webhooks } from '@polar-sh/nextjs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase';
import { WorkspaceBackfillService } from '../../src/services/workspace-backfill.service';

// Polar addon product IDs
const POLAR_ADDON_PRODUCT_IDS = {
  EXTENDED_DATA_RETENTION:
    process.env.POLAR_PRODUCT_ID_EXTENDED_RETENTION || '65248b4b-20d8-4ad0-95c2-c39f80dc4d18',
};

// Initialize Supabase client with service role for webhook operations
// Note: Environment variables are validated at runtime in the handler
const supabase = createClient<Database>(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Trigger workspace backfill for a user's workspaces when addon is purchased
 */
async function triggerWorkspaceBackfill(
  userId: string,
  subscriptionId: string,
  addonProductId: string,
  retentionDays: number = 365
) {
  try {
    console.log('Triggering workspace backfill for user: %s', userId);

    // Get all workspaces owned by this user
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('owner_id', userId);

    if (workspacesError) {
      console.error('Error fetching workspaces:', workspacesError);
      return;
    }

    if (!workspaces || workspaces.length === 0) {
      console.log('No workspaces found for user: %s', userId);
      return;
    }

    console.log('Found %d workspaces for user %s', workspaces.length, userId);

    // Get the addon record
    const { data: addon } = await supabase
      .from('subscription_addons')
      .select('id')
      .eq('subscription_id', subscriptionId)
      .eq('addon_product_id', addonProductId)
      .maybeSingle();

    // Create backfill jobs for each workspace
    for (const workspace of workspaces) {
      console.log('Creating backfill job for workspace:', workspace.name);

      // Check for existing pending/in_progress jobs to prevent duplicates (idempotency)
      const { data: existingJob } = await supabase
        .from('workspace_backfill_jobs')
        .select('id, status')
        .eq('workspace_id', workspace.id)
        .eq('subscription_addon_id', addon?.id)
        .in('status', ['pending', 'in_progress'])
        .maybeSingle();

      if (existingJob) {
        console.log(
          'Skipping duplicate job creation - existing job %s with status %s',
          existingJob.id,
          existingJob.status
        );
        continue;
      }

      // Get repository count for this workspace
      const { count: repoCount } = await supabase
        .from('workspace_repositories')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id);

      // Create workspace backfill job
      const { data: job, error: jobError } = await supabase
        .from('workspace_backfill_jobs')
        .insert({
          workspace_id: workspace.id,
          subscription_addon_id: addon?.id,
          retention_days: retentionDays,
          status: 'pending',
          total_repositories: repoCount || 0,
          metadata: {
            trigger_source: 'addon_purchase',
            addon_product_id: addonProductId,
            user_id: userId,
          },
        })
        .select()
        .maybeSingle();

      if (jobError || !job) {
        console.error('Error creating backfill job:', jobError);
        continue;
      }

      console.log('Created backfill job: %s', job.id);

      // Trigger the actual backfill processing through WorkspaceBackfillService
      try {
        await WorkspaceBackfillService.triggerWorkspaceBackfill(
          workspace.id,
          retentionDays,
          addon?.id
        );
        console.log('Successfully triggered backfill for workspace: %s', workspace.id);
      } catch (backfillError) {
        console.error(
          'Error triggering backfill processing for workspace %s:',
          workspace.id,
          backfillError
        );
        // Job record already created, so errors here won't block webhook completion
        // The job will remain in 'pending' status and can be retried manually
      }
    }

    console.log('Workspace backfill triggered successfully for user: %s', userId);
  } catch (error) {
    console.error('Error triggering workspace backfill:', error);
  }
}

// Define webhook handler with signature verification
export const handler: Handler = async (event, context) => {
  // Validate environment variables at runtime
  if (!process.env.POLAR_WEBHOOK_SECRET) {
    console.error('POLAR_WEBHOOK_SECRET is not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook configuration error' }),
    };
  }

  if (!process.env.SUPABASE_URL) {
    console.error('SUPABASE_URL is not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database configuration error' }),
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database configuration error' }),
    };
  }

  // Call the Webhooks handler with proper configuration
  const webhookHandler = Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET,

    // Add signature verification error handler
    onError: async (error) => {
      console.error('Webhook error:', error);
      // Log potential signature verification failures
      if (error.message?.includes('signature') || error.message?.includes('verification')) {
        console.error('Webhook signature verification failed - potential security issue');
      }
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Webhook processing failed' }),
      };
    },
    onSubscriptionCreated: async (subscription) => {
      console.log('Subscription created:', subscription.id);

      // Validate user ID
      const userId = subscription.metadata?.user_id as string;
      if (!userId) {
        console.error('❌ No user_id in subscription metadata:', subscription.id);
        throw new Error('Missing user_id in subscription metadata');
      }

      // Map tier and validate
      const tier = mapProductToTier(subscription.product_id);
      if (tier === 'free' && subscription.product_id) {
        console.error(
          '⚠️ Product ID mismatch! Product: %s, Expected Pro: %s, Expected Team: %s',
          subscription.product_id,
          process.env.POLAR_PRODUCT_ID_PRO,
          process.env.POLAR_PRODUCT_ID_TEAM
        );
      }

      // Get tier limits
      const limits = getTierLimits(tier);

      // Determine billing cycle
      let billingCycle: string | null = null;
      if (subscription.recurring_interval === 'year') {
        billingCycle = 'yearly';
      } else if (subscription.recurring_interval === 'month') {
        billingCycle = 'monthly';
      }

      console.log(
        'Creating subscription for user %s with tier %s (workspaces: %d, repos: %d)',
        userId,
        tier,
        limits.max_workspaces,
        limits.max_repos_per_workspace
      );

      // Database operation with error checking
      const { error } = await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          polar_customer_id: subscription.customer_id,
          polar_subscription_id: subscription.id,
          status: subscription.status as
            | 'active'
            | 'canceled'
            | 'past_due'
            | 'trialing'
            | 'inactive',
          tier,
          max_workspaces: limits.max_workspaces,
          max_repos_per_workspace: limits.max_repos_per_workspace,
          billing_cycle: billingCycle,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          created_at: subscription.created_at,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

      // Check for errors
      if (error) {
        console.error('❌ Failed to create subscription:', error);
        throw error; // Return error to Polar for retry
      }

      console.log(
        '✅ Subscription created: { user_id: %s, tier: %s, status: %s }',
        userId,
        tier,
        subscription.status
      );
    },

    onSubscriptionUpdated: async (subscription) => {
      console.log('Subscription updated:', subscription.id);

      // Check if this update includes an addon purchase
      // Note: Polar subscriptions can have multiple products/addons
      const isExtendedRetentionAddon =
        subscription.product_id === POLAR_ADDON_PRODUCT_IDS.EXTENDED_DATA_RETENTION;

      if (isExtendedRetentionAddon && subscription.status === 'active') {
        console.log('Extended Data Retention addon detected for subscription: %s', subscription.id);

        // Get user ID from subscription metadata
        const userId = subscription.metadata?.user_id as string;
        if (!userId) {
          console.error('No user_id in subscription metadata for addon purchase');
          return;
        }

        // Get internal subscription ID using Polar subscription ID
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('polar_subscription_id', subscription.id)
          .maybeSingle();

        if (subError) {
          console.error('Error fetching subscription for addon: %s', subError.message);
          return;
        }

        if (!sub) {
          console.error('No subscription found for polar_subscription_id: %s', subscription.id);
          return;
        }

        // Create addon record with error handling
        const { error: addonError } = await supabase.from('subscription_addons').upsert(
          {
            subscription_id: sub.id,
            addon_type: 'extended_data_retention',
            addon_product_id: subscription.product_id,
            retention_days: 365,
            status: 'active',
            purchased_at: new Date().toISOString(),
            activated_at: new Date().toISOString(),
          },
          {
            onConflict: 'subscription_id,addon_type',
          }
        );

        if (addonError) {
          console.error('Error creating addon record: %s', addonError.message);
          return;
        }

        console.log('Addon record created successfully for subscription: %s', sub.id);

        // Trigger workspace backfill
        await triggerWorkspaceBackfill(userId, sub.id, subscription.product_id, 365);
      }

      // Map tier and validate
      const tier = mapProductToTier(subscription.product_id);
      if (tier === 'free' && subscription.product_id) {
        console.error(
          '⚠️ Product ID mismatch on update! Product: %s, Expected Pro: %s, Expected Team: %s',
          subscription.product_id,
          process.env.POLAR_PRODUCT_ID_PRO,
          process.env.POLAR_PRODUCT_ID_TEAM
        );
      }

      // Get tier limits
      const limits = getTierLimits(tier);

      // Determine billing cycle
      let billingCycle: string | null = null;
      if (subscription.recurring_interval === 'year') {
        billingCycle = 'yearly';
      } else if (subscription.recurring_interval === 'month') {
        billingCycle = 'monthly';
      }

      // Update subscription status in database with error checking
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: subscription.status as
            | 'active'
            | 'canceled'
            | 'past_due'
            | 'trialing'
            | 'inactive',
          tier,
          max_workspaces: limits.max_workspaces,
          max_repos_per_workspace: limits.max_repos_per_workspace,
          billing_cycle: billingCycle,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          updated_at: new Date().toISOString(),
        })
        .eq('polar_subscription_id', subscription.id);

      if (updateError) {
        console.error('❌ Failed to update subscription:', updateError);
        throw updateError;
      }

      console.log(
        '✅ Subscription updated: %s (tier: %s, status: %s)',
        subscription.id,
        tier,
        subscription.status
      );
    },

    onSubscriptionCanceled: async (subscription) => {
      console.log('Subscription canceled:', subscription.id);

      // Mark subscription as canceled
      await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('polar_subscription_id', subscription.id);
    },

    onSubscriptionRevoked: async (subscription) => {
      console.log('Subscription revoked:', subscription.id);

      // Immediately downgrade to free tier
      await supabase
        .from('subscriptions')
        .update({
          status: 'inactive',
          tier: 'free',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        })
        .eq('polar_subscription_id', subscription.id);
    },

    onCustomerCreated: async (customer) => {
      console.log('Customer created:', customer.id);

      // Get user ID from metadata
      const userId = customer.metadata?.user_id as string;
      if (!userId) {
        console.error('No user_id in customer metadata');
        return;
      }

      // Create or update subscription record with customer ID
      await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          polar_customer_id: customer.id,
          tier: 'free',
          status: 'inactive',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );
    },

    onCustomerUpdated: async (customer) => {
      console.log('Customer updated:', customer.id);

      // Update customer information if needed
      await supabase
        .from('subscriptions')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('polar_customer_id', customer.id);
    },

    onOrderCreated: async (order) => {
      console.log('Order created:', order.id);

      // Log order for analytics
      const userId = order.metadata?.user_id as string;
      if (userId) {
        console.log('User %s completed order %s for $%d', userId, order.id, order.amount / 100);
      }
    },

    onPayload: async (payload) => {
      // Handle any other webhook events
      console.log('Received webhook event:', payload.type);
    },
  });

  // Execute the webhook handler
  return webhookHandler(event, context);
};

// Helper function to map Polar product IDs to our tier names
function mapProductToTier(productId: string): string {
  // Map your actual Polar product IDs to tier names
  const productTierMap: Record<string, string> = {
    [process.env.POLAR_PRODUCT_ID_PRO || '']: 'pro',
    [process.env.POLAR_PRODUCT_ID_TEAM || '']: 'team',
  };

  const tier = productTierMap[productId];

  // Log warning for unrecognized product IDs
  if (!tier && productId) {
    console.error('⚠️ Unknown product ID: %s', productId);
    console.error('Configured product IDs:', {
      pro: process.env.POLAR_PRODUCT_ID_PRO,
      team: process.env.POLAR_PRODUCT_ID_TEAM,
    });
  }

  return tier || 'free';
}

/**
 * Get tier limits based on subscription tier
 */
function getTierLimits(tier: string): {
  max_workspaces: number;
  max_repos_per_workspace: number;
} {
  const tierLimits: Record<string, { max_workspaces: number; max_repos_per_workspace: number }> = {
    pro: { max_workspaces: 1, max_repos_per_workspace: 3 },
    team: { max_workspaces: 3, max_repos_per_workspace: 3 },
    free: { max_workspaces: 0, max_repos_per_workspace: 0 },
  };

  return tierLimits[tier] || tierLimits.free;
}
