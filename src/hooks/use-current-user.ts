import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase-lazy';
import type { User } from '@supabase/supabase-js';
import { safeGetUser } from '@/lib/auth/safe-auth';

/**
 * Hook to get the current authenticated user
 * Uses timeout-protected auth utility to prevent infinite loading states
 */
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    async function loadUser() {
      try {
        // Use safe auth utility with timeout protection
        const { user: authUser, error } = await safeGetUser();
        if (error) {
          console.error('Error loading user:', error);
        }
        if (isMounted) {
          setUser(authUser);
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

      // Set up auth listener after initial load
      try {
        const supabase = await getSupabase();
        if (!isMounted) return;

        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (isMounted) {
            setUser(session?.user ?? null);
          }
        });
        subscription = authListener.subscription;
      } catch (error) {
        console.error('Error setting up auth listener:', error);
      }
    }

    loadUser();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { user, loading };
}
