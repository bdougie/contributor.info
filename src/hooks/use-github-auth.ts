import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase-client';

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
      
      // Check if the URL has auth parameters 
      const hasAuthParams = window.location.href.includes('access_token') || 
                           window.location.hash.includes('access_token');
      
      // Get the current session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error checking auth session:', error);
      }
      
      const isAuthenticated = !!session;
      setIsLoggedIn(isAuthenticated);
      
      // Close login dialog if logged in and check for redirect
      if (isAuthenticated) {
        if (showLoginDialog) {
          setShowLoginDialog(false);
        }
        
        // Clean up URL if needed
        if (hasAuthParams) {
          // Remove hash params from URL if present
          if (window.location.hash) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
          }
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);
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

    return () => subscription.unsubscribe();
  }, [showLoginDialog, navigate]);

  /**
   * Initiates GitHub OAuth login flow
   */
  const login = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
        skipBrowserRedirect: false,
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