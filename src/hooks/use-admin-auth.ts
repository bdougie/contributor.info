import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AdminAuthState {
  user: User | null;
  isLoggedIn: boolean;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook for managing admin authentication state and actions
 * Extends regular GitHub auth with admin role verification
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    user: null,
    isLoggedIn: false,
    isAdmin: false,
    loading: true,
    error: null,
  });
  
  useEffect(() => {
    let mounted = true;
    
    async function checkAdminAuth() {
      try {
        setState(prev => ({ ...prev, loading: true, error: null }));
        
        // Check URL for auth tokens first
        if (window.location.hash.includes('access_token')) {
          try {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken
              });
            }
          } catch (err) {
            // Silently handle token processing errors
          }
          
          // Clear the URL hash after processing
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          throw sessionError;
        }
        
        const user = session?.user ?? null;
        const isLoggedIn = !!user;
        let isAdmin = false;
        
        if (user && user.user_metadata?.user_name) {
          // Check admin status from database
          const { data: adminCheck, error: adminError } = await supabase
            .rpc('is_user_admin', { user_github_username: user.user_metadata.user_name });
          
          if (adminError) {
            console.warn('Failed to check admin status:', adminError);
          } else {
            isAdmin = adminCheck === true;
          }
          
          // Upsert user data if logged in
          if (isLoggedIn) {
            await upsertUserData(user);
          }
        }
        
        if (mounted) {
          setState({
            user,
            isLoggedIn,
            isAdmin,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Authentication failed',
          }));
        }
      }
    }
    
    checkAdminAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, session) => {
      if (!mounted) return;
      
      const user = session?.user ?? null;
      const isLoggedIn = !!user;
      let isAdmin = false;
      
      if (user && user.user_metadata?.user_name) {
        try {
          // Check admin status from database
          const { data: adminCheck } = await supabase
            .rpc('is_user_admin', { user_github_username: user.user_metadata.user_name });
          
          isAdmin = adminCheck === true;
          
          // Upsert user data if logged in
          if (isLoggedIn) {
            await upsertUserData(user);
          }
        } catch (err) {
          console.warn('Failed to check admin status on auth change:', err);
        }
      }
      
      setState(prev => ({
        ...prev,
        user,
        isLoggedIn,
        isAdmin,
        loading: false,
        error: null,
      }));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Upsert user data to app_users table
   */
  const upsertUserData = async (user: User) => {
    try {
      if (!user.user_metadata?.user_name) {
        return;
      }
      
      await supabase.rpc('upsert_app_user', {
        p_auth_user_id: user.id,
        p_github_username: user.user_metadata.user_name,
        p_github_user_id: user.user_metadata.provider_id ? 
          parseInt(user.user_metadata.provider_id) : null,
        p_email: user.email,
        p_avatar_url: user.user_metadata.avatar_url,
        p_display_name: user.user_metadata.full_name || user.user_metadata.name,
      });
    } catch (err) {
      console.warn('Failed to upsert user data:', err);
    }
  };

  /**
   * Initiates GitHub OAuth login flow
   */
  const login = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      
      // Store the current path for redirect after login
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        localStorage.setItem('redirectAfterLogin', currentPath);
      }
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin,
          scopes: 'repo user',
        },
      });
      
      if (error) {
        throw error;
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Login failed',
      }));
    }
  };

  /**
   * Signs the user out
   */
  const logout = async () => {
    try {
      setState(prev => ({ ...prev, error: null }));
      await supabase.auth.signOut();
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Logout failed',
      }));
    }
  };

  /**
   * Force refresh admin status
   */
  const refreshAdminStatus = async () => {
    if (!state.user || !state.user.user_metadata?.user_name) {
      return false;
    }
    
    try {
      const { data: adminCheck, error } = await supabase
        .rpc('is_user_admin', { user_github_username: state.user.user_metadata.user_name });
      
      if (error) {
        throw error;
      }
      
      const isAdmin = adminCheck === true;
      setState(prev => ({ ...prev, isAdmin }));
      return isAdmin;
    } catch (err) {
      console.warn('Failed to refresh admin status:', err);
      return false;
    }
  };

  /**
   * Check if user has a specific role
   */
  const hasRole = async (role: string): Promise<boolean> => {
    if (!state.user || !state.user.user_metadata?.user_name) {
      return false;
    }
    
    try {
      const { data: hasRoleResult, error } = await supabase
        .rpc('user_has_role', { 
          user_github_username: state.user.user_metadata.user_name,
          role_name: role 
        });
      
      if (error) {
        throw error;
      }
      
      return hasRoleResult === true;
    } catch (err) {
      console.warn(`Failed to check role ${role}:`, err);
      return false;
    }
  };

  return { 
    ...state,
    login, 
    logout,
    refreshAdminStatus,
    hasRole,
  };
}