import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter 
} from '@/components/ui/card';

export default function DebugAuthPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  const checkSession = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setAuthError(error.message);
      } else {
        setSessionInfo(data);
        if (data.session?.user) {
          setUserInfo(data.session.user);
        } else {
          setUserInfo(null);
        }
      }
    } catch (err) {
      setAuthError('Failed to check session');
    }
  };

  const handleLogin = async () => {
    try {
      setAuthError(null);
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/debug-auth`,
          scopes: 'repo user',
        },
      });
      
      if (signInError) {
        setAuthError(signInError.message);
      }
    } catch (err) {
      setAuthError('Failed to initiate login');
    }
  };

  const handleLogout = async () => {
    try {
      setAuthError(null);
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        setAuthError(signOutError.message);
      } else {
        // Clear state on successful logout
        setUserInfo(null);
        checkSession();
      }
    } catch (err) {
      setAuthError('Failed to log out');
    }
  };

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkSession();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Authentication Debugging</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
            <CardDescription>Current login state and session information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium">Status</h3>
                <p className="text-muted-foreground">
                  {userInfo ? (
                    <span className="text-green-500 font-medium">Logged in</span>
                  ) : (
                    <span className="text-yellow-500 font-medium">Not logged in</span>
                  )}
                </p>
              </div>
              
              {userInfo && (
                <div>
                  <h3 className="text-lg font-medium">User Information</h3>
                  <div className="bg-muted p-4 rounded-md mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">User ID</p>
                        <p className="text-sm text-muted-foreground break-all">{userInfo.id}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">{userInfo.email || 'Not available'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Provider</p>
                        <p className="text-sm text-muted-foreground">{userInfo.app_metadata?.provider || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Created At</p>
                        <p className="text-sm text-muted-foreground">
                          {userInfo.created_at 
                            ? new Date(userInfo.created_at).toLocaleString() 
                            : 'Not available'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {authError && (
                <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-md text-sm">
                  <p className="font-medium">Error:</p>
                  <p>{authError}</p>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end space-x-2">
            {userInfo ? (
              <Button variant="destructive" onClick={handleLogout}>Sign Out</Button>
            ) : (
              <Button onClick={handleLogin}>Sign In with GitHub</Button>
            )}
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Details</CardTitle>
            <CardDescription>Raw session information from Supabase</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-md p-4 overflow-auto max-h-96">
              <pre className="text-xs">
                {JSON.stringify(sessionInfo, null, 2)}
              </pre>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={checkSession}>Refresh Session Info</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment</CardTitle>
            <CardDescription>Information about your environment configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <p className="font-medium">Current URL</p>
                <p className="text-sm text-muted-foreground break-all">{window.location.href}</p>
              </div>
              <div>
                <p className="font-medium">Origin</p>
                <p className="text-sm text-muted-foreground">{window.location.origin}</p>
              </div>
              <div>
                <p className="font-medium">Supabase Configuration</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  <div className="bg-muted p-2 rounded-md">
                    <p className="text-sm font-medium">Supabase URL</p>
                    <p className="text-sm text-muted-foreground">
                      {import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing'}
                    </p>
                  </div>
                  <div className="bg-muted p-2 rounded-md">
                    <p className="text-sm font-medium">Supabase Anon Key</p>
                    <p className="text-sm text-muted-foreground">
                      {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}