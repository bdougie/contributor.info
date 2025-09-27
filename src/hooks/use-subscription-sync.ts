import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from './use-current-user';

/**
 * Hook that ensures workspace tier and subscription records are in sync
 * This provides a safety net for cases where Polar webhooks fail
 */
export function useSubscriptionSync() {
  const { user } = useCurrentUser();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const syncSubscription = async () => {
      setIsSyncing(true);
      setError(null);

      try {
        // 1. Check if user owns any workspaces with paid tiers
        const { data: workspaces, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id, name, tier')
          .eq('owner_id', user.id)
          .in('tier', ['pro', 'team', 'enterprise']);

        if (workspaceError) {
          console.error('Error fetching workspaces:', workspaceError);
          return;
        }

        if (!workspaces || workspaces.length === 0) {
          // No paid workspaces, nothing to sync
          return;
        }

        // 2. Get the highest tier from workspaces
        const tierPriority = { enterprise: 3, team: 2, pro: 1, free: 0 };
        const highestTier = workspaces.reduce((max, ws) => {
          const currentPriority = tierPriority[ws.tier as keyof typeof tierPriority] || 0;
          const maxPriority = tierPriority[max as keyof typeof tierPriority] || 0;
          return currentPriority > maxPriority ? ws.tier : max;
        }, 'free');

        // 3. Check current subscription
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (subError && subError.code !== 'PGRST116') {
          console.error('Error fetching subscription:', subError);
          setError('Failed to check subscription status');
          return;
        }

        // 4. If no subscription exists or tier doesn't match, create/update it
        if (!subscription) {
          console.warn(
            '🔧 No subscription found for paid workspace - creating emergency subscription'
          );

          const { error: insertError } = await supabase.from('subscriptions').insert({
            user_id: user.id,
            tier: highestTier,
            status: 'active',
            max_workspaces: highestTier === 'team' ? 3 : 1,
            max_repos_per_workspace: 3,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error('Failed to create subscription:', insertError);
            setError('Failed to create subscription record');
          } else {
            console.log('✅ Emergency subscription created with tier:', highestTier);
            // Reload the page to ensure all components get the updated subscription
            window.location.reload();
          }
        } else if (subscription.tier !== highestTier) {
          console.warn(
            `🔧 Subscription tier mismatch - updating from ${subscription.tier} to ${highestTier}`
          );

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update({
              tier: highestTier,
              status: 'active',
              max_workspaces: highestTier === 'team' ? 3 : 1,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id);

          if (updateError) {
            console.error('Failed to update subscription:', updateError);
            setError('Failed to update subscription record');
          } else {
            console.log('✅ Subscription tier updated to:', highestTier);
            // Reload the page to ensure all components get the updated subscription
            window.location.reload();
          }
        }
      } catch (error) {
        console.error('Subscription sync error:', error);
        setError('Unexpected error during subscription sync');
      } finally {
        setIsSyncing(false);
      }
    };

    // Run sync check
    syncSubscription();
  }, [user?.id]);

  return { isSyncing, syncError };
}
