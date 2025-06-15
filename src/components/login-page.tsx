import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GithubIcon } from "lucide-react";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { SocialMetaTags } from "./meta-tags-provider";

/**
 * Dedicated login page that handles authentication and redirects
 */
export default function LoginPage() {
  const { login, isLoggedIn } = useGitHubAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  // Get the intended destination from URL param or use home page as default
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get("redirectTo") || "/";

  // If already logged in, redirect to the intended destination
  useEffect(() => {
    if (isLoggedIn) {
      console.log("User is logged in, redirecting to:", redirectTo);
      navigate(redirectTo, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectTo]);

  const handleLogin = async () => {
    try {
      setError(null);
      // Store redirect destination
      if (redirectTo !== "/") {
        localStorage.setItem("redirectAfterLogin", redirectTo);
      }

      await login();
    } catch (err) {
      console.error("Login error:", err);

      setError(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
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
        </CardContent>
      </Card>
    </div>
  );
}
