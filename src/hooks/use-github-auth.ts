import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSupabase } from '@/lib/supabase-lazy';
import { getAuthRedirectURL } from '@/lib/auth/auth-utils';
import { safeGetSession } from '@/lib/auth/safe-auth';

/**
 * Hook for managing GitHub authentication state and actions
 */
export function useGitHubAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLoginDialog, setShowLoginDialog] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let isMounted = true;

    // Check login status and set up listeners
    async function initAuth() {
      setLoading(true);

      // Check for test mode authentication first (CI/E2E tests)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
      const isCI = import.meta.env.VITE_CI === 'true';
      const isTestMode =
        supabaseUrl.includes('localhost:54321') || import.meta.env.MODE === 'test' || isCI;
      if (isTestMode && localStorage.getItem('test-auth-user')) {
        if (isMounted) {
          setIsLoggedIn(true);
          setLoading(false);
        }
        return;
      }

      // Get Supabase client asynchronously
      const supabase = await getSupabase();
      if (!isMounted) return;

      // Check URL for auth tokens first and handle them manually
      // This prevents 401 errors that occur when Supabase's automatic detection fails
      if (typeof window !== 'undefined' && window.location?.hash?.includes('access_token')) {
        try {
          // Manually parse the hash parameters
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // Set the session manually using the extracted tokens
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              // Silently handle session setting errors
            }
          }
        } catch {
          // Silently handle auth token processing errors
        }

        // Clear the URL hash after processing
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      // Use safe session check with timeout protection
      const { session, error: sessionError } = await safeGetSession();
      if (sessionError) {
        // Handle session check error gracefully
        console.error('Session check error:', sessionError);
      }
      const isAuthenticated = !!session;
      if (isMounted) {
        setIsLoggedIn(isAuthenticated);
      }

      // Close login dialog if logged in
      if (isAuthenticated) {
        if (showLoginDialog && isMounted) {
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

      if (isMounted) {
        setLoading(false);
      }

      // Listen for auth changes
      try {
        const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
          if (!isMounted) return;
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
        subscription = authListener.subscription;
      } catch {
        // Silently handle auth listener setup errors
      }
    }

    initAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
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
      // Use dynamic redirect URL based on deployment context
      const redirectUrl = getAuthRedirectURL(true); // Preserve current path
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectUrl, // Dynamic redirect based on context
          scopes: 'public_repo read:user user:email', // 'public_repo' scope for public repositories only
        },
      });

      if (error) {
        throw error;
      }
    } catch {
      // Silently handle login errors
    }
  };

  /**
   * Signs the user out
   */
  const logout = async () => {
    // Check for test mode
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const isCI = import.meta.env.VITE_CI === 'true';
    const isTestMode =
      supabaseUrl.includes('localhost:54321') || import.meta.env.MODE === 'test' || isCI;

    if (isTestMode) {
      // Clear test auth
      localStorage.removeItem('test-auth-user');
      setIsLoggedIn(false);
    } else {
      const supabase = await getSupabase();
      await supabase.auth.signOut();
    }
  };

  /**
   * Force check the current session with timeout protection
   */
  const checkSession = async () => {
    const { session } = await safeGetSession();
    return !!session;
  };

  return {
    isLoggedIn,
    loading,
    login,
    logout,
    checkSession,
    showLoginDialog,
    setShowLoginDialog,
  };
}
