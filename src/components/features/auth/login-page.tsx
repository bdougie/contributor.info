import { useEffect, useState } from 'react';
import { GithubIcon } from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGitHubAuth } from '@/hooks/use-github-auth';
import { SocialMetaTags } from '@/components/common/layout';
import { useAnalytics } from '@/hooks/use-analytics';

/**
 * Validates redirect URLs to prevent open redirect attacks
 */
function isValidRedirectUrl(url: string): boolean {
  try {
    // Parse the URL relative to current origin
    const parsed = new URL(url, window.location.origin);
    // Only allow same-origin redirects
    return parsed.origin === window.location.origin;
  } catch {
    // If URL parsing fails, check if it's a valid relative path
    return url.startsWith('/') && !url.startsWith('//');
  }
}

/**
 * Check if we're in test mode (CI environment with mock credentials)
 */
function isTestMode(): boolean {
  // Check if we're using mock Supabase URL (indicates CI/test environment)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  return supabaseUrl.includes('localhost:54321') || import.meta.env.MODE === 'test';
}

/**
 * Dedicated login page that handles authentication and redirects
 */
export default function LoginPage() {
  const { login, isLoggedIn } = useGitHubAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const { trackLoginInitiated, trackLoginSuccessful } = useAnalytics();
  const testMode = isTestMode();

  // Get the intended destination from URL param or use home page as default
  const urlParams = new URLSearchParams(window.location.search);
  const rawRedirectTo = urlParams.get('redirectTo') || '/';
  // Validate the redirect URL to prevent open redirect attacks
  const redirectTo = isValidRedirectUrl(rawRedirectTo) ? rawRedirectTo : '/';

  // If already logged in, redirect to the intended destination
  useEffect(() => {
    if (isLoggedIn) {
      console.log('User is logged in, redirecting to:', redirectTo);
      // Fire analytics event asynchronously without blocking navigation
      // This prevents race conditions where navigation happens before analytics
      Promise.resolve().then(() => {
        trackLoginSuccessful('github');
      });
      navigate(redirectTo, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectTo, trackLoginSuccessful]);

  const handleLogin = async () => {
    try {
      setError(null);
      trackLoginInitiated('github', 'login_page');

      // Store redirect destination
      if (redirectTo !== '/') {
        localStorage.setItem('redirectAfterLogin', redirectTo);
      }

      await login();
    } catch (err) {
      console.error('Login error:', err);

      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    }
  };

  // Test mode login handler
  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Define test users that match the E2E test data
    const testUsers = [
      { email: 'test-owner@example.com', password: 'test-password-123' },
      { email: 'test-invitee@example.com', password: 'test-password-456' },
    ];

    // Check if the credentials match any test user
    const validUser = testUsers.find(
      (user) => user.email === testEmail && user.password === testPassword
    );

    if (validUser) {
      // Mock successful login for test mode
      localStorage.setItem('test-auth-user', testEmail);
      trackLoginSuccessful('test');

      // Navigate to redirect URL
      navigate(redirectTo, { replace: true });
    } else {
      setError('Invalid test credentials');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <SocialMetaTags
        title="Login - contributor.info"
        description="Log in to contributor.info to analyze GitHub repositories and track contribution patterns."
        url="https://contributor.info/login"
      />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Login Required</CardTitle>
          <CardDescription>
            You need to log in to search for repositories. This helps avoid rate limiting and
            provides access to more GitHub data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 items-center">
          {testMode ? (
            // Test mode: Show email/password form for E2E tests
            <form onSubmit={handleTestLogin} className="w-full space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test-owner@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  placeholder="Password"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Test Login
              </Button>
              <div className="text-xs text-muted-foreground text-center">
                Test mode active (CI environment)
              </div>
            </form>
          ) : (
            // Production mode: GitHub OAuth
            <Button onClick={handleLogin} size="lg">
              <GithubIcon className="mr-2 h-4 w-4" />
              Login with GitHub
            </Button>
          )}

          {error && <div className="text-red-500 text-sm mt-2 text-center">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
