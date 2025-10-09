import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/posthog-lazy';
import { GITHUB_OAUTH_SCOPES } from '@/config/auth';

/**
 * Simple auth hook for login functionality
 */
export function useAuth() {
  const handleLogin = async () => {
    try {
      // Track auth start event
      trackEvent('auth_started', {
        auth_provider: 'github',
        source: 'contributors_table',
        page_path: window.location.pathname,
      });

      // Get the correct redirect URL for the current environment
      const redirectTo = window.location.origin + window.location.pathname;

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: GITHUB_OAUTH_SCOPES,
        },
      });

      if (signInError) {
        console.error('Login error:', signInError.message);
        // Track auth failure
        trackEvent('auth_failed', {
          auth_provider: 'github',
          error_message: signInError.message,
          page_path: window.location.pathname,
        });
        throw signInError;
      }
    } catch (error) {
      console.error('Failed to initiate login:', error);
      // Track auth failure
      trackEvent('auth_failed', {
        auth_provider: 'github',
        error_type: 'exception',
        page_path: window.location.pathname,
      });
      throw error;
    }
  };

  return {
    login: handleLogin,
  };
}
