import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { supabase } from "@/lib/supabase";

/**
 * Dedicated login page that handles authentication and redirects
 */
export default function LoginPage() {
  const { login, isLoggedIn, checkSession } = useGitHubAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // Get the intended destination from URL param or use home page as default
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get("redirectTo") || "/";

  // Check for auth hash in URL
  useEffect(() => {
    const hasAuthHash = window.location.hash.includes("access_token");
    if (hasAuthHash) {
      setDebugInfo("Auth hash detected in URL, processing authentication...");
    }
  }, []);

  // If already logged in, redirect to the intended destination
  useEffect(() => {
    if (isLoggedIn) {
      console.log("User is logged in, redirecting to:", redirectTo);
      setDebugInfo("Logged in, redirecting...");
      navigate(redirectTo, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectTo]);

  const handleLogin = async () => {
    try {
      setError(null);
      setDebugInfo("Starting login process...");

      // Store redirect destination
      if (redirectTo !== "/") {
        localStorage.setItem("redirectAfterLogin", redirectTo);
        setDebugInfo(`Stored redirect destination: ${redirectTo}`);
      }

      await login();
      setDebugInfo("Login function called, waiting for redirect...");
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    }
  };

  // Manual session check function for debugging
  const handleCheckSession = async () => {
    try {
      setDebugInfo("Checking session manually...");
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session) {
        setDebugInfo(`Session found: ${data.session.user?.id}`);
      } else {
        setDebugInfo("No active session found");
      }
    } catch (err) {
      setDebugInfo(
        `Session check error: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Login Required</CardTitle>
          <CardDescription>
            You need to log in to search for repositories. This helps avoid rate
            limiting and provides access to more GitHub data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 items-center">
          <Button onClick={handleLogin} size="lg">
            <GithubIcon className="mr-2 h-4 w-4" />
            Login with GitHub
          </Button>

          {error && (
            <div className="text-red-500 text-sm mt-2 text-center">{error}</div>
          )}

          {debugInfo && (
            <div className="text-sm mt-2 text-center border p-2 rounded bg-muted">
              <p className="font-semibold">Debug Info:</p>
              <p>{debugInfo}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="outline" size="sm" onClick={handleCheckSession}>
            Check Session Status
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
