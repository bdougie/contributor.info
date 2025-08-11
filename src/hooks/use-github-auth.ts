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
      // Check URL for auth tokens first and handle them manually
      // This prevents 401 errors that occur when Supabase's automatic detection fails
      if (window.location.hash.includes('access_token')) {
        try {
          // Manually parse the hash parameters
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && refreshToken) {
            // Set the session manually using the extracted tokens
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });
            
            if (error) {
              // Silently handle session setting errors
            };
          }
        } catch (err) {
          // Silently handle auth token processing errors
        }
        
        // Clear the URL hash after processing
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      const isAuthenticated = !!session;
      setIsLoggedIn(isAuthenticated);
      
      // Close login dialog if logged in
      if (isAuthenticated) {
        if (showLoginDialog) {
          setShowLoginDialog(false);
        }
        
        // Only redirect if we're on the login page itself
        // Otherwise let the OAuth redirect handle returning to the original page
        if (window.location.pathname === '/login') {
          const redirectPath = localStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            // Clear the stored path
            localStorage.removeItem('redirectAfterLogin');
            // Navigate to the stored path
            navigate(redirectPath);
          }
        }
      }
      
      setLoading(false);
    }
    
    checkAuth();

    // Listen for auth changes
    try {
      const authSubscription = supabase.auth.onAuthStateChange((_, session) => {
        const loggedIn = !!session;
        setIsLoggedIn(loggedIn);
        
        // Close login dialog if logged in
        if (loggedIn) {
          if (showLoginDialog) {
            setShowLoginDialog(false);
          }
          
          // Only redirect if we're on the login page
          // OAuth redirect will handle returning to the original page
          if (window.location.pathname === '/login') {
            const redirectPath = localStorage.getItem('redirectAfterLogin');
            if (redirectPath) {
              // Clear the stored path
              localStorage.removeItem('redirectAfterLogin');
              // Navigate to the stored path
              navigate(redirectPath);
            }
          }
        }
    });

      // Return proper cleanup function
      return () => {
        // For newer versions of Supabase client - the subscription object has an unsubscribe method
        if (authSubscription && authSubscription.data && authSubscription.data.subscription && typeof authSubscription.data.subscription.unsubscribe === 'function') {
          authSubscription.data.subscription.unsubscribe();
        }
      };
    } catch (error) {
      return () => {}; // Empty cleanup function
    }
  }, [showLoginDialog, navigate]);

  /**
   * Initiates GitHub OAuth login flow
   */
  const login = async () => {
    try {
      // Store the current path for redirect after login if needed
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        localStorage.setItem('redirectAfterLogin', currentPath);
      }
      // Start the login flow with the correct redirect URL
      // Redirect back to the current page after login
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.href, // Redirect back to current page
          scopes: 'public_repo read:user user:email',
        },
      });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      // Silently handle login errors
    }
  };

  /**
   * Signs the user out
   */
  const logout = async () => {
    await supabase.auth.signOut();
  };

  /**
   * Force check the current session
   */
  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  };

  return { 
    isLoggedIn, 
    loading, 
    login, 
    logout,
    checkSession,
    showLoginDialog,
    setShowLoginDialog
  };
}