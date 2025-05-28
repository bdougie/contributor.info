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
      console.log('Checking auth status...');
      
      // Check URL for auth tokens first and handle them
      const currentUrl = window.location.href;
      console.log('Current URL:', currentUrl);
      console.log('URL Hash:', window.location.hash);
      
      if (window.location.hash.includes('access_token')) {
        console.log('Auth tokens found in URL hash');
        // Since detectSessionInUrl is enabled in Supabase config, 
        // we just need to wait a moment for it to process
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Clear the URL hash after processing
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session);
      const isAuthenticated = !!session;
      setIsLoggedIn(isAuthenticated);
      
      // Close login dialog if logged in and check for redirect
      if (isAuthenticated) {
        console.log('User is authenticated');
        if (showLoginDialog) {
          setShowLoginDialog(false);
        }
        
        // Check if there's a redirect path stored
        const redirectPath = localStorage.getItem('redirectAfterLogin');
        if (redirectPath) {
          console.log('Redirecting to:', redirectPath);
          // Clear the stored path
          localStorage.removeItem('redirectAfterLogin');
          // Navigate to the stored path
          navigate(redirectPath);
        }
      } else {
        console.log('User is not authenticated');
      }
      
      setLoading(false);
    }
    
    checkAuth();

    // Listen for auth changes
    try {
      // Simplify the auth state subscription to avoid issues with return type
      const authSubscription = supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event);
        console.log('Session:', session);
        
        const loggedIn = !!session;
        setIsLoggedIn(loggedIn);
        
        // Close login dialog if logged in and check for redirect
        if (loggedIn) {
          console.log('User is now logged in');
          if (showLoginDialog) {
            setShowLoginDialog(false);
          }
          
          // Check if there's a redirect path stored
          const redirectPath = localStorage.getItem('redirectAfterLogin');
          if (redirectPath) {
            console.log('Redirecting to:', redirectPath);
            // Clear the stored path
            localStorage.removeItem('redirectAfterLogin');
            // Navigate to the stored path
            navigate(redirectPath);
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
      console.error('Error setting up auth state change listener:', error);
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
        console.log('Storing redirect path:', currentPath);
        localStorage.setItem('redirectAfterLogin', currentPath);
      }
      
      console.log('Starting GitHub login flow...');
      // Start the login flow with the correct redirect URL
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin, // This ensures redirect to your domain root
        },
      });
      
      if (error) {
        console.error('Login error:', error);
        throw error;
      }
    } catch (err) {
      console.error('Login error:', err);
      // Handle login error appropriately
    }
  };

  /**
   * Signs the user out
   */
  const logout = async () => {
    console.log('Logging out...');
    await supabase.auth.signOut();
  };

  /**
   * Force check the current session
   */
  const checkSession = async () => {
    const { data } = await supabase.auth.getSession();
    console.log('Manual session check:', data.session);
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