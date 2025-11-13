import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
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
    async function loadUser() {
      try {
        // Use safe auth utility with timeout protection
        const { user: authUser, error } = await safeGetUser();
        if (error) {
          console.error('Error loading user:', error);
        }
        setUser(authUser);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
