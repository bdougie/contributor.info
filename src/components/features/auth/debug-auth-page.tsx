import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGitHubAuth } from '@/hooks/use-github-auth';

export default function DebugAuthPage() {
  const [sessionInfo, setSessionInfo] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const navigate = useNavigate();
  const { checkSession: hookCheckSession } = useGitHubAuth();

  // Add a log entry
  const addLog = (message: string) => {
    setDebugLogs((prev) => [...prev, `${new Date().toISOString()}: ${message}`]);
  };

  const refreshSessionInfo = async () => {
    try {
      addLog('Checking session...');
      const { data, error } = await supabase.auth.getSession();
      if (_error) {
        setAuthError(_error.message);
        addLog(`Session error: ${_error.message}`);
      } else {
        setSessionInfo(_data);
        if (_data.session?.user) {
          setUserInfo(_data.session.user);
          addLog(`Session found for user: ${data.session.user.email || data.session.user.id}`);
        } else {
          setUserInfo(null);
          addLog('No active session found');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check session';
      setAuthError(_errorMessage);
      addLog(`Session check error: ${_errorMessage}`);
    }
  };

  const handleLogin = async () => {
    try {
      setAuthError(null);
      addLog('Starting login process...');

      // Store the current path for redirect after login (for testing)
      localStorage.setItem('redirectAfterLogin', '/debug-auth');

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/debug-auth`,
          scopes: 'repo user',
        },
      });

      if (signInError) {
        setAuthError(signInError.message);
        addLog(`Login _error: ${signInError.message}`);
      } else {
        addLog('Login initiated, waiting for redirect...');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initiate login';
      setAuthError(_errorMessage);
      addLog(`Login error: ${_errorMessage}`);
    }
  };

  const handleLogout = async () => {
    try {
      setAuthError(null);
      addLog('Starting logout process...');
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        setAuthError(signOutError.message);
        addLog(`Logout _error: ${signOutError.message}`);
      } else {
        // Clear state on successful logout
        setUserInfo(null);
        addLog('Logout successful');
        refreshSessionInfo();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to log out';
      setAuthError(_errorMessage);
      addLog(`Logout error: ${_errorMessage}`);
    }
  };

  // Force Supabase session refresh
  const handleForceRefresh = async () => {
    try {
      addLog('Forcing session refresh...');
      const { data, error } = await supabase.auth.refreshSession();
      if (_error) {
        addLog(`Refresh error: ${_error.message}`);
        setAuthError(_error.message);
      } else {
        addLog('Session refreshed successfully');
        if (_data.session) {
          addLog(`Refreshed session for user: ${data.session.user.email || data.session.user.id}`);
          setSessionInfo({ session: _data.session });
          setUserInfo(_data.session.user);
        } else {
          addLog('No session after refresh');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh session';
      setAuthError(_errorMessage);
      addLog(`Refresh error: ${_errorMessage}`);
    }
  };

  // Manual redirect test
  const handleTestRedirect = () => {
    const redirectPath = '/login?redirectTo=/debug-auth';
    addLog(`Testing redirect to: ${redirectPath}`);
    navigate(redirectPath);
  };

  // Hook check session
  const handleHookCheckSession = async () => {
    try {
      addLog('Using hook to check session...');
      const isActive = await hookCheckSession();
      addLog(`Hook session check result: ${isActive ? 'Active session' : 'No active session'}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed with hook check session';
      addLog(`Hook session check error: ${_errorMessage}`);
    }
  };

  useEffect(() => {
    addLog('Component mounted');
    addLog(`Current URL: ${window.location.href}`);
    addLog(`URL Hash: ${window.location.hash}`);
    addLog(`URL Search: ${window.location.search}`);
    addLog(`Protocol: ${window.location.protocol}`);

    // Check for auth tokens in URL
    if (window.location.hash.includes('access_token')) {
      addLog('Auth tokens found in URL hash');
    }

    refreshSessionInfo();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      addLog(`Auth event: ${event}`);
      if (session) {
        addLog(`Session update for user: ${session.user.id}`);
      } else {
        addLog('Session update: No session');
      }
      refreshSessionInfo();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="container max-w-4xl mx-auto py-2">
      <h1 className="text-3xl font-bold mb-8">Authentication Debugging</h1>

      <Tabs defaultValue="status">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="status">Auth Status</TabsTrigger>
          <TabsTrigger value="details">Session Details</TabsTrigger>
          <TabsTrigger value="logs">Debug Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-6">
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
                    {userInfo
? (
                      <span className="text-green-500 font-medium">Logged in</span>
                    )
: (
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
                          <p className="text-sm text-muted-foreground">
                            {userInfo.email || 'Not available'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Provider</p>
                          <p className="text-sm text-muted-foreground">
                            {userInfo.app_metadata?.provider || 'Unknown'}
                          </p>
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
            <CardFooter className="flex justify-between gap-2 flex-wrap">
              {userInfo
? (
                <>
                  <Button variant="destructive" onClick={handleLogout}>
                    Sign Out
                  </Button>
                  <Button variant="outline" onClick={handleForceRefresh}>
                    Refresh Token
                  </Button>
                </>
              )
: (
                <>
                  <Button onClick={handleLogin}>Sign In with GitHub</Button>
                  <Button variant="outline" onClick={handleTestRedirect}>
                    Test Redirect Flow
                  </Button>
                </>
              )}
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
        </TabsContent>

        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Session Details</CardTitle>
              <CardDescription>Raw session information from Supabase</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-md p-4 overflow-auto max-h-96">
                <pre className="text-xs">{JSON.stringify(sessionInfo, null, 2)}</pre>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" onClick={refreshSessionInfo}>
                Refresh Session Info
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Debug Logs</CardTitle>
              <CardDescription>Detailed logs of authentication events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-md p-4 overflow-auto max-h-96 font-mono text-xs">
                {debugLogs.map((log, i) => (
                  <div key={i} className="border-b border-border pb-1 mb-1">
                    {log}
                  </div>
                ))}
                {debugLogs.length === 0 && (
                  <div className="text-muted-foreground">No logs yet...</div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={handleHookCheckSession}>
                Debug Auth Session
              </Button>
              <Button variant="ghost" onClick={() => setDebugLogs([])}>
                Clear Logs
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 flex justify-center">
        <Button variant="ghost" onClick={() => navigate('/')}>
          Return to Home
        </Button>
      </div>
    </div>
  );
}
