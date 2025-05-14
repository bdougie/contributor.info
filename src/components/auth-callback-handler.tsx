import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/services/supabase-client';

/**
 * Component to handle authentication callbacks
 * This is used to process the OAuth callback after a user authenticates
 */
export function AuthCallbackHandler() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have auth params in the URL
    const hasAuthParams = location.hash.includes('access_token');
    
    // If we have auth params, process them
    async function handleAuthCallback() {
      if (!hasAuthParams) return;
      
      try {
        // Get the session from the URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error processing auth callback:', error);
          return;
        }
        
        // If we have a session, navigate to the home page
        if (data.session) {
          // Remove the hash from the URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          // Check if there's a stored redirect
          const redirectTo = localStorage.getItem('redirectAfterLogin');
          if (redirectTo) {
            localStorage.removeItem('redirectAfterLogin');
            navigate(redirectTo);
          } else {
            navigate('/');
          }
        }
      } catch (err) {
        console.error('Exception handling auth callback:', err);
      }
    }
    
    handleAuthCallback();
  }, [location, navigate]);
  
  // This is just a utility component, it doesn't render anything
  return null;
}