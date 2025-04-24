import { useEffect, useState } from 'react';
import { supabase } from '@/services/supabase-client';

/**
 * Component for debugging authentication status
 * This is a development-only component to help troubleshoot auth issues
 */
export function AuthDebugger() {
  const [sessionInfo, setSessionInfo] = useState<string>('Checking session...');
  const [urlInfo, setUrlInfo] = useState<string>('');

  useEffect(() => {
    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setSessionInfo(`Error getting session: ${error.message}`);
          return;
        }
        
        if (data.session) {
          setSessionInfo(`Logged in as: ${data.session.user?.email || 'Unknown user'}`);
        } else {
          setSessionInfo('No active session found.');
        }
      } catch (err) {
        setSessionInfo(`Exception checking session: ${err}`);
      }
    }
    
    // Check session
    checkSession();
    
    // Display URL info for debugging
    setUrlInfo(`
      Full URL: ${window.location.href}
      Path: ${window.location.pathname}
      Hash: ${window.location.hash}
      Search: ${window.location.search}
    `);
    
    // Setup auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionInfo(`Auth event: ${event}, User: ${session?.user?.email || 'none'}`);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-xs z-50 overflow-auto max-h-40">
      <h4 className="font-bold mb-2">Auth Debug</h4>
      <div className="mb-2">{sessionInfo}</div>
      <pre className="whitespace-pre-wrap">{urlInfo}</pre>
    </div>
  );
}