import { useEffect } from "react";
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

/**
 * Dedicated login page that handles authentication and redirects
 */
export default function LoginPage() {
  const { login, isLoggedIn } = useGitHubAuth();
  const navigate = useNavigate();

  // Get the intended destination from URL param or use home page as default
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get("redirectTo") || "/";

  // If already logged in, redirect to the intended destination
  useEffect(() => {
    if (isLoggedIn) {
      navigate(redirectTo, { replace: true });
    }
  }, [isLoggedIn, navigate, redirectTo]);

  const handleLogin = async () => {
    await login();
    // The redirect will happen automatically via the effect when isLoggedIn changes
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
        <CardContent className="flex justify-center pt-4">
          <Button onClick={handleLogin} size="lg">
            <GithubIcon className="mr-2 h-4 w-4" />
            Login with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
