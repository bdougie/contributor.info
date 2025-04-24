import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Hook for managing GitHub authentication state and actions
 */
export function useGitHubAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginDialog, setShowLoginDialog] = useState<boolean>(false);
  
  useEffect(() => {
    // Check login status
    async function checkAuth() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      
      // Close login dialog if logged in
      if (!!session && showLoginDialog) {
        setShowLoginDialog(false);
      }
      
      setLoading(false);
    }
    
    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      
      // Close login dialog if logged in
      if (loggedIn && showLoginDialog) {
        setShowLoginDialog(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [showLoginDialog]);

  /**
   * Initiates GitHub OAuth login flow
   */
  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  /**
   * Signs the user out
   */
  const logout = async () => {
    await supabase.auth.signOut();
  };

  return { 
    isLoggedIn, 
    loading, 
    login, 
    logout,
    showLoginDialog,
    setShowLoginDialog
  };
}