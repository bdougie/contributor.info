import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/**
 * Hook for managing GitHub authentication state and actions
 */
export function useGitHubAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginDialog, setShowLoginDialog] = useState<boolean>(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check login status
    async function checkAuth() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticated = !!session;
      setIsLoggedIn(isAuthenticated);
      
      // Close login dialog if logged in and check for redirect
      if (isAuthenticated) {
        if (showLoginDialog) {
          setShowLoginDialog(false);
        }
        
        // Check if there's a redirect path stored
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          // Clear the stored path
          localStorage.removeItem('redirectAfterLogin');
          // Navigate to the stored path
          navigate(redirectPath);
        }
      }
      
      setLoading(false);
    }
    
    checkAuth();

    // Listen for auth changes
    // Using try/catch to handle potential errors in tests
    try {
      const subscription = supabase.auth.onAuthStateChange((_event, session) => {
        const loggedIn = !!session;
        setIsLoggedIn(loggedIn);
        
        // Close login dialog if logged in and check for redirect
        if (loggedIn) {
          if (showLoginDialog) {
            setShowLoginDialog(false);
          }
          
          // Check if there's a redirect path stored
          const redirectPath = localStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            // Clear the stored path
            localStorage.removeItem('redirectAfterLogin');
            // Navigate to the stored path
            navigate(redirectPath);
          }
        }
    });

      // Simplified cleanup using subscription directly
      return () => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      };
    } catch (error) {
      console.error('Error setting up auth state change listener:', error);
      return () => {}; // Empty cleanup function
    }
  }, [showLoginDialog, navigate]);

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