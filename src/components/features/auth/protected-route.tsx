import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useGitHubAuth } from "@/hooks/use-github-auth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoggedIn, loading } = useGitHubAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      // Store the attempted URL for redirect after login
      const redirectTo = location.pathname + location.search;
      localStorage.setItem("redirectTo", redirectTo);
      navigate("/login");
    }
  }, [isLoggedIn, loading, navigate, location]);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated (navigation will handle redirect)
  if (!isLoggedIn) {
    return null;
  }

  return <>{children}</>;
}